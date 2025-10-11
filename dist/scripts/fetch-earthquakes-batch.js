#!/usr/bin/env node
"use strict";
/**
 * DMData.jp API から1分間隔で地震情報を取得するバッチ処理
 * Docker Composeで実行される常駐プロセス
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const dmdataExtractor_1 = require("../src/app/lib/notification/dmdataExtractor");
const prisma = new client_1.PrismaClient();
const DMDATA_API_KEY = process.env.DMDATA_API_KEY;
const DMDATA_API_BASE_URL = "https://api.dmdata.jp";
/**
 * ペイロードのハッシュ値を計算（重複検知用）
 */
function calculatePayloadHash(payload) {
    const payloadString = JSON.stringify(payload);
    return crypto_1.default.createHash("sha256").update(payloadString).digest("hex");
}
/**
 * DMData.jp API から地震情報を取得（VXSE51とVXSE53の両方）
 */
async function fetchEarthquakes() {
    if (!DMDATA_API_KEY) {
        console.error("❌ DMDATA_API_KEY が設定されていません");
        return [];
    }
    try {
        console.log("🔍 地震情報を取得中...");
        // VXSE51（震度速報）とVXSE53（震源・震度情報）を並行取得
        const [vxse51Response, vxse53Response] = await Promise.all([
            axios_1.default.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
                params: {
                    type: "VXSE51",
                    limit: 10,
                    key: DMDATA_API_KEY,
                },
                timeout: 30000,
            }),
            axios_1.default.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
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
        const allEvents = [...vxse51Events, ...vxse53Events];
        console.log(`✅ VXSE51: ${vxse51Events.length}件, VXSE53: ${vxse53Events.length}件 (合計: ${allEvents.length}件)`);
        return allEvents;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            console.error("❌ DMData.jp API エラー:", {
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.message,
            });
        }
        else {
            console.error("❌ 予期しないエラー:", error);
        }
        return [];
    }
}
/**
 * 震度を数値に変換（比較用）
 */
function intensityToNumeric(intensity) {
    const map = {
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
async function saveEvent(item) {
    const payloadHash = calculatePayloadHash(item);
    const eventId = item.head.eventID || item.id;
    try {
        // 旧形式のログテーブルへの保存（重複チェック用）
        const existing = await prisma.earthquakeEventLog.findUnique({
            where: {
                eventId_payloadHash: {
                    eventId: eventId,
                    payloadHash: payloadHash,
                },
            },
        });
        if (existing) {
            console.log(`⏭️  スキップ（既存）: ${eventId}`);
            return false;
        }
        // 旧形式のログ保存
        await prisma.earthquakeEventLog.create({
            data: {
                eventId: eventId,
                payloadHash: payloadHash,
                source: "rest",
                payload: item,
                fetchedAt: new Date(),
            },
        });
        // 地震情報を抽出
        const info = (0, dmdataExtractor_1.extractEarthquakeInfo)(item);
        if (!info || !info.maxIntensity) {
            console.log(`⏭️  スキップ（震度情報なし）: ${eventId}`);
            return true;
        }
        // 震度3以上のみ earthquake_records に保存
        const intensityNumeric = intensityToNumeric(info.maxIntensity);
        if (intensityNumeric < 3.0) {
            console.log(`⏭️  スキップ（震度3未満）: ${eventId} - 震度${info.maxIntensity}`);
            return true;
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
                rawData: item,
            },
        });
        console.log(`💾 地震記録保存: ${eventId} - ${info.title} (震度${info.maxIntensity})`);
        // 都道府県別震度を保存
        if (info.prefectureObservations && info.prefectureObservations.length > 0) {
            await savePrefectureObservations(record.id, info.prefectureObservations);
        }
        return true;
    }
    catch (error) {
        console.error(`❌ DB保存エラー (${eventId}):`, error.message);
        return false;
    }
}
/**
 * 都道府県別震度観測データを保存
 */
