/**
 * 地震通知条件判定ロジックのテスト
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prisma } from '@/app/lib/db/prisma';
import { mockSlackClient, mockSlackMessages } from '@/app/lib/slack/__mocks__/slackClient';

// テスト用の地震データ
const mockEarthquakeData = {
  震度5弱_東京: {
    eventId: 'eq-001',
    maxIntensity: '5弱',
    prefectures: ['東京都', '神奈川県'],
    magnitude: 5.5,
    epicenter: '東京都23区',
    depth: '10km',
  },
  震度4_大阪: {
    eventId: 'eq-002',
    maxIntensity: '4',
    prefectures: ['大阪府', '京都府'],
    magnitude: 4.8,
    epicenter: '大阪府北部',
    depth: '20km',
  },
  震度6強_北海道: {
    eventId: 'eq-003',
    maxIntensity: '6強',
    prefectures: ['北海道'],
    magnitude: 7.0,
    epicenter: '北海道西方沖',
    depth: '50km',
  },
};

// 通知条件チェック関数（実装イメージ）
interface NotificationCondition {
  minIntensity: string; // 最低震度
  targetPrefectures: string[]; // 対象都道府県
}

interface EarthquakeEvent {
  maxIntensity: string;
  prefectures: string[];
}

function shouldNotify(
  event: EarthquakeEvent,
  condition: NotificationCondition
): boolean {
  // 震度を数値化して比較
  const intensityMap: { [key: string]: number } = {
    '0': 0,
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5弱': 5.0,
    '5強': 5.5,
    '6弱': 6.0,
    '6強': 6.5,
    '7': 7.0,
  };

  const eventIntensity = intensityMap[event.maxIntensity] || 0;
  const minIntensity = intensityMap[condition.minIntensity] || 0;

  // 最低震度以上か
  if (eventIntensity < minIntensity) {
    return false;
  }

  // 対象都道府県に含まれるか（空配列の場合は全都道府県対象）
  if (condition.targetPrefectures.length === 0) {
    return true;
  }

  return event.prefectures.some((pref) =>
    condition.targetPrefectures.includes(pref)
  );
}

describe('地震通知条件判定ロジック', () => {
  beforeEach(() => {
    // モックメッセージをクリア
    mockSlackClient.clearMessages();
    // Jest モック関数の呼び出し履歴もクリア
    jest.clearAllMocks();
  });

  describe('震度条件のテスト', () => {
    it('震度5弱以上の条件: 震度5弱の地震で通知される', () => {
      const condition: NotificationCondition = {
        minIntensity: '5弱',
        targetPrefectures: [],
      };

      const result = shouldNotify(mockEarthquakeData.震度5弱_東京, condition);
      expect(result).toBe(true);
    });

    it('震度5弱以上の条件: 震度4の地震で通知されない', () => {
      const condition: NotificationCondition = {
        minIntensity: '5弱',
        targetPrefectures: [],
      };

      const result = shouldNotify(mockEarthquakeData.震度4_大阪, condition);
      expect(result).toBe(false);
    });

    it('震度6強以上の条件: 震度5弱の地震で通知されない', () => {
      const condition: NotificationCondition = {
        minIntensity: '6強',
        targetPrefectures: [],
      };

      const result = shouldNotify(mockEarthquakeData.震度5弱_東京, condition);
      expect(result).toBe(false);
    });

    it('震度6強以上の条件: 震度6強の地震で通知される', () => {
      const condition: NotificationCondition = {
        minIntensity: '6強',
        targetPrefectures: [],
      };

      const result = shouldNotify(mockEarthquakeData.震度6強_北海道, condition);
      expect(result).toBe(true);
    });
  });

  describe('都道府県条件のテスト', () => {
    it('東京都のみ対象: 東京都が含まれる地震で通知される', () => {
      const condition: NotificationCondition = {
        minIntensity: '1',
        targetPrefectures: ['東京都'],
      };

      const result = shouldNotify(mockEarthquakeData.震度5弱_東京, condition);
      expect(result).toBe(true);
    });

    it('東京都のみ対象: 大阪府の地震で通知されない', () => {
      const condition: NotificationCondition = {
        minIntensity: '1',
        targetPrefectures: ['東京都'],
      };

      const result = shouldNotify(mockEarthquakeData.震度4_大阪, condition);
      expect(result).toBe(false);
    });

    it('複数都道府県対象: いずれかが含まれれば通知される', () => {
      const condition: NotificationCondition = {
        minIntensity: '1',
        targetPrefectures: ['東京都', '大阪府', '北海道'],
      };

      expect(shouldNotify(mockEarthquakeData.震度5弱_東京, condition)).toBe(true);
      expect(shouldNotify(mockEarthquakeData.震度4_大阪, condition)).toBe(true);
      expect(shouldNotify(mockEarthquakeData.震度6強_北海道, condition)).toBe(true);
    });
  });

  describe('複合条件のテスト', () => {
    it('震度5弱以上 かつ 東京都: 条件を満たす地震で通知される', () => {
      const condition: NotificationCondition = {
        minIntensity: '5弱',
        targetPrefectures: ['東京都'],
      };

      const result = shouldNotify(mockEarthquakeData.震度5弱_東京, condition);
      expect(result).toBe(true);
    });

    it('震度5弱以上 かつ 東京都: 震度が足りない場合は通知されない', () => {
      const condition: NotificationCondition = {
        minIntensity: '5弱',
        targetPrefectures: ['東京都'],
      };

      const result = shouldNotify(mockEarthquakeData.震度4_大阪, condition);
      expect(result).toBe(false);
    });

    it('震度5弱以上 かつ 東京都: 都道府県が異なる場合は通知されない', () => {
      const condition: NotificationCondition = {
        minIntensity: '5弱',
        targetPrefectures: ['東京都'],
      };

      const result = shouldNotify(mockEarthquakeData.震度6強_北海道, condition);
      expect(result).toBe(false);
    });
  });

  describe('Slack通知モックのテスト', () => {
    it('通知条件を満たす場合、Slack APIが呼ばれる', async () => {
      const condition: NotificationCondition = {
        minIntensity: '5弱',
        targetPrefectures: ['東京都'],
      };

      const shouldSend = shouldNotify(mockEarthquakeData.震度5弱_東京, condition);

      if (shouldSend) {
        await mockSlackClient.chat.postMessage({
          channel: '#earthquake-alerts',
          text: `地震発生: 震度${mockEarthquakeData.震度5弱_東京.maxIntensity}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*地震発生*\n震度: ${mockEarthquakeData.震度5弱_東京.maxIntensity}\n震源: ${mockEarthquakeData.震度5弱_東京.epicenter}`,
              },
            },
          ],
        });
      }

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledTimes(1);
      expect(mockSlackMessages).toHaveLength(1);
      expect(mockSlackMessages[0].channel).toBe('#earthquake-alerts');
      expect(mockSlackMessages[0].text).toContain('震度5弱');
    });

    it('通知条件を満たさない場合、Slack APIは呼ばれない', async () => {
      const condition: NotificationCondition = {
        minIntensity: '5弱',
        targetPrefectures: ['東京都'],
      };

      const shouldSend = shouldNotify(mockEarthquakeData.震度4_大阪, condition);

      if (shouldSend) {
        await mockSlackClient.chat.postMessage({
          channel: '#earthquake-alerts',
          text: '地震発生',
        });
      }

      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(mockSlackMessages).toHaveLength(0);
    });
  });
});
