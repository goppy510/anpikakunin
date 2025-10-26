/**
 * 通知スヌーズ設定APIのテスト
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, PUT } from '../route';
import { prisma } from '@/app/lib/db/prisma';
import { requireAuth } from '@/app/lib/auth/middleware';

// モック設定
jest.mock('@/app/lib/auth/middleware');
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

// テスト用データのクリーンアップヘルパー
async function cleanupTestData() {
  await prisma.notificationSnoozeConfig.deleteMany({});
  await prisma.slackWorkspace.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
}

describe('通知スヌーズ設定API', () => {
  let testUser: any;
  let testWorkspace: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupTestData();

    // テストユーザー作成
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'hashed',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });

    // テストワークスペース作成
    testWorkspace = await prisma.slackWorkspace.create({
      data: {
        workspaceId: 'T12345',
        name: 'テストワークスペース',
        botTokenCiphertext: 'encrypted',
        botTokenIv: 'iv',
        botTokenTag: 'tag',
      },
    });

    // requireAuth モック設定
    mockedRequireAuth.mockResolvedValue({ user: testUser });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('GET - スヌーズ設定取得', () => {
    it('全ワークスペースの設定を取得', async () => {
      // スヌーズ設定を作成
      await prisma.notificationSnoozeConfig.create({
        data: {
          workspaceRef: testWorkspace.id,
          durationHours: 48,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.configs).toBeDefined();
      expect(data.configs.length).toBe(1);
      expect(data.configs[0].durationHours).toBe(48);
      expect(data.configs[0].workspace.name).toBe('テストワークスペース');
    });

    it('設定が存在しない場合は空配列を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.configs).toEqual([]);
    });
  });

  describe('PUT - スヌーズ設定更新', () => {
    it('新しい設定を作成', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceRef: testWorkspace.id,
            durationHours: 72,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.config).toBeDefined();
      expect(data.config.durationHours).toBe(72);
      expect(data.config.workspace.name).toBe('テストワークスペース');

      // データベースに保存されたことを確認
      const config = await prisma.notificationSnoozeConfig.findUnique({
        where: { workspaceRef: testWorkspace.id },
      });
      expect(config).not.toBeNull();
      expect(config!.durationHours).toBe(72);
    });

    it('既存の設定を更新', async () => {
      // 既存設定を作成
      await prisma.notificationSnoozeConfig.create({
        data: {
          workspaceRef: testWorkspace.id,
          durationHours: 24,
        },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceRef: testWorkspace.id,
            durationHours: 96,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.config.durationHours).toBe(96);

      // 設定が更新されたことを確認
      const configs = await prisma.notificationSnoozeConfig.findMany({
        where: { workspaceRef: testWorkspace.id },
      });
      expect(configs.length).toBe(1); // 重複していない
      expect(configs[0].durationHours).toBe(96);
    });

    it('workspaceRefがない場合は400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({ durationHours: 48 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('workspaceRef and durationHours are required');
    });

    it('durationHoursがない場合は400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({ workspaceRef: testWorkspace.id }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(400);
    });

    it('durationHoursが0以下の場合は400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceRef: testWorkspace.id,
            durationHours: 0,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('durationHours must be between 1 and 168 (7 days)');
    });

    it('durationHoursが168を超える場合は400を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceRef: testWorkspace.id,
            durationHours: 169,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('durationHours must be between 1 and 168 (7 days)');
    });

    it('境界値: durationHours=1 は有効', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceRef: testWorkspace.id,
            durationHours: 1,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.config.durationHours).toBe(1);
    });

    it('境界値: durationHours=168 は有効', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceRef: testWorkspace.id,
            durationHours: 168,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.config.durationHours).toBe(168);
    });

    it('存在しないワークスペースの場合は404を返す', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/notification-snooze-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceRef: 'non-existent-id',
            durationHours: 48,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await PUT(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Workspace not found');
    });
  });
});
