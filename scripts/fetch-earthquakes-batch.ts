#!/usr/bin/env node

/**
 * DMData.jp API から1分間隔で地震情報を取得するバッチ処理
 * Docker Composeで実行される常駐プロセス
 */

import cron from "node-cron";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { parseStringPromise } from "xml2js";
import {
  extractEarthquakeInfo,
  normalizeIntensity,
  type TelegramItem,
  type EarthquakeInfo,
} from "../src/app/lib/notification/dmdataExtractor";
import { decrypt } from "../src/app/lib/security/encryption";

const prisma = new PrismaClient();
const DMDATA_API_BASE_URL = "https://api.dmdata.jp";

/**
 * 有効なAPI Keyをデータベースから取得
 * データベースに登録がない場合は環境変数から取得
 */
async function getDmdataApiKey(): Promise<string | null> {
  try {
    const apiKeyRecord = await prisma.dmdataApiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (apiKeyRecord) {
      try {
        const payload = JSON.parse(apiKeyRecord.apiKey);
        const decrypted = decrypt(payload);
        if (decrypted) {
          console.log("[Credentials] Using DMData API key from database");
          return decrypted;
        }
      } catch (error) {
        console.error("[Credentials] Failed to decrypt API key:", error);
      }
    }

    const envKey = process.env.DMDATA_API_KEY;
    if (envKey) {
      console.log("[Credentials] Using DMData API key from environment variable");
      return envKey;
    }

    console.warn("[Credentials] No DMData API key found");
    return null;
  } catch (error) {
    console.error("[Credentials] Failed to get DMData API key:", error);
    return process.env.DMDATA_API_KEY || null;
  }
}

interface EarthquakeEvent {
  eventId: string;
  type: string;
  title: string;
  serialNo: number;
  receivedAt: string;
  [key: string]: any;
}

/**
 * ペイロードのハッシュ値を計算（重複検知用）
 */
function calculatePayloadHash(payload: any): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHash("sha256").update(payloadString).digest("hex");
}

/**
 * XMLからTelegramItemに変換
 */
async function parseXmlToTelegramItem(xmlData: string, meta: any): Promise<TelegramItem | null> {
  try {
    const parsed = await parseStringPromise(xmlData, {
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [
        (name) => {
          // 先頭が小文字でない場合、そのまま返す（例: Body, Head）
          return name;
        },
      ],
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
    console.error("❌ XMLパースエラー:", error);
    return null;
  }
}

/**
 * DMData.jp API から地震情報を取得（VXSE51とVXSE53をペアリング）
 */
async function fetchEarthquakes(): Promise<EarthquakeInfo[]> {
  const DMDATA_API_KEY = await getDmdataApiKey();

  if (!DMDATA_API_KEY) {
    console.error("❌ DMDATA_API_KEY が設定されていません（データベースまたは環境変数に登録してください）");
    return [];
  }

  try {
    console.log("🔍 地震情報を取得中...");

    // VXSE51（震度速報）とVXSE53（震源・震度情報）を並行取得
    const [vxse51Response, vxse53Response] = await Promise.all([
      axios.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
        params: {
          type: "VXSE51",
          limit: 10,
          key: DMDATA_API_KEY,
        },
        timeout: 30000,
      }),
      axios.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
        params: {
          type: "VXSE53",
          limit: 10,
          key: DMDATA_API_KEY,
        },
        timeout: 30000,
      }),
    ]);

    const vxse51Events = vxse51Response.data.items || [];
    const vxse53Events = vxse53Response.data.items || [];

    console.log(`📊 取得結果: VXSE51=${vxse51Events.length}件, VXSE53=${vxse53Events.length}件`);

    // VXSE51を優先的に処理し、VXSE53とペアリング
    const earthquakes: EarthquakeInfo[] = [];
    const processedEventIds = new Set<string>();

    // VXSE51（震度速報）を処理
    for (const meta of vxse51Events) {
      // XML詳細を取得
      const xmlResponse = await axios.get(meta.url, {
        params: { key: DMDATA_API_KEY },
        timeout: 10000,
        responseType: "text",
      });

      const telegramItem = await parseXmlToTelegramItem(xmlResponse.data, meta);
      if (!telegramItem) {
        continue;
      }

      const info = extractEarthquakeInfo(telegramItem);
      if (!info || !info.maxIntensity) {
        continue;
      }

      // 震度3以上のみ処理
      const intensityNum = intensityToNumeric(info.maxIntensity);
      if (intensityNum < 3.0) {
        console.log(`⏭️  スキップ（震度3未満）: ${info.title} 震度${info.maxIntensity}`);
        continue;
      }

      console.log(`✅ VXSE51: ${info.title} 震度${info.maxIntensity}`);

      // 対応するVXSE53を時刻で検索（5分以内）
      const matchingVxse53 = vxse53Events.find((v53) => {
        const timeDiff = Math.abs(
          new Date(v53.head.time).getTime() - new Date(meta.head.time).getTime()
        );
        return timeDiff < 5 * 60 * 1000;
      });

      if (matchingVxse53) {
        console.log(`  🔗 対応するVXSE53を発見: ${matchingVxse53.id}`);
        // VXSE53の詳細を取得
        const vxse53XmlResponse = await axios.get(matchingVxse53.url, {
          params: { key: DMDATA_API_KEY },
          timeout: 10000,
          responseType: "text",
        });

        const vxse53Item = await parseXmlToTelegramItem(
          vxse53XmlResponse.data,
          matchingVxse53
        );

        if (vxse53Item) {
          const vxse53Info = extractEarthquakeInfo(vxse53Item);
          if (vxse53Info) {
            // VXSE53の詳細情報をマージ
            info.epicenter = vxse53Info.epicenter;
            info.magnitude = vxse53Info.magnitude;
            info.depth = vxse53Info.depth;
            info.prefectureObservations = vxse53Info.prefectureObservations;
            console.log(`  ✅ 詳細情報マージ: 震源=${info.epicenter}, M=${info.magnitude}`);
          }
        }
      }

      processedEventIds.add(info.eventId);
      earthquakes.push(info);
    }

    console.log(`\n📋 抽出された地震情報: ${earthquakes.length}件`);
    return earthquakes;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error("❌ DMData.jp API エラー:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
      });
    } else {
      console.error("❌ 予期しないエラー:", error);
    }
    return [];
  }
}

