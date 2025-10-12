/**
 * WebSocketMessageから地震情報を抽出するユーティリティ
 */

import { WebSocketMessage } from "@/app/components/monitor/types/WebSocketTypes";
import { normalizeIntensity, type DetailedObservation } from "./notificationFilter";

/**
 * WebSocketMessageから都道府県別震度情報を抽出
 */
export function extractPrefectureObservations(
  message: WebSocketMessage
): DetailedObservation[] {
  const observations: DetailedObservation[] = [];

  try {
    // XMLレポート形式から抽出
    const prefectures =
      message.xmlReport?.body?.intensity?.observation?.prefectures?.pref;

    if (Array.isArray(prefectures)) {
      for (const pref of prefectures) {
        if (pref.name && pref.maxInt) {
          observations.push({
            prefecture: pref.name,
            maxIntensity: normalizeIntensity(pref.maxInt),
          });
        }
      }
    }

    // デコードされたbodyからも抽出を試みる（新フォーマット対応）
    if (observations.length === 0) {
      // TODO: デコードされたbodyから都道府県情報を抽出
      // message.body をデコードして都道府県情報を取得
    }
  } catch (error) {
    console.error("Failed to extract prefecture observations:", error);
  }

  return observations;
}

/**
 * WebSocketMessageから最大震度を取得
 */
export function extractMaxIntensity(message: WebSocketMessage): string {
  try {
    // XMLレポート形式
    const maxInt =
      message.xmlReport?.body?.intensity?.observation?.maxInt;

    if (maxInt) {
      return normalizeIntensity(maxInt);
    }

    // 都道府県別から最大値を算出
    const prefObservations = extractPrefectureObservations(message);
    if (prefObservations.length > 0) {
      const intensities = prefObservations.map((obs) => obs.maxIntensity);
      // 震度を数値化して最大値を取得
      const sorted = intensities.sort((a, b) => {
        const scaleA = getIntensityScale(a);
        const scaleB = getIntensityScale(b);
        return scaleB - scaleA; // 降順
      });
      return sorted[0];
    }
  } catch (error) {
    console.error("Failed to extract max intensity:", error);
  }

  return "0";
}

/**
 * 震度を数値スケールに変換
 */
function getIntensityScale(intensity: string): number {
  const scale: Record<string, number> = {
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5弱": 5,
    "5強": 6,
    "6弱": 7,
    "6強": 8,
    "7": 9,
  };

  return scale[intensity] ?? 0;
}
