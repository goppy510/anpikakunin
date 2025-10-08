/**
 * 地震通知条件フィルタリングロジック
 *
 * 震度・都道府県条件に基づいて通知の可否を判定
 */

import { EventItem } from "@/app/components/monitor/types/EventItem";
import type { SlackNotificationSetting } from "@prisma/client";

/**
 * 震度スケール定義
 * 数値が大きいほど震度が強い
 */
export const INTENSITY_SCALE: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5弱": 5,
  "5-": 5,
  "5強": 6,
  "5+": 6,
  "6弱": 7,
  "6-": 7,
  "6強": 8,
  "6+": 8,
  "7": 9,
};

/**
 * 震度文字列を比較
 * @param intensity1 比較対象の震度
 * @param intensity2 基準となる震度
 * @returns intensity1 >= intensity2 の場合 true
 */
export function compareIntensity(
  intensity1: string,
  intensity2: string
): boolean {
  const scale1 = INTENSITY_SCALE[intensity1] ?? -1;
  const scale2 = INTENSITY_SCALE[intensity2] ?? -1;

  // どちらかが不正な震度の場合は false
  if (scale1 === -1 || scale2 === -1) {
    console.warn(`Invalid intensity values: ${intensity1}, ${intensity2}`);
    return false;
  }

  return scale1 >= scale2;
}

/**
 * 震度文字列を正規化（5- → 5弱 など）
 */
export function normalizeIntensity(intensity: string): string {
  if (!intensity) return "0";

  const normalized = INTENSITY_SCALE[intensity];
  if (normalized === undefined) {
    return intensity; // 元の値を返す
  }

  // 数値から標準形式に変換
  const reverseMap: Record<number, string> = {
    0: "0",
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5弱",
    6: "5強",
    7: "6弱",
    8: "6強",
    9: "7",
  };

  return reverseMap[normalized] || intensity;
}

/**
 * EventItemから最大震度を取得
 */
export function getMaxIntensityFromEvent(event: EventItem): string {
  // maxInt フィールドがあればそれを使用
  if (event.maxInt) {
    return normalizeIntensity(event.maxInt);
  }

  // currentMaxInt フィールド
  if (event.currentMaxInt) {
    return normalizeIntensity(event.currentMaxInt);
  }

  // デフォルト
  return "0";
}

/**
 * 都道府県条件マッチング
 * @param event 地震イベント
 * @param targetPrefectures 対象都道府県リスト
 * @returns マッチする場合 true
 */
export function matchesPrefecture(
  event: EventItem,
  targetPrefectures: string[]
): boolean {
  // 設定が空配列の場合は全都道府県対象
  if (!targetPrefectures || targetPrefectures.length === 0) {
    return true;
  }

  // EventItemには都道府県情報が含まれていないため、
  // 実装時にWebSocketMessageから取得する必要がある
  // ここでは一旦 true を返す（後続で詳細実装）

  // TODO: WebSocketMessageから都道府県情報を抽出してマッチング
  console.warn("Prefecture matching not fully implemented yet");
  return true;
}

/**
 * 通知条件の統合判定
 * @param event 地震イベント
 * @param settings 通知設定
 * @returns 通知すべき場合 true
 */
export function shouldNotify(
  event: EventItem,
  settings: Pick<SlackNotificationSetting, "minIntensity" | "targetPrefectures">
): boolean {
  // 1. 震度条件チェック
  if (settings.minIntensity) {
    const maxIntensity = getMaxIntensityFromEvent(event);

    if (!compareIntensity(maxIntensity, settings.minIntensity)) {
      console.log(
        `Intensity check failed: event=${maxIntensity}, min=${settings.minIntensity}`
      );
      return false;
    }
  }

  // 2. 都道府県条件チェック
  if (!matchesPrefecture(event, settings.targetPrefectures ?? [])) {
    console.log("Prefecture check failed");
    return false;
  }

  // 3. その他の条件（将来拡張用）
  // - テストイベントを除外
  if (event.isTest) {
    console.log("Test event, skipping notification");
    return false;
  }

  console.log("Notification conditions met");
  return true;
}

/**
 * 都道府県情報を含む詳細判定（WebSocketMessage用）
 */
export interface DetailedObservation {
  prefecture: string;
  maxIntensity: string;
}

export function shouldNotifyWithDetails(
  event: EventItem,
  observations: DetailedObservation[],
  settings: Pick<SlackNotificationSetting, "minIntensity" | "targetPrefectures">
): boolean {
  // 1. 震度条件チェック
  if (settings.minIntensity) {
    const maxIntensity = getMaxIntensityFromEvent(event);

    if (!compareIntensity(maxIntensity, settings.minIntensity)) {
      console.log(
        `Intensity check failed: event=${maxIntensity}, min=${settings.minIntensity}`
      );
      return false;
    }
  }

  // 2. 都道府県条件チェック（詳細版）
  if (settings.targetPrefectures && settings.targetPrefectures.length > 0) {
    const matchingPrefectures = observations.filter((obs) =>
      settings.targetPrefectures!.includes(obs.prefecture)
    );

    if (matchingPrefectures.length === 0) {
      console.log("No matching prefectures found");
      return false;
    }

    // マッチした都道府県の震度が条件を満たすかチェック
    if (settings.minIntensity) {
      const hasIntensityMatch = matchingPrefectures.some((obs) =>
        compareIntensity(obs.maxIntensity, settings.minIntensity!)
      );

      if (!hasIntensityMatch) {
        console.log("Matching prefectures but intensity too low");
        return false;
      }
    }
  }

  // 3. テストイベント除外
  if (event.isTest) {
    console.log("Test event, skipping notification");
    return false;
  }

  console.log("Notification conditions met (with details)");
  return true;
}