/**
 * 震度を数値に変換（比較用）
 */
function intensityToNumeric(intensity: string): number {
  const map: Record<string, number> = {
    "1": 1.0,
    "2": 2.0,
    "3": 3.0,
    "4": 4.0,
    "5弱": 5.0,
    "5強": 5.5,
    "6弱": 6.0,
    "6強": 6.5,
    "7": 7.0,
  };
  return map[intensity] || 0;
}

/**
 * イベントをデータベースに保存（重複チェック付き）
 * 震度3以上の地震を earthquake_records テーブルに保存
 */
async function saveEarthquakeRecord(info: EarthquakeInfo): Promise<string | null> {
  try {
    // 既存レコードチェック（eventIdで重複確認）
    const existing = await prisma.earthquakeRecord.findFirst({
      where: {
        eventId: info.eventId,
      },
    });

    if (existing) {
      console.log(`⏭️  スキップ（既存）: ${info.eventId}`);
      return null;
    }

    // earthquake_records に保存（震度3以上）
    const record = await prisma.earthquakeRecord.create({
      data: {
        eventId: info.eventId,
        infoType: info.type,
        title: info.title,
        epicenter: info.epicenter,
        magnitude: info.magnitude,
        depth: info.depth,
        maxIntensity: info.maxIntensity,
        occurrenceTime: info.occurrenceTime ? new Date(info.occurrenceTime) : null,
        arrivalTime: info.arrivalTime ? new Date(info.arrivalTime) : null,
        rawData: info as any,
      },
    });

    console.log(`💾 地震記録保存: ${info.eventId} - ${info.title} (震度${info.maxIntensity})`);

    // 都道府県別震度を保存
    if (info.prefectureObservations && info.prefectureObservations.length > 0) {
      await savePrefectureObservations(record.id, info.prefectureObservations);
    }

    return record.id;
  } catch (error: any) {
    console.error(`❌ DB保存エラー (${info.eventId}):`, error.message);
    return null;
  }
}

/**
 * 都道府県別震度観測データを保存
 */
