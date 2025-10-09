/**
 * IndexedDB から PostgreSQL への設定移行API
 *
 * クライアントサイドで保存されている安否確認設定を
 * PostgreSQL（暗号化してSlackトークンを保存）に移行する
 */

import { NextResponse } from "next/server";
import { upsertSlackWorkspaceWithSettings } from "@/app/lib/db/slackSettings";
import type { SafetyConfirmationConfig } from "@/app/components/safety-confirmation/types/SafetyConfirmationTypes";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { config: SafetyConfirmationConfig };

    if (!body?.config) {
      return NextResponse.json(
        { error: "config is required" },
        { status: 400 }
      );
    }

    const { config } = body;
    const results = {
      success: [] as string[],
      failed: [] as Array<{ workspaceId: string; error: string }>,
    };

    // 各ワークスペースをPostgreSQLに移行
    for (const workspace of config.slack.workspaces) {
      try {
        // BotTokenがない場合はスキップ
        if (!workspace.botToken) {
          results.failed.push({
            workspaceId: workspace.id,
            error: "Bot Token is missing",
          });
          continue;
        }

        // 通知チャンネル情報を収集
        const workspaceChannels = config.slack.channels.filter(
          (ch) => ch.workspaceId === workspace.id
        );

        // 都道府県コードを都道府県名に変換
        const targetPrefectures = workspace.conditions.targetPrefectures.map(
          (code) => {
            // コードから名前を取得（例: "13" → "東京都"）
            const prefMap: Record<string, string> = {
              "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県",
              "05": "秋田県", "06": "山形県", "07": "福島県", "08": "茨城県",
              "09": "栃木県", "10": "群馬県", "11": "埼玉県", "12": "千葉県",
              "13": "東京都", "14": "神奈川県", "15": "新潟県", "16": "富山県",
              "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
              "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県",
              "25": "滋賀県", "26": "京都府", "27": "大阪府", "28": "兵庫県",
              "29": "奈良県", "30": "和歌山県", "31": "鳥取県", "32": "島根県",
              "33": "岡山県", "34": "広島県", "35": "山口県", "36": "徳島県",
              "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
              "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県",
              "45": "宮崎県", "46": "鹿児島県", "47": "沖縄県",
            };
            return prefMap[code] || code;
          }
        );

        // 震度を文字列に変換（例: 3 → "3", 5.0 → "5弱"）
        const intensityMap: Record<number, string> = {
          0: "0", 1: "1", 2: "2", 3: "3", 4: "4",
          5.0: "5弱", 5.5: "5強",
          6.0: "6弱", 6.5: "6強",
          7: "7",
        };
        const minIntensity = intensityMap[workspace.conditions.minIntensity] ||
                            String(workspace.conditions.minIntensity);

        // PostgreSQLに保存
        await upsertSlackWorkspaceWithSettings(
          {
            workspaceId: workspace.id,
            name: workspace.name,
            botToken: workspace.botToken,
            isEnabled: workspace.isEnabled,
          },
          {
            workspaceId: workspace.id,
            minIntensity: minIntensity,
            targetPrefectures: targetPrefectures,
            notificationChannels: workspaceChannels.map((ch) => ({
              channelId: ch.channelId,
              channelName: ch.channelName,
              channelType: ch.channelType,
            })),
            extraSettings: {
              departments: workspace.departments,
              template: workspace.template,
              conditions: {
                enableMentions: workspace.conditions.enableMentions,
                mentionTargets: workspace.conditions.mentionTargets,
                notificationType: workspace.conditions.notificationType,
              },
            },
          }
        );

        results.success.push(workspace.id);
      } catch (error) {
        console.error(`Failed to migrate workspace ${workspace.id}:`, error);
        results.failed.push({
          workspaceId: workspace.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: "Migration completed",
      results: {
        total: config.slack.workspaces.length,
        success: results.success.length,
        failed: results.failed.length,
      },
      details: results,
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
