#!/usr/bin/env node

/**
 * DMData.jp API から1分間隔で地震情報を取得するバッチ処理
 * Docker Composeで実行される常駐プロセス
 */

import cron from "node-cron";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const DMDATA_API_KEY = process.env.DMDATA_API_KEY;
const DMDATA_API_BASE_URL = "https://api.dmdata.jp";

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
 * DMData.jp API から地震情報を取得
 */
async function fetchEarthquakes(): Promise<EarthquakeEvent[]> {
  if (!DMDATA_API_KEY) {
    console.error("❌ DMDATA_API_KEY が設定されていません");
    return [];
  }

  try {
    console.log("🔍 地震情報を取得中...");
    const response = await axios.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
      params: {
        type: "VXSE53", // 地震情報
        limit: 10,
      },
      headers: {
        Authorization: `Bearer ${DMDATA_API_KEY}`,
      },
      timeout: 30000, // 30秒タイムアウト
    });

    const events = response.data.items || [];
    console.log(`✅ ${events.length}件の地震情報を取得`);
    return events;
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
 * イベントをデータベースに保存（重複チェック付き）
 */
async function saveEvent(event: EarthquakeEvent): Promise<boolean> {
  const payloadHash = calculatePayloadHash(event);

  try {
    // 重複チェック
    const existing = await prisma.earthquakeEventLog.findUnique({
      where: {
        eventId_payloadHash: {
          eventId: event.eventId,
          payloadHash: payloadHash,
        },
      },
    });

    if (existing) {
      console.log(`⏭️  スキップ（既存）: ${event.eventId}`);
      return false;
    }

    // 新規保存
    await prisma.earthquakeEventLog.create({
      data: {
        eventId: event.eventId,
        payloadHash: payloadHash,
        source: "rest",
        payload: event as any,
        fetchedAt: new Date(),
      },
    });

    console.log(`💾 保存成功: ${event.eventId} - ${event.title}`);
    return true;
  } catch (error: any) {
    console.error(`❌ DB保存エラー (${event.eventId}):`, error.message);
    return false;
  }
}

/**
 * 通知条件に合致するかチェック
 * TODO: 実際の通知条件フィルタリングロジックを実装
 */
async function shouldNotify(event: EarthquakeEvent): Promise<boolean> {
  // TODO: SlackNotificationSettingテーブルから設定を取得
  // TODO: 震度・都道府県の条件チェック
  // 現状は常にfalse（通知しない）
  return false;
}

/**
 * Slack通知を送信
 * TODO: 実際のSlack通知ロジックを実装
 */
async function sendSlackNotification(event: EarthquakeEvent): Promise<void> {
  // TODO: Slackワークスペース情報を取得
  // TODO: Bot Tokenを復号化
  // TODO: Slack APIでメッセージ送信
  console.log(`📢 Slack通知（未実装）: ${event.eventId}`);
}

/**
 * メイン処理：地震情報を取得・保存・通知
 */
async function processEarthquakes() {
  console.log("\n" + "=".repeat(60));
  console.log(`⏰ 実行時刻: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  try {
    // 地震情報を取得
    const events = await fetchEarthquakes();

    if (events.length === 0) {
      console.log("ℹ️  新しい地震情報はありません");
      return;
    }

    // 各イベントを処理
    let savedCount = 0;
    for (const event of events) {
      const saved = await saveEvent(event);

      if (saved) {
        savedCount++;

        // 通知条件チェック
        const notify = await shouldNotify(event);
        if (notify) {
          await sendSlackNotification(event);
        }
      }
    }

    console.log(`\n📊 処理結果: ${savedCount}件の新規イベントを保存`);
  } catch (error) {
    console.error("❌ 処理中にエラーが発生:", error);
  }
}

/**
 * エントリーポイント
 */
async function main() {
  console.log("🚀 地震情報バッチ処理を開始します");
  console.log(`📡 API: ${DMDATA_API_BASE_URL}`);
  console.log(`🔑 APIキー: ${DMDATA_API_KEY ? "設定済み" : "未設定"}`);
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