async function savePrefectureObservations(earthquakeRecordId, observations) {
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
            .filter((obs) => obs !== null);
        if (observationsToCreate.length > 0) {
            await prisma.earthquakePrefectureObservation.createMany({
                data: observationsToCreate,
                skipDuplicates: true,
            });
            console.log(`  ✅ 都道府県別震度: ${observationsToCreate.length}件保存`);
        }
    }
    catch (error) {
        console.error(`❌ 都道府県別震度保存エラー:`, error.message);
    }
}
/**
 * 通知条件に合致する設定を検索
 */
async function findMatchingNotificationConditions(earthquakeRecordId, earthquakeInfo) {
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
            const targetPrefectures = condition.targetPrefectures;
            if (targetPrefectures && targetPrefectures.length > 0) {
                const observedPrefectures = earthquakeInfo.prefectureObservations.map((obs) => obs.prefecture);
                const hasMatch = targetPrefectures.some((target) => observedPrefectures.includes(target));
                if (!hasMatch) {
                    continue;
                }
            }
            // 条件に合致したので通知レコードを作成
            await createNotificationRecord(earthquakeRecordId, condition);
        }
    }
    catch (error) {
        console.error(`❌ 通知条件マッチングエラー:`, error.message);
    }
}
/**
 * 通知レコードを作成
 */
async function createNotificationRecord(earthquakeRecordId, condition) {
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
            console.warn(`  ⚠️  通知チャンネルが設定されていません: ${condition.workspace.name}`);
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
            console.log(`  ✅ 通知レコード作成: ${condition.workspace.name} -> #${channel.channelName}`);
        }
    }
    catch (error) {
        console.error(`❌ 通知レコード作成エラー:`, error.message);
    }
}
/**
 * 保留中の通知を送信
 */
async function processPendingNotifications() {
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
    }
    catch (error) {
        console.error(`❌ 通知処理エラー:`, error.message);
    }
}
/**
 * Slack通知を送信
 */
async function sendSlackNotification(notification) {
    // TODO: Slackワークスペース情報を取得
    // TODO: Bot Tokenを復号化
    // TODO: メッセージテンプレートを取得
    // TODO: Slack APIでメッセージ送信
    console.log(`  📢 Slack通知（未実装）: ${notification.workspace.name} -> ${notification.channelId}`);
    // とりあえず送信済みに更新
    await prisma.earthquakeNotification.update({
        where: { id: notification.id },
        data: {
            notificationStatus: "sent",
            notifiedAt: new Date(),
        },
    });
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
            // 保留中の通知を処理
            await processPendingNotifications();
            return;
        }
        // 各イベントを処理
        let savedCount = 0;
        const savedRecords = [];
        for (const event of events) {
            const saved = await saveEvent(event);
            if (saved) {
                savedCount++;
                // 地震情報を抽出して保存したレコードIDを取得
                const info = (0, dmdataExtractor_1.extractEarthquakeInfo)(event);
                if (info && info.maxIntensity) {
                    const intensityNumeric = intensityToNumeric(info.maxIntensity);
                    if (intensityNumeric >= 3.0) {
                        // 保存した earthquake_record のIDを取得
                        const record = await prisma.earthquakeRecord.findFirst({
                            where: {
                                eventId: info.eventId,
                            },
                            orderBy: {
                                createdAt: "desc",
                            },
                        });
                        if (record) {
                            savedRecords.push({ id: record.id, info });
                        }
                    }
                }
            }
        }
        console.log(`\n📊 処理結果: ${savedCount}件の新規イベントを保存`);
        // 通知条件チェック
        for (const { id, info } of savedRecords) {
            await findMatchingNotificationConditions(id, info);
        }
        // 保留中の通知を処理
        await processPendingNotifications();
    }
    catch (error) {
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
    node_cron_1.default.schedule("* * * * *", async () => {
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
