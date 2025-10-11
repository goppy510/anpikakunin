import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import axios from "axios";
import { prisma } from "@/app/lib/db/prisma";

// Slack署名検証用の関数
function verifySlackSignature(
  body: string,
  signature: string,
  timestamp: string,
  signingSecret: string
): boolean {
  const time = Math.floor(new Date().getTime() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    return false; // リクエストが5分以上古い場合は無効
  }

  const sigBasestring = "v0:" + timestamp + ":" + body;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBasestring, "utf8")
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(signature, "utf8")
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Slack署名検証（本番環境では必須）
    const slackSignature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (signingSecret && slackSignature && timestamp) {
      if (!verifySlackSignature(body, slackSignature, timestamp, signingSecret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // URLエンコードされたペイロードをパース
    const payload = JSON.parse(decodeURIComponent(body.replace("payload=", "")));

    // ボタンクリック処理
    if (payload.type === "block_actions" && payload.actions?.[0]) {
      const action = payload.actions[0];
      const user = payload.user;
      const message = payload.message;

      // 訓練用安否確認ボタンかチェック
      if (action.action_id?.startsWith("training_confirm_")) {
        const departmentId = action.action_id.replace("training_confirm_", "");

        // message_tsから訓練通知を特定
        const trainingNotification = await prisma.trainingNotification.findFirst({
          where: {
            messageTs: message.ts,
            notificationStatus: "sent",
          },
        });

        if (!trainingNotification) {
          return NextResponse.json({
            response_type: "ephemeral",
            text: "⚠️ 訓練通知が見つかりません",
          });
        }

        // 既に回答済みかチェック
        const existingResponse = await prisma.trainingConfirmationResponse.findUnique({
          where: {
            trainingNotificationId_slackUserId: {
              trainingNotificationId: trainingNotification.id,
              slackUserId: user.id,
            },
          },
          include: {
            department: true,
          },
        });

        if (existingResponse) {
          // 重複回答の場合、エフェメラルメッセージを返す
          return NextResponse.json({
            response_type: "ephemeral",
            text: `⚠️ これはあなただけに表示されたメッセージです\n\n✅ あなたは既に回答済みです\n\n*部署:* ${existingResponse.department.name}\n*ユーザー名:* ${user.profile?.real_name || user.name}\n*回答時刻:* ${new Date(existingResponse.respondedAt).toLocaleString("ja-JP")}`,
          });
        }

        // 部署情報を取得
        const department = await prisma.department.findUnique({
          where: { id: departmentId },
        });

        if (!department) {
          return NextResponse.json({
            response_type: "ephemeral",
            text: "⚠️ 部署が見つかりません",
          });
        }

        // 新規回答を記録
        await prisma.trainingConfirmationResponse.create({
          data: {
            trainingNotificationId: trainingNotification.id,
            slackUserId: user.id,
            slackUserName: user.profile?.real_name || user.name,
            departmentId: departmentId,
          },
        });

        // 各部署の回答数を取得
        const responseCounts = await prisma.trainingConfirmationResponse.groupBy({
          by: ["departmentId"],
          where: {
            trainingNotificationId: trainingNotification.id,
          },
          _count: {
            departmentId: true,
          },
        });

        // 部署一覧と回答数を取得
        const departments = await prisma.department.findMany({
          where: {
            workspaceRef: trainingNotification.workspaceId,
            isActive: true,
          },
          orderBy: { displayOrder: "asc" },
        });

        // メッセージテンプレートを取得
        const template = await prisma.messageTemplate.findFirst({
          where: {
            workspaceRef: trainingNotification.workspaceId,
            type: "TRAINING",
            isActive: true,
          },
        });

        if (template && trainingNotification.messageTs) {
          // カウントマップを作成
          const countMap = new Map(
            responseCounts.map((r) => [r.departmentId, r._count.departmentId])
          );

          // テンプレート変数を置換
          const now = new Date();
          const replacedTitle = template.title
            .replace(/\{\{epicenter\}\}/g, "訓練")
            .replace(/\{\{maxIntensity\}\}/g, "訓練")
            .replace(/\{\{occurrenceTime\}\}/g, now.toLocaleString("ja-JP"))
            .replace(/\{\{magnitude\}\}/g, "0.0")
            .replace(/\{\{depth\}\}/g, "0km")
            .replace(/\{\{infoType\}\}/g, "訓練");

          const replacedBody = template.body
            .replace(/\{\{epicenter\}\}/g, "訓練")
            .replace(/\{\{maxIntensity\}\}/g, "訓練")
            .replace(/\{\{occurrenceTime\}\}/g, now.toLocaleString("ja-JP"))
            .replace(/\{\{magnitude\}\}/g, "0.0")
            .replace(/\{\{depth\}\}/g, "0km")
            .replace(/\{\{infoType\}\}/g, "訓練");

          // ボタンを更新（絵文字と回答数のみ表示）
          const departmentButtons = departments.map((dept) => {
            const count = countMap.get(dept.id) || 0;
            return {
              type: "button",
              text: {
                type: "plain_text",
                text: count > 0 ? `${dept.slackEmoji} (${count})` : dept.slackEmoji,
                emoji: true,
              },
              style: dept.buttonColor === "#FF6B6B" ? "danger" : dept.buttonColor === "#51CF66" ? "primary" : undefined,
              value: dept.id,
              action_id: `training_confirm_${dept.id}`,
            };
          });

          // Slackメッセージを更新
          const workspace = await prisma.slackWorkspace.findUnique({
            where: { id: trainingNotification.workspaceId },
          });

          if (workspace) {
            const { decrypt } = await import("@/app/lib/security/encryption");
            const botToken = decrypt({
              ciphertext: workspace.botTokenCiphertext,
              iv: workspace.botTokenIv,
              authTag: workspace.botTokenTag,
            });

            await axios.post(
              "https://slack.com/api/chat.update",
              {
                channel: trainingNotification.channelId,
                ts: trainingNotification.messageTs,
                blocks: [
                  {
                    type: "header",
                    text: {
                      type: "plain_text",
                      text: `🎓 ${replacedTitle}`,
                      emoji: true,
                    },
                  },
                  {
                    type: "section",
                    text: { type: "mrkdwn", text: replacedBody },
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
              },
              {
                headers: {
                  Authorization: `Bearer ${botToken}`,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        }

        // 成功メッセージを返す（エフェメラル）
        return NextResponse.json({
          response_type: "ephemeral",
          text: `⚠️ これはあなただけに表示されたメッセージです\n\n✅ 訓練の安否確認を受け付けました\n\n*部署:* ${department.name}\n*ユーザー名:* ${user.profile?.real_name || user.name}\n*回答時刻:* ${new Date().toLocaleString("ja-JP")}\n\n🎓 これは訓練です`,
        });
      }
    }

    // その他のインタラクション
    return NextResponse.json({
      response_type: "ephemeral",
      text: "インタラクションを処理しました",
    });
  } catch (error) {
    console.error("訓練用Slack interaction処理エラー:", error);
    return NextResponse.json(
      { error: "インタラクション処理に失敗しました" },
      { status: 500 }
    );
  }
}
