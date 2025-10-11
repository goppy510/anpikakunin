import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
            text: `✅ あなたは既に回答済みです\n\n*部署:* ${existingResponse.department.name}\n*回答時刻:* ${new Date(existingResponse.respondedAt).toLocaleString("ja-JP")}`,
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

        // 成功メッセージを返す（エフェメラル）
        return NextResponse.json({
          response_type: "ephemeral",
          text: `✅ 訓練の安否確認を受け付けました\n\n*部署:* ${department.name}\n*回答時刻:* ${new Date().toLocaleString("ja-JP")}\n\n🎓 これは訓練です`,
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
