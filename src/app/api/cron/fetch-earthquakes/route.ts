import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getDmdataApiKey } from "@/app/lib/dmdata/credentials";
import { env } from "@/app/lib/env";
import { parseStringPromise } from "xml2js";
import crypto from "crypto";
import {
  extractEarthquakeInfo,
  type TelegramItem,
  type EarthquakeInfo,
} from "@/app/lib/notification/dmdataExtractor";

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

// XMLデータを取得してパース
async function fetchAndParseXml(url: string, apiKey: string, meta: any): Promise<TelegramItem | null> {
  try {
    const response = await fetch(`${url}?key=${apiKey}`);
    if (!response.ok) {
      console.error(`Failed to fetch XML from ${url}: ${response.status}`);
      return null;
    }

    const xmlData = await response.text();

    const parsed = await parseStringPromise(xmlData, {
      explicitArray: false,
      mergeAttrs: true,
    });

    const report = parsed?.Report;
    if (!report) {
      return null;
    }

    return {
      ...meta,
      xmlReport: report,
    };
  } catch (error) {
    console.error(`Error parsing XML from ${url}:`, error);
    return null;
  }
}

// 地震情報をearthquake_recordsに保存
async function saveEarthquakeRecord(info: EarthquakeInfo): Promise<string | null> {
  try {
    // 重複チェック（event_idとserial_noの組み合わせ）
    const existing = await prisma.earthquakeRecord.findFirst({
      where: {
        eventId: info.eventId,
        serialNo: info.serialNo,
      },
    });

    if (existing) {
      return null; // 既に保存済み
    }

    const record = await prisma.earthquakeRecord.create({
      data: {
        eventId: info.eventId,
        infoType: info.infoType,
        title: info.title,
        epicenter: info.epicenter || null,
        depth: info.depth || null,
        magnitude: info.magnitude || null,
        maxIntensity: info.maxIntensity || null,
        occurredAt: info.occurredAt ? new Date(info.occurredAt) : null,
        prefectureObservations: info.prefectureObservations || null,
        serialNo: info.serialNo,
        receivedAt: new Date(info.receivedAt),
      },
    });

    return record.id; // レコードIDを返す
  } catch (error: any) {
    console.error("Error saving earthquake record:", error);
    return null;
  }
}

// 通知条件にマッチするかチェックして通知レコードを作成
async function checkAndCreateNotifications(recordId: string, info: EarthquakeInfo): Promise<void> {
  try {
    // 通知条件を取得
    const conditions = await prisma.earthquakeNotificationCondition.findMany({
      where: {
        isEnabled: true,
      },
      include: {
        workspace: true,
      },
    });

    for (const condition of conditions) {
      // 震度チェック
      const minIntensity = condition.minIntensity || "1";
      if (info.maxIntensity && !matchesIntensity(info.maxIntensity, minIntensity)) {
        continue;
      }

      // 都道府県チェック
      const targetPrefectures = condition.targetPrefectures || [];
      if (targetPrefectures.length > 0 && info.prefectureObservations) {
        const observations = info.prefectureObservations as any;
        const affectedPrefectures = Object.keys(observations);
        const hasMatch = affectedPrefectures.some((pref) =>
          targetPrefectures.includes(pref)
        );
        if (!hasMatch) {
          continue;
        }
      }

      // 通知チャンネルを取得
      const channels = await prisma.notificationChannel.findMany({
        where: {
          workspaceRef: condition.workspaceRef,
          purpose: "earthquake",
          isActive: true,
        },
      });

      if (channels.length === 0) {
        console.warn(`⚠️  通知チャンネルが設定されていません: ${condition.workspace.name}`);
        continue;
      }

      // 通知レコードを作成
      for (const channel of channels) {
        const existing = await prisma.earthquakeNotification.findFirst({
          where: {
            earthquakeRecordId: recordId,
            workspaceId: condition.workspaceRef,
            channelId: channel.channelId,
          },
        });

        if (existing) {
          continue; // 既に作成済み
        }

        await prisma.earthquakeNotification.create({
          data: {
            earthquakeRecordId: recordId,
            workspaceId: condition.workspaceRef,
            channelId: channel.channelId,
            notificationStatus: "pending",
          },
        });

        console.log(`✅ 通知レコード作成: ${condition.workspace.name} -> #${channel.channelName}`);
      }
    }
  } catch (error: any) {
    console.error("Error creating notification records:", error);
  }
}

// 震度比較ヘルパー
function matchesIntensity(maxIntensity: string, minIntensity: string): boolean {
  const intensityMap: Record<string, number> = {
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

  const maxValue = intensityMap[maxIntensity] || 0;
  const minValue = intensityMap[minIntensity] || 0;

  return maxValue >= minValue;
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
    const DMDATA_API_KEY = await getDmdataApiKey();
    if (!DMDATA_API_KEY) {
      return NextResponse.json(
        { success: false, error: "DMDATA_API_KEY not configured" },
        { status: 500 }
      );
    }

    const telegrams = await fetchEarthquakesFromDMData();

    let savedEventLogCount = 0;
    let savedRecordCount = 0;

    for (const telegram of telegrams) {
      // 1. イベントログに保存（重複チェック）
      const savedLog = await saveEarthquakeEventLog(telegram);
      if (savedLog) {
        savedEventLogCount++;
      }

      // 2. XMLデータを取得してパース
      if (telegram.url && telegram.format === "xml") {
        const telegramItem = await fetchAndParseXml(
          telegram.url,
          DMDATA_API_KEY,
          telegram
        );

        if (telegramItem) {
          // 3. 地震情報を抽出
          const earthquakeInfo = extractEarthquakeInfo(telegramItem);

          if (earthquakeInfo) {
            // 4. earthquake_recordsに保存
            const recordId = await saveEarthquakeRecord(earthquakeInfo);
            if (recordId) {
              savedRecordCount++;
              console.log(`✅ Saved earthquake record: ${earthquakeInfo.eventId}`);

              // 5. 通知条件チェックと通知レコード作成
              await checkAndCreateNotifications(recordId, earthquakeInfo);
            }
          }
        }
      }
    }

    // cron実行記録として、新規データがなくても必ず1件保存（ダミーレコード）
    if (savedEventLogCount === 0 && telegrams.length > 0) {
      try {
        // 2分以上前のheartbeatレコードを削除（時刻の揺らぎを考慮）
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        await prisma.earthquakeEventLog.deleteMany({
          where: {
            payloadHash: "heartbeat",
            source: "cron",
            fetchedAt: {
              lt: twoMinutesAgo,
            },
          },
        });

        // 新しいheartbeatレコードを作成
        await prisma.earthquakeEventLog.create({
          data: {
            eventId: `cron-heartbeat-${Date.now()}`,
            payloadHash: `heartbeat`,
            source: "cron",
            payload: {
              type: "heartbeat",
              executedAt: new Date().toISOString(),
              fetchedCount: telegrams.length,
            },
          },
        });
      } catch (error) {
        // Ignore errors
      }
    }

    return NextResponse.json({
      success: true,
      fetched: telegrams.length,
      savedEventLogs: savedEventLogCount,
      savedRecords: savedRecordCount,
      message: `Fetched ${telegrams.length} telegrams, saved ${savedRecordCount} earthquake records`,
    });
  } catch (error: any) {
    console.error("Error in fetch-earthquakes cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch earthquakes",
      },
      { status: 500 }
    );
  }
}
