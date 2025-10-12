import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getDmdataApiKey } from "@/app/lib/dmdata/credentials";

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

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${DMDATA_API_KEY}`,
    },
  });

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
  try {
    console.log("=== Cron: Fetching earthquakes from DMData.jp ===");

    const telegrams = await fetchEarthquakesFromDMData();
    console.log(`Fetched ${telegrams.length} telegrams from DMData.jp`);

    let savedCount = 0;

    for (const telegram of telegrams) {
      const saved = await saveEarthquakeEventLog(telegram);
      if (saved) {
        savedCount++;
      }
    }

    console.log(`=== Cron: Saved ${savedCount} new earthquake events ===`);

    return NextResponse.json({
      success: true,
      fetched: telegrams.length,
      saved: savedCount,
      message: `Fetched ${telegrams.length} telegrams, saved ${savedCount} new events`,
    });
  } catch (error: any) {
    console.error("Cron fetch earthquakes error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch earthquakes",
      },
      { status: 500 }
    );
  }
}
