#!/usr/bin/env node
"use strict";
/**
 * DMData.jp API から1分間隔で地震情報を取得するバッチ処理
 * Docker Composeで実行される常駐プロセス
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const xml2js_1 = require("xml2js");
const dmdataExtractor_1 = require("../src/app/lib/notification/dmdataExtractor");
const encryption_1 = require("../src/app/lib/security/encryption");
const prisma = new client_1.PrismaClient();
const DMDATA_API_BASE_URL = "https://api.dmdata.jp";
/**
 * 有効なAPI Keyをデータベースから取得
 * データベースに登録がない場合は環境変数から取得
 */
async function getDmdataApiKey() {
    try {
        const apiKeyRecord = await prisma.dmdataApiKey.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
        });
        if (apiKeyRecord) {
            try {
                const payload = JSON.parse(apiKeyRecord.apiKey);
                const decrypted = (0, encryption_1.decrypt)(payload);
                if (decrypted) {
                    return decrypted;
                }
            }
            catch (error) {
            }
        }
        const envKey = process.env.DMDATA_API_KEY;
        if (envKey) {
            return envKey;
        }
        return null;
    }
    catch (error) {
        return process.env.DMDATA_API_KEY || null;
    }
}
/**
 * ペイロードのハッシュ値を計算（重複検知用）
 */
function calculatePayloadHash(payload) {
    const payloadString = JSON.stringify(payload);
    return crypto_1.default.createHash("sha256").update(payloadString).digest("hex");
}
/**
 * XMLからTelegramItemに変換
 */
async function parseXmlToTelegramItem(xmlData, meta) {
    try {
        const parsed = await (0, xml2js_1.parseStringPromise)(xmlData, {
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
    }
    catch (error) {
        return null;
    }
}
/**
 * DMData.jp API から地震情報を取得（VXSE51とVXSE53をペアリング）
 */
async function fetchEarthquakes() {
    const DMDATA_API_KEY = await getDmdataApiKey();
    if (!DMDATA_API_KEY) {
        return [];
    }
    try {
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
        // VXSE51を優先的に処理し、VXSE53とペアリング
        const earthquakes = [];
        const processedEventIds = new Set();
        // VXSE51（震度速報）を処理
        for (const meta of vxse51Events) {
            // XML詳細を取得
            const xmlResponse = await axios_1.default.get(meta.url, {
                params: { key: DMDATA_API_KEY },
                timeout: 10000,
                responseType: "text",
            });
            const telegramItem = await parseXmlToTelegramItem(xmlResponse.data, meta);
            if (!telegramItem) {
                continue;
            }
            const info = (0, dmdataExtractor_1.extractEarthquakeInfo)(telegramItem);
            if (!info || !info.maxIntensity) {
                continue;
            }
            // 震度3以上のみ処理
            const intensityNum = intensityToNumeric(info.maxIntensity);
            if (intensityNum < 3.0) {
                continue;
            }
            // 対応するVXSE53を時刻で検索（5分以内）
            const matchingVxse53 = vxse53Events.find((v53) => {
                const timeDiff = Math.abs(new Date(v53.head.time).getTime() - new Date(meta.head.time).getTime());
                return timeDiff < 5 * 60 * 1000;
            });
            if (matchingVxse53) {
                // VXSE53の詳細を取得
                const vxse53XmlResponse = await axios_1.default.get(matchingVxse53.url, {
                    params: { key: DMDATA_API_KEY },
                    timeout: 10000,
                    responseType: "text",
                });
                const vxse53Item = await parseXmlToTelegramItem(vxse53XmlResponse.data, matchingVxse53);
                if (vxse53Item) {
                    const vxse53Info = (0, dmdataExtractor_1.extractEarthquakeInfo)(vxse53Item);
                    if (vxse53Info) {
                        // VXSE53の詳細情報をマージ
                        info.epicenter = vxse53Info.epicenter;
                        info.magnitude = vxse53Info.magnitude;
                        info.depth = vxse53Info.depth;
                        info.prefectureObservations = vxse53Info.prefectureObservations;
                    }
                }
            }
            processedEventIds.add(info.eventId);
            earthquakes.push(info);
        }
        return earthquakes;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.message,
            });
        }
        else {
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
async function saveEarthquakeRecord(info) {
    try {
        // 既存レコードチェック（eventIdで重複確認）
        const existing = await prisma.earthquakeRecord.findFirst({
            where: {
                eventId: info.eventId,
            },
        });
        if (existing) {
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
                rawData: info,
            },
        });
        // 都道府県別震度を保存
        if (info.prefectureObservations && info.prefectureObservations.length > 0) {
            await savePrefectureObservations(record.id, info.prefectureObservations);
        }
        return record.id;
    }
    catch (error) {
        return null;
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
        }
    }
    catch (error) {
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
    }
}
/**
 * バッチヘルスチェックを更新
 * @param status - "running" | "healthy" | "warning" | "error"
 * @param errorMessage - エラーメッセージ（オプション）
 */
