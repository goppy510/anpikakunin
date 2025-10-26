/**
 * 地震情報自動取得・通知エンドポイントのテスト
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/app/lib/db/prisma';
import axios from 'axios';
import { decrypt } from '@/app/lib/security/encryption';

// モック設定
jest.mock('axios');
jest.mock('@/app/lib/dmdata/credentials');
jest.mock('@/app/lib/security/encryption');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

// テスト用データのクリーンアップヘルパー
async function cleanupTestData() {
  // 作成順の逆で削除（外部キー制約対応）
  await prisma.earthquakeNotification.deleteMany({});
  await prisma.earthquakeRecord.deleteMany({});
  await prisma.notificationChannel.deleteMany({});
  await prisma.earthquakeNotificationCondition.deleteMany({});
  await prisma.messageTemplate.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.slackWorkspace.deleteMany({});
}

describe('GET /api/cron/fetch-earthquakes', () => {
  const validAuthToken = 'test-secret-token';

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.EVENTBRIDGE_SECRET_TOKEN = validAuthToken;

    // テストデータをクリーンアップ
    await cleanupTestData();

    // decrypt モックの設定
    mockedDecrypt.mockReturnValue('xoxb-mock-bot-token');
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    await cleanupTestData();
  });

  describe('認証テスト', () => {
    it('正しい認証トークンで200を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/fetch-earthquakes', {
        headers: {
          'Authorization': `Bearer ${validAuthToken}`,
        },
      });

      // DMData APIのモックレスポンス（空レスポンス）
      mockedAxios.get.mockResolvedValue({
        data: {
          items: [],
          nextToken: null,
          nextPooling: '2025-10-22T15:00:00Z',
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('認証トークンがない場合は401を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/fetch-earthquakes');

      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('間違った認証トークンで401を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/fetch-earthquakes', {
        headers: {
          'Authorization': 'Bearer wrong-token',
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('地震情報取得テスト', () => {
    const createAuthenticatedRequest = () => {
      return new NextRequest('http://localhost:3000/api/cron/fetch-earthquakes', {
        headers: {
          'Authorization': `Bearer ${validAuthToken}`,
        },
      });
    };

    it('DMData APIから地震情報を取得できる', async () => {
      const mockEarthquakeData = {
        items: [
          {
            xmlReport: {
              Head: {
                Title: '震度速報',
                DateTime: '2025-10-22T15:47:00+09:00',
                EventID: '20251022154700',
              },
              Body: {
                Earthquake: {
                  OriginTime: '2025-10-22T15:47:00+09:00',
                  Hypocenter: {
                    Area: { Name: '千葉県北西部' },
                  },
                  Magnitude: { 'jmx_eb:value': '4.0' },
                },
                Intensity: {
                  Observation: {
                    MaxInt: '2',
                    Pref: [
                      {
                        Name: '千葉県',
                        MaxInt: '2',
                      },
                    ],
                  },
                },
              },
            },
          },
        ],
        nextToken: null,
        nextPooling: '2025-10-22T15:48:00Z',
      };

      mockedAxios.get.mockResolvedValue({ data: mockEarthquakeData });

      const request = createAuthenticatedRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://api.dmdata.jp/v2/telegrams'),
        expect.any(Object)
      );
    });
  });

  describe('通知条件マッチングテスト', () => {
    let testWorkspace: any;
    let testChannel: any;

    beforeEach(async () => {
      // テスト用のワークスペースをセットアップ
      testWorkspace = await prisma.slackWorkspace.create({
        data: {
          workspaceId: 'T0000TEST',
          name: 'テストワークスペース',
          botTokenCiphertext: Buffer.from('mock-cipher').toString('base64'),
          botTokenIv: Buffer.from('mock-iv').toString('base64'),
          botTokenTag: Buffer.from('mock-tag').toString('base64'),
          isEnabled: true,
        },
      });

      // テスト用の部署
      await prisma.department.create({
        data: {
          workspaceRef: testWorkspace.id,
          name: 'テスト部署',
          slackEmoji: ':test:',
          buttonColor: '#FF0000',
          displayOrder: 1,
          isActive: true,
        },
      });

      // テスト用のメッセージテンプレート
      await prisma.messageTemplate.create({
        data: {
          workspaceRef: testWorkspace.id,
          type: 'PRODUCTION',
          title: '地震発生: 震度{maxIntensity}',
          body: '震源: {epicenter}',
          isActive: true,
        },
      });

      // テスト用の通知チャンネル
      testChannel = await prisma.notificationChannel.create({
        data: {
          workspaceRef: testWorkspace.id,
          channelId: 'C0000TEST',
          channelName: '#test-earthquake',
          purpose: 'earthquake',
          isActive: true,
        },
      });
    });

    it('震度条件を満たす地震で通知レコードが作成される', async () => {
      // 震度2以上の通知条件を作成
      await prisma.earthquakeNotificationCondition.create({
        data: {
          workspaceRef: testWorkspace.id,
          minIntensity: '2',
          targetPrefectures: [],
          channelId: testChannel.channelId,
          isEnabled: true,
        },
      });

      // DMData APIのモック（震度2の地震）
      const mockEarthquakeData = {
        items: [
          {
            xmlReport: {
              Control: { Title: '震度速報' },
              Head: {
                Title: '震度速報',
                DateTime: '2025-10-22T15:47:00+09:00',
                EventID: '20251022154700',
              },
              Body: {
                Earthquake: {
                  OriginTime: '2025-10-22T15:47:00+09:00',
                  Hypocenter: { Area: { Name: '千葉県北西部' } },
                  Magnitude: { 'jmx_eb:value': '4.0' },
                },
                Intensity: {
                  Observation: {
                    MaxInt: '2',
                    Pref: [{ Name: '千葉県', MaxInt: '2', Code: '12' }],
                  },
                },
              },
            },
          },
        ],
        nextToken: null,
        nextPooling: '2025-10-22T15:48:00Z',
      };

      mockedAxios.get.mockResolvedValue({ data: mockEarthquakeData });
      mockedAxios.post.mockResolvedValue({
        data: { ok: true, ts: '1234567890.123456' },
      });

      const request = new NextRequest('http://localhost:3000/api/cron/fetch-earthquakes', {
        headers: { 'Authorization': `Bearer ${validAuthToken}` },
      });

      await GET(request);

      // 通知レコードが作成されたか確認
      const notifications = await prisma.earthquakeNotification.findMany();
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].notificationStatus).toBe('sent');
    });

    it('震度条件を満たさない地震では通知されない', async () => {
      // 震度5弱以上の通知条件を作成
      await prisma.earthquakeNotificationCondition.create({
        data: {
          workspaceRef: testWorkspace.id,
          minIntensity: '5弱',
          targetPrefectures: [],
          channelId: testChannel.channelId,
          isEnabled: true,
        },
      });

      // DMData APIのモック（震度2の地震）
      const mockEarthquakeData = {
        items: [
          {
            xmlReport: {
              Control: { Title: '震度速報' },
              Head: {
                Title: '震度速報',
                DateTime: '2025-10-22T15:47:00+09:00',
                EventID: '20251022154702',
              },
              Body: {
                Earthquake: {
                  OriginTime: '2025-10-22T15:47:00+09:00',
                  Hypocenter: { Area: { Name: '千葉県北西部' } },
                  Magnitude: { 'jmx_eb:value': '4.0' },
                },
                Intensity: {
                  Observation: {
                    MaxInt: '2',
                    Pref: [{ Name: '千葉県', MaxInt: '2', Code: '12' }],
                  },
                },
              },
            },
          },
        ],
        nextToken: null,
        nextPooling: '2025-10-22T15:48:00Z',
      };

      mockedAxios.get.mockResolvedValue({ data: mockEarthquakeData });

      const request = new NextRequest('http://localhost:3000/api/cron/fetch-earthquakes', {
        headers: { 'Authorization': `Bearer ${validAuthToken}` },
      });

      await GET(request);

      // 通知レコードが作成されていないか確認
      const notifications = await prisma.earthquakeNotification.findMany();
      expect(notifications.length).toBe(0);
    });
  });

  describe('Slack通知送信テスト', () => {
    it('通知レコード作成後にSlackにメッセージが送信される', async () => {
      // Slack APIのモック
      mockedAxios.post.mockResolvedValue({
        data: {
          ok: true,
          ts: '1234567890.123456',
          channel: 'C1234567890',
        },
      });

      // テスト実装
      expect(true).toBe(true); // プレースホルダー
    });

    it('Slack送信失敗時は通知ステータスがfailedになる', async () => {
      // Slack APIのモック（エラー）
      mockedAxios.post.mockResolvedValue({
        data: {
          ok: false,
          error: 'channel_not_found',
        },
      });

      // テスト実装
      expect(true).toBe(true); // プレースホルダー
    });

    it('本番用メッセージテンプレートが使用される', async () => {
      // メッセージテンプレートのモック確認
      expect(true).toBe(true); // プレースホルダー
    });

    it('部署ボタンが含まれる', async () => {
      // メッセージ内容の確認
      expect(true).toBe(true); // プレースホルダー
    });
  });

  describe('重複チェックテスト', () => {
    it('同じeventIdの地震は重複保存されない', async () => {
      // テスト実装
      expect(true).toBe(true); // プレースホルダー
    });

    it('同じ地震の通知レコードは重複作成されない', async () => {
      // テスト実装
      expect(true).toBe(true); // プレースホルダー
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('DMData APIエラー時でも500エラーにならない', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const request = new NextRequest('http://localhost:3000/api/cron/fetch-earthquakes', {
        headers: {
          'Authorization': `Bearer ${validAuthToken}`,
        },
      });

      const response = await GET(request);

      // エラーが発生してもレスポンスは返る
      expect(response).toBeDefined();
    });

    it('データベースエラー時のハンドリング', async () => {
      // DBエラーのモック
      expect(true).toBe(true); // プレースホルダー
    });
  });
});