async function savePrefectureObservations(
  earthquakeRecordId: string,
  observations: Array<{ prefecture: string; maxIntensity: string }>
): Promise<void> {
  try {
    // 都道府県マスターから都道府県コードを取得
    const prefectures = await prisma.prefecture.findMany();
    const prefectureMap = new Map(prefectures.map((p) => [p.name, p.code]));

    // 都道府県別震度を保存
    const observationsToCreate = observations
      .map((obs) => {
        const prefectureCode = prefectureMap.get(obs.prefecture);
        if (!prefectureCode) {
          console.warn(`⚠️  都道府県コード不明: ${obs.prefecture}`);
          return null;
        }

        return {
          earthquakeRecordId,
          prefectureCode,
          prefectureName: obs.prefecture,
          maxIntensity: obs.maxIntensity,
        };
      })
      .filter((obs): obs is NonNullable<typeof obs> => obs !== null);

    if (observationsToCreate.length > 0) {
      await prisma.earthquakePrefectureObservation.createMany({
        data: observationsToCreate,
        skipDuplicates: true,
      });

      console.log(`  ✅ 都道府県別震度: ${observationsToCreate.length}件保存`);
    }
  } catch (error: any) {
    console.error(`❌ 都道府県別震度保存エラー:`, error.message);
  }
}

/**
 * 通知条件に合致する設定を検索
 */
async function findMatchingNotificationConditions(
  earthquakeRecordId: string,
  earthquakeInfo: EarthquakeInfo
): Promise<void> {
  if (!earthquakeInfo.maxIntensity || !earthquakeInfo.prefectureObservations) {
    return;
  }

  try {
    // 有効な通知条件を取得
    const conditions = await prisma.earthquakeNotificationCondition.findMany({
      where: {
        isEnabled: true,
      },
      include: {
        workspace: true,
        infoType: true,
      },
    });

    if (conditions.length === 0) {
      console.log("  ℹ️  通知条件が設定されていません");
      return;
    }

    const earthquakeIntensity = intensityToNumeric(earthquakeInfo.maxIntensity);

    for (const condition of conditions) {
      // 最低震度チェック
      if (condition.minIntensity) {
        const minIntensity = intensityToNumeric(condition.minIntensity);
        if (earthquakeIntensity < minIntensity) {
          continue;
        }
      }

      // 地震情報種別チェック
      if (condition.earthquakeInfoType && condition.earthquakeInfoType !== earthquakeInfo.type) {
        continue;
      }

      // 都道府県チェック
      const targetPrefectures = condition.targetPrefectures as string[];
      if (targetPrefectures && targetPrefectures.length > 0) {
        const observedPrefectures = earthquakeInfo.prefectureObservations.map(
          (obs) => obs.prefecture
        );
        const hasMatch = targetPrefectures.some((target) =>
          observedPrefectures.includes(target)
        );

        if (!hasMatch) {
          continue;
        }
      }

      // 条件に合致したので通知レコードを作成
      await createNotificationRecord(earthquakeRecordId, condition);
    }
  } catch (error: any) {
    console.error(`❌ 通知条件マッチングエラー:`, error.message);
  }
}

/**
 * バッチヘルスチェックを更新
 * @param status - "running" | "healthy" | "warning" | "error"
 * @param errorMessage - エラーメッセージ（オプション）
 */
async function updateBatchHealthCheck(
  status: "running" | "healthy" | "warning" | "error",
  errorMessage?: string
): Promise<void> {
  try {
    // システム設定テーブルまたは専用テーブルに保存
    // 今回は activity_logs を流用
    await prisma.activityLog.create({
      data: {
        userId: null,
        userEmail: "system@batch",
        action: "batch_health_check",
        resourceType: "earthquake_batch",
        resourceId: "fetch-earthquakes-batch",
        resourceName: "地震情報取得バッチ",
        details: JSON.stringify({
          status,
          timestamp: new Date().toISOString(),
          errorMessage,
        }),
      },
    });
  } catch (error) {
    console.error("❌ ヘルスチェック更新エラー:", error);
  }
}

/**
 * 最新のヘルスチェック状態を判定
 * 1分ごとに実行されるべきバッチが:
 * - 1分以内に成功 → healthy (緑)
 * - 3分以内に成功 → warning (黄)
 * - 3分以上経過 → error (赤)
 */
