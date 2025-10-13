import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getDmdataApiKey } from "@/app/lib/dmdata/credentials";
import { env } from "@/app/lib/env";

// 認証ヘルパー関数
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");

  // EventBridge用の認証トークン（推奨）
  const eventBridgeSecret = process.env.EVENTBRIDGE_SECRET_TOKEN;

  // 後方互換性のため、CRON_SECRETもサポート
  const cronSecret = env.CRON_SECRET;

  const acceptedToken = eventBridgeSecret || cronSecret;

  // トークンが設定されていない場合は警告を出すが、開発環境では許可
  if (!acceptedToken) {
    console.warn("⚠️ EVENTBRIDGE_SECRET_TOKEN or CRON_SECRET is not set");
    return process.env.NODE_ENV === "development";
  }

  // Authorization: Bearer <secret> の形式をチェック
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7); // "Bearer " を除去
  return token === acceptedToken;
}

// DMData.jp APIから地震情報を取得する関数
async function fetchEarthquakesFromDMData() {
  const DMDATA_API_KEY = await getDmdataApiKey();

  if (!DMDATA_API_KEY) {
    throw new Error("DMDATA_API_KEY is not configured in database or environment");
  }

  const url = new URL("https://api.dmdata.jp/v2/telegram");
  url.searchParams.append("classification", "telegram.earthquake");
  url.searchParams.append("type", "VXSE51,VXSE53");
  url.searchParams.append("limit", "20");
  url.searchParams.append("order", "new");
  url.searchParams.append("key", DMDATA_API_KEY); // クエリパラメータで認証

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`DMData API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

// 地震イベントログに保存（重複チェック付き）
async function saveEarthquakeEventLog(telegram: any) {
  const eventId = telegram.head?.eventId || telegram.id;
  const payloadHash = Buffer.from(JSON.stringify(telegram)).toString("base64").slice(0, 64);

  try {
    await prisma.earthquakeEventLog.create({
      data: {
        eventId,
        payloadHash,
        source: "cron",
        payload: telegram,
      },
    });
    return true; // 新規保存成功
  } catch (error: any) {
    if (error.code === "P2002") {
      // 重複（既に保存済み）
      return false;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  // 認証チェック
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {

    const telegrams = await fetchEarthquakesFromDMData();

    let savedCount = 0;

    for (const telegram of telegrams) {
      const saved = await saveEarthquakeEventLog(telegram);
      if (saved) {
        savedCount++;
      }
    }

    // cron実行記録として、新規データがなくても必ず1件保存（ダミーレコード）
    if (savedCount === 0 && telegrams.length > 0) {
      try {
        await prisma.earthquakeEventLog.create({
          data: {
            eventId: `cron-heartbeat-${Date.now()}`,
            payloadHash: `heartbeat`,
            source: "cron",
            payload: { type: "heartbeat", executedAt: new Date().toISOString(), fetchedCount: telegrams.length },
          },
        });
      } catch (error) {
      }
    }


    return NextResponse.json({
      success: true,
      fetched: telegrams.length,
      saved: savedCount,
      message: `Fetched ${telegrams.length} telegrams, saved ${savedCount} new events`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch earthquakes",
      },
      { status: 500 }
    );
  }
}
