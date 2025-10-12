import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { extractEarthquakeInfo } from "@/app/lib/notification/dmdataExtractor";
import { getDmdataApiKey } from "@/app/lib/dmdata/credentials";

const DMDATA_API_BASE_URL = "https://api.dmdata.jp";

/**
 * GET /api/admin/latest-earthquake-api
 * DMData.jp APIから最新の地震情報を1件取得（ヘルスチェック用）
 */
export async function GET(request: NextRequest) {
  const DMDATA_API_KEY = await getDmdataApiKey();

  if (!DMDATA_API_KEY) {
    return NextResponse.json(
      { error: "DMDATA_API_KEY が設定されていません（データベースまたは環境変数に登録してください）" },
      { status: 500 }
    );
  }

  try {
    // VXSE53（震源・震度情報）を1件取得
    const response = await axios.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
      params: {
        type: "VXSE53",
        limit: 1,
        key: DMDATA_API_KEY,
      },
      timeout: 10000,
    });

    const items = response.data.items || [];

    if (items.length === 0) {
      return NextResponse.json({
        earthquake: null,
        message: "地震情報がありません",
      });
    }

    // 地震情報を抽出
    const info = extractEarthquakeInfo(items[0]);

    if (!info) {
      return NextResponse.json({
        earthquake: null,
        message: "地震情報の解析に失敗しました",
      });
    }

    return NextResponse.json({
      earthquake: {
        eventId: info.eventId,
        type: info.type,
        title: info.title,
        epicenter: info.epicenter,
        magnitude: info.magnitude,
        depth: info.depth,
        maxIntensity: info.maxIntensity,
        occurrenceTime: info.occurrenceTime,
        arrivalTime: info.arrivalTime,
        prefectureObservations: info.prefectureObservations,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Failed to fetch latest earthquake from API:", error);
    return NextResponse.json(
      {
        error: "地震情報の取得に失敗しました",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