async function getBatchHealthStatus(): Promise<{
  status: "healthy" | "warning" | "error";
  lastRunAt: Date | null;
  message: string;
}> {
  try {
    const latestLog = await prisma.activityLog.findFirst({
      where: {
        action: "batch_health_check",
        resourceType: "earthquake_batch",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!latestLog) {
      return {
        status: "error",
        lastRunAt: null,
        message: "バッチが一度も実行されていません",
      };
    }

    const now = new Date();
    const lastRunAt = latestLog.createdAt;
    const elapsedMinutes = (now.getTime() - lastRunAt.getTime()) / 1000 / 60;

    if (elapsedMinutes <= 1.5) {
      return {
        status: "healthy",
        lastRunAt,
        message: "正常稼働中",
      };
    } else if (elapsedMinutes <= 3) {
      return {
        status: "warning",
        lastRunAt,
        message: `前回実行から${Math.floor(elapsedMinutes)}分経過`,
      };
    } else {
      return {
        status: "error",
        lastRunAt,
        message: `前回実行から${Math.floor(elapsedMinutes)}分経過（異常）`,
      };
    }
  } catch (error) {
    console.error("❌ ヘルスチェック取得エラー:", error);
    return {
      status: "error",
      lastRunAt: null,
      message: "ヘルスチェックの取得に失敗しました",
    };
  }
}

/**
 * 通知レコードを作成
 */
async function createNotificationRecord(
  earthquakeRecordId: string,
  condition: any
): Promise<void> {
  try {
    // 通知チャンネル情報を取得
    const channels = await prisma.notificationChannel.findMany({
      where: {
        workspaceRef: condition.workspaceRef,
        purpose: "earthquake",
        isActive: true,
      },
    });

    if (channels.length === 0) {
      console.warn(
        `  ⚠️  通知チャンネルが設定されていません: ${condition.workspace.name}`
      );
      return;
    }

    // 各チャンネルに通知レコードを作成
    for (const channel of channels) {
      // 重複チェック
      const existing = await prisma.earthquakeNotification.findFirst({
        where: {
          earthquakeRecordId,
          workspaceId: condition.workspaceRef,
          channelId: channel.channelId,
        },
      });

      if (existing) {
        continue;
      }

      await prisma.earthquakeNotification.create({
        data: {
          earthquakeRecordId,
          workspaceId: condition.workspaceRef,
          channelId: channel.channelId,
          notificationStatus: "pending",
        },
      });

      console.log(
        `  ✅ 通知レコード作成: ${condition.workspace.name} -> #${channel.channelName}`
      );
    }
  } catch (error: any) {
    console.error(`❌ 通知レコード作成エラー:`, error.message);
  }
}

/**
 * 保留中の通知を送信
 */
async function processPendingNotifications(): Promise<void> {
  try {
    // 保留中の通知を取得（最大10件）
    const pendingNotifications = await prisma.earthquakeNotification.findMany({
      where: {
        notificationStatus: "pending",
      },
      include: {
        earthquakeRecord: true,
        workspace: true,
      },
      take: 10,
      orderBy: {
        createdAt: "asc",
      },
    });

    if (pendingNotifications.length === 0) {
      return;
    }

    console.log(`\n📢 保留中の通知を処理中: ${pendingNotifications.length}件`);

    for (const notification of pendingNotifications) {
      await sendSlackNotification(notification);
    }
  } catch (error: any) {
    console.error(`❌ 通知処理エラー:`, error.message);
  }
}

/**
 * Slack通知を送信
 */
async function sendSlackNotification(notification: any): Promise<void> {
  try {
    console.log(`  📢 Slack通知送信開始: ${notification.workspace.name} -> ${notification.channelId}`);

    // 1. Bot Tokenを復号化
    const { decrypt } = await import("../src/app/lib/security/encryption");
    const botToken = decrypt({
      ciphertext: notification.workspace.botTokenCiphertext,
      iv: notification.workspace.botTokenIv,
      authTag: notification.workspace.botTokenTag,
    });

    if (!botToken) {
      throw new Error("Bot Token復号化失敗");
    }

    // 2. 部署情報を取得
    const departments = await prisma.department.findMany({
      where: {
        workspaceRef: notification.workspaceId,
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
    });

    if (departments.length === 0) {
      console.warn(`  ⚠️  部署が設定されていません: ${notification.workspace.name}`);
      await prisma.earthquakeNotification.update({
        where: { id: notification.id },
        data: {
          notificationStatus: "failed",
          errorMessage: "部署が設定されていません",
        },
      });
      return;
    }

    // 3. メッセージテンプレートを取得
    const template = await prisma.messageTemplate.findFirst({
      where: {
        workspaceRef: notification.workspaceId,
        type: "PRODUCTION",
        isActive: true,
      },
    });

    const defaultTemplate = {
      title: `🚨 【地震情報】震度{maxIntensity}`,
      body: `*地震が発生しました*\n\n発生時刻: {occurrenceTime}\n震源地: {epicenter}\nマグニチュード: {magnitude}\n深さ: {depth}\n\n*安否確認をお願いします*\n該当する部署のボタンを押してください。`,
    };

    // 4. 地震情報を取得
    const { extractEarthquakeInfo } = await import("../src/app/lib/notification/dmdataExtractor");
    const earthquakeInfo = extractEarthquakeInfo(notification.earthquakeRecord.rawData);

    if (!earthquakeInfo) {
      throw new Error("地震情報の抽出に失敗");
    }

    // 5. メッセージを生成
    const { buildEarthquakeNotificationMessage } = await import("../src/app/lib/slack/messageBuilder");
    const message = buildEarthquakeNotificationMessage(
      earthquakeInfo,
      departments.map((d) => ({
        id: d.id,
        name: d.name,
        slackEmoji: d.slackEmoji,
        buttonColor: d.buttonColor,
      })),
      template || defaultTemplate
    );

    // 6. Slack APIでメッセージ送信
    const response = await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: notification.channelId,
        ...message,
      },
      {
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.ok) {
      throw new Error(`Slack API エラー: ${response.data.error}`);
    }

    // 7. 送信成功
    await prisma.earthquakeNotification.update({
      where: { id: notification.id },
      data: {
        notificationStatus: "sent",
        messageTs: response.data.ts,
        notifiedAt: new Date(),
      },
    });

    console.log(`  ✅ Slack通知送信完了: message_ts=${response.data.ts}`);
  } catch (error: any) {
    console.error(`  ❌ Slack通知送信エラー:`, error.message);

    // エラー記録
    await prisma.earthquakeNotification.update({
      where: { id: notification.id },
      data: {
        notificationStatus: "failed",
        errorMessage: error.message,
      },
    });
  }
}

/**
 * メイン処理：地震情報を取得・保存・通知
 */
async function processEarthquakes() {
  console.log("\n" + "=".repeat(60));
  console.log(`⏰ 実行時刻: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  try {
    // ヘルスチェック更新（処理開始）
    await updateBatchHealthCheck("running");

    // 地震情報を取得
    const earthquakes = await fetchEarthquakes();

    if (earthquakes.length === 0) {
      console.log("ℹ️  新しい地震情報はありません");

      // ヘルスチェック更新（正常終了）
      await updateBatchHealthCheck("healthy");

      // 保留中の通知を処理
      await processPendingNotifications();
      return;
    }

    // 各地震情報を保存
    let savedCount = 0;
    const savedRecords: Array<{ id: string; info: EarthquakeInfo }> = [];

    for (const info of earthquakes) {
      const recordId = await saveEarthquakeRecord(info);

      if (recordId) {
        savedCount++;
        savedRecords.push({ id: recordId, info });
      }
    }

    console.log(`\n📊 処理結果: ${savedCount}件の新規イベントを保存`);

    // 通知条件チェック
    for (const { id, info } of savedRecords) {
      await findMatchingNotificationConditions(id, info);
    }

    // ヘルスチェック更新（正常終了）
    await updateBatchHealthCheck("healthy");

    // 保留中の通知を処理
    await processPendingNotifications();
  } catch (error) {
    console.error("❌ 処理中にエラーが発生:", error);
    // ヘルスチェック更新（エラー）
    await updateBatchHealthCheck("error", error instanceof Error ? error.message : String(error));
  }
}

/**
 * エントリーポイント
 */
async function main() {
  console.log("🚀 地震情報バッチ処理を開始します");
  console.log(`📡 API: ${DMDATA_API_BASE_URL}`);

  const apiKey = await getDmdataApiKey();
  console.log(`🔑 APIキー: ${apiKey ? "設定済み" : "未設定"}`);
  console.log(`⏱️  実行間隔: 1分ごと\n`);

  // 初回実行
  await processEarthquakes();

  // 1分ごとに実行（cron形式: 毎分0秒）
  cron.schedule("* * * * *", async () => {
    await processEarthquakes();
  });

  console.log("\n✅ スケジューラーを起動しました");
  console.log("💡 Ctrl+C で停止できます\n");
}

// プロセス終了時のクリーンアップ
process.on("SIGINT", async () => {
  console.log("\n\n⏹️  バッチ処理を停止中...");
  await prisma.$disconnect();
  console.log("✅ データベース接続を切断しました");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\n⏹️  バッチ処理を停止中...");
  await prisma.$disconnect();
  console.log("✅ データベース接続を切断しました");
  process.exit(0);
});

// 未処理エラーのハンドリング
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

// 実行
main().catch((error) => {
  console.error("❌ 致命的なエラー:", error);
  process.exit(1);
});