async function updateBatchHealthCheck(status, errorMessage) {
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
    }
    catch (error) {
    }
}
/**
 * 最新のヘルスチェック状態を判定
 * 1分ごとに実行されるべきバッチが:
 * - 1分以内に成功 → healthy (緑)
 * - 3分以内に成功 → warning (黄)
 * - 3分以上経過 → error (赤)
 */
async function getBatchHealthStatus() {
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
        }
        else if (elapsedMinutes <= 3) {
            return {
                status: "warning",
                lastRunAt,
                message: `前回実行から${Math.floor(elapsedMinutes)}分経過`,
            };
        }
        else {
            return {
                status: "error",
                lastRunAt,
                message: `前回実行から${Math.floor(elapsedMinutes)}分経過（異常）`,
            };
        }
    }
    catch (error) {
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
        }
    }
    catch (error) {
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
        for (const notification of pendingNotifications) {
            await sendSlackNotification(notification);
        }
    }
    catch (error) {
    }
}
/**
 * Slack通知を送信
 */
async function sendSlackNotification(notification) {
    try {
        // 1. Bot Tokenを復号化
        const { decrypt } = await Promise.resolve().then(() => __importStar(require("../src/app/lib/security/encryption")));
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
        const { extractEarthquakeInfo } = await Promise.resolve().then(() => __importStar(require("../src/app/lib/notification/dmdataExtractor")));
        const earthquakeInfo = extractEarthquakeInfo(notification.earthquakeRecord.rawData);
        if (!earthquakeInfo) {
            throw new Error("地震情報の抽出に失敗");
        }
        // 5. メッセージを生成
        const { buildEarthquakeNotificationMessage } = await Promise.resolve().then(() => __importStar(require("../src/app/lib/slack/messageBuilder")));
        const message = buildEarthquakeNotificationMessage(earthquakeInfo, departments.map((d) => ({
            id: d.id,
            name: d.name,
            slackEmoji: d.slackEmoji,
            buttonColor: d.buttonColor,
        })), template || defaultTemplate);
        // 6. Slack APIでメッセージ送信
        const response = await axios_1.default.post("https://slack.com/api/chat.postMessage", {
            channel: notification.channelId,
            ...message,
        }, {
            headers: {
                Authorization: `Bearer ${botToken}`,
                "Content-Type": "application/json",
            },
        });
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
    }
    catch (error) {
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
    try {
        // ヘルスチェック更新（処理開始）
        await updateBatchHealthCheck("running");
        // 地震情報を取得
        const earthquakes = await fetchEarthquakes();
        if (earthquakes.length === 0) {
            // ヘルスチェック更新（正常終了）
            await updateBatchHealthCheck("healthy");
            // 保留中の通知を処理
            await processPendingNotifications();
            return;
        }
        // 各地震情報を保存
        let savedCount = 0;
        const savedRecords = [];
        for (const info of earthquakes) {
            const recordId = await saveEarthquakeRecord(info);
            if (recordId) {
                savedCount++;
                savedRecords.push({ id: recordId, info });
            }
        }
        // 通知条件チェック
        for (const { id, info } of savedRecords) {
            await findMatchingNotificationConditions(id, info);
        }
        // ヘルスチェック更新（正常終了）
        await updateBatchHealthCheck("healthy");
        // 保留中の通知を処理
        await processPendingNotifications();
    }
    catch (error) {
        // ヘルスチェック更新（エラー）
        await updateBatchHealthCheck("error", error instanceof Error ? error.message : String(error));
    }
}
/**
 * エントリーポイント
 */
async function main() {
    const apiKey = await getDmdataApiKey();
    // 初回実行
    await processEarthquakes();
    // 1分ごとに実行（cron形式: 毎分0秒）
    node_cron_1.default.schedule("* * * * *", async () => {
        await processEarthquakes();
    });
}
// プロセス終了時のクリーンアップ
process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await prisma.$disconnect();
    process.exit(0);
});
// 未処理エラーのハンドリング
process.on("unhandledRejection", (reason, promise) => {
});
// 実行
main().catch((error) => {
    process.exit(1);
});
