"use strict";
/**
 * Slack通知メッセージビルダー
 * 地震情報から部署ボタン付きメッセージを生成
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEarthquakeNotificationMessage = buildEarthquakeNotificationMessage;
exports.buildUpdatedMessageWithStats = buildUpdatedMessageWithStats;
exports.buildTrainingNotificationMessage = buildTrainingNotificationMessage;
/**
 * 地震通知メッセージを作成
 * @param earthquake 地震情報
 * @param departments 部署リスト
 * @param template メッセージテンプレート
 * @returns Slack Block Kit形式のメッセージ
 */
function buildEarthquakeNotificationMessage(earthquake, departments, template) {
    // タイトル部分
    const titleText = template.title
        .replace("{maxIntensity}", earthquake.maxIntensity || "不明")
        .replace("{epicenter}", earthquake.epicenter || "不明")
        .replace("{magnitude}", earthquake.magnitude?.toString() || "不明")
        .replace("{depth}", earthquake.depth || "不明")
        .replace("{occurrenceTime}", earthquake.occurrenceTime
        ? new Date(earthquake.occurrenceTime).toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "不明");
    // 本文部分
    const bodyText = template.body
        .replace("{maxIntensity}", earthquake.maxIntensity || "不明")
        .replace("{epicenter}", earthquake.epicenter || "不明")
        .replace("{magnitude}", earthquake.magnitude?.toString() || "不明")
        .replace("{depth}", earthquake.depth || "不明")
        .replace("{occurrenceTime}", earthquake.occurrenceTime
        ? new Date(earthquake.occurrenceTime).toLocaleString("ja-JP")
        : "不明");
    // 都道府県別震度情報
    const prefectureText = earthquake.prefectureObservations && earthquake.prefectureObservations.length > 0
        ? earthquake.prefectureObservations
            .map((obs) => `${obs.prefecture}: 震度${obs.maxIntensity}`)
            .join("\n")
        : "情報なし";
    // 部署ボタンを生成（絵文字のみ）
    const departmentButtons = departments.map((dept) => ({
        type: "button",
        text: {
            type: "plain_text",
            text: dept.slackEmoji,
            emoji: true,
        },
        style: getButtonStyle(dept.buttonColor),
        value: dept.id,
        action_id: `safety_confirm_${dept.id}`,
    }));
    // Block Kit形式のメッセージ
    return {
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: titleText,
                    emoji: true,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*📍 震源地:* ${earthquake.epicenter || "不明"}\n*📊 マグニチュード:* ${earthquake.magnitude || "不明"}\n*🕐 深さ:* ${earthquake.depth || "不明"}\n*⏰ 発生時刻:* ${earthquake.occurrenceTime
                        ? new Date(earthquake.occurrenceTime).toLocaleString("ja-JP")
                        : "不明"}`,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*各地の震度*\n\`\`\`\n${prefectureText}\n\`\`\``,
                },
            },
            {
                type: "divider",
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: bodyText,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*👇 安否確認（該当部署のボタンを押してください）*",
                },
            },
            {
                type: "actions",
                elements: departmentButtons,
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "⚠️ 一人一回のみ回答可能です",
                    },
                ],
            },
        ],
    };
}
/**
 * ボタンの色をSlackのスタイルに変換
 */
function getButtonStyle(color) {
    if (color.toLowerCase().includes("blue"))
        return "primary";
    if (color.toLowerCase().includes("red"))
        return "danger";
    return undefined;
}
/**
 * 安否確認の集計結果を追加したメッセージを作成
 */
function buildUpdatedMessageWithStats(originalMessage, stats) {
    const blocks = [...originalMessage.blocks];
    // 既存の統計セクションを削除（あれば）
    const statsIndex = blocks.findIndex((block) => block.block_id === "safety_stats");
    if (statsIndex !== -1) {
        blocks.splice(statsIndex, 1);
    }
    // 新しい統計セクションを追加
    const statsText = Object.entries(stats)
        .map(([deptId, count]) => `部署${deptId}: ${count}名`)
        .join(" | ");
    blocks.splice(blocks.length - 1, 0, {
        type: "section",
        block_id: "safety_stats",
        text: {
            type: "mrkdwn",
            text: `*📊 回答状況:* ${statsText}`,
        },
    });
    return { blocks };
}
/**
 * 訓練用メッセージを作成
 * @param departments 部署リスト
 * @param template メッセージテンプレート（訓練用）
 * @returns Slack Block Kit形式のメッセージ
 */
function buildTrainingNotificationMessage(departments, template) {
    // 部署ボタンを生成（絵文字のみ）
    const departmentButtons = departments.map((dept) => ({
        type: "button",
        text: {
            type: "plain_text",
            text: dept.slackEmoji,
            emoji: true,
        },
        style: getButtonStyle(dept.buttonColor),
        value: dept.id,
        action_id: `training_confirm_${dept.id}`,
    }));
    // Block Kit形式のメッセージ
    return {
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `🎓 ${template.title}`,
                    emoji: true,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: template.body,
                },
            },
            {
                type: "divider",
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*👇 安否確認（該当部署のボタンを押してください）*",
                },
            },
            {
                type: "actions",
                elements: departmentButtons,
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "⚠️ 一人一回のみ回答可能です｜🎓 これは訓練です",
                    },
                ],
            },
        ],
    };
}
