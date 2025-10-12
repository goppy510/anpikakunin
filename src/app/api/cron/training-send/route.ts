import { NextRequest, NextResponse } from "next/server";
import { env } from "@/app/lib/env";
import { prisma } from "@/app/lib/db/prisma";
import { decrypt } from "@/app/lib/security/encryption";
import {
  buildTrainingNotificationMessage,
  type Department,
  type MessageTemplate,
} from "@/app/lib/slack/messageBuilder";
import axios from "axios";

/**
 * cron-job.org から呼ばれるエンドポイント
 * 訓練通知を指定時刻に送信する
 */

// Bearer Token認証チェック
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.CRON_SECRET;

  if (!cronSecret) {
    console.warn(
      "⚠️ CRON_SECRET is not configured. This endpoint is unprotected!"
    );
    return process.env.NODE_ENV === "development";
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === cronSecret;
}

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    if (!isAuthorized(request)) {
      console.error("❌ Unauthorized access to /api/cron/training-send");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // trainingId をクエリパラメータから取得
    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get("trainingId");

    if (!trainingId) {
      return NextResponse.json(
        { error: "trainingId is required" },
        { status: 400 }
      );
    }

    console.log(`🎓 [Cron Training] Executing training: ${trainingId}`);

    // 訓練通知レコードを取得
    const trainingNotification = await prisma.trainingNotification.findUnique({
      where: { id: trainingId },
    });

    if (!trainingNotification) {
      console.error(`❌ Training notification not found: ${trainingId}`);
      return NextResponse.json(
        { error: "Training notification not found" },
        { status: 404 }
      );
    }

    // 既に送信済みの場合はスキップ
    if (trainingNotification.notificationStatus === "sent") {
      console.log(`⚠️ Training already sent: ${trainingId}`);
      return NextResponse.json({
        success: true,
        message: "Training notification already sent",
        skipped: true,
      });
    }

    // ワークスペース情報を取得
    const workspace = await prisma.slackWorkspace.findUnique({
      where: { id: trainingNotification.workspaceId },
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // 部署情報を取得
    const departments = await prisma.department.findMany({
      where: { workspaceRef: trainingNotification.workspaceId, isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    if (departments.length === 0) {
      throw new Error("No active departments found");
    }

    // 訓練用メッセージテンプレートを取得
    const template = await prisma.messageTemplate.findFirst({
      where: {
        workspaceRef: trainingNotification.workspaceId,
        type: "TRAINING",
        isActive: true,
      },
    });

    if (!template) {
      throw new Error("Training message template not found");
    }

    // Bot Tokenを復号化
    const botToken = decrypt({
      ciphertext: workspace.botTokenCiphertext,
      iv: workspace.botTokenIv,
      authTag: workspace.botTokenTag,
    });

    // テンプレート変数を置換（訓練モード用）
    const now = new Date();
    const replacedTitle = template.title
      .replace(/\{\{epicenter\}\}/g, "訓練震源地")
      .replace(/\{\{maxIntensity\}\}/g, "訓練震度")
      .replace(/\{\{occurrenceTime\}\}/g, now.toLocaleString("ja-JP"))
      .replace(/\{\{magnitude\}\}/g, "M6.5（訓練）")
      .replace(/\{\{depth\}\}/g, "10km（訓練）")
      .replace(/\{\{infoType\}\}/g, "訓練");

    const replacedBody = template.body
      .replace(/\{\{epicenter\}\}/g, "訓練震源地")
      .replace(/\{\{maxIntensity\}\}/g, "訓練震度")
      .replace(/\{\{occurrenceTime\}\}/g, now.toLocaleString("ja-JP"))
      .replace(/\{\{magnitude\}\}/g, "M6.5（訓練）")
      .replace(/\{\{depth\}\}/g, "10km（訓練）")
      .replace(/\{\{infoType\}\}/g, "訓練");

    // メッセージを作成
    const message = buildTrainingNotificationMessage(
      departments.map((d) => ({
        id: d.id,
        name: d.name,
        slackEmoji: d.slackEmoji,
        buttonColor: d.buttonColor,
      })),
      {
        title: replacedTitle,
        body: replacedBody,
      }
    );

    // Slackに送信
    const slackResponse = await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: trainingNotification.channelId,
        ...message,
      },
      {
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!slackResponse.data.ok) {
      throw new Error(slackResponse.data.error || "Slack送信に失敗しました");
    }

    // 通知ステータスを更新
    await prisma.trainingNotification.update({
      where: { id: trainingId },
      data: {
        notificationStatus: "sent",
        messageTs: slackResponse.data.ts,
        notifiedAt: new Date(),
      },
    });

    console.log(`✅ [Cron Training] Successfully sent: ${trainingId}`);

    return NextResponse.json({
      success: true,
      message: "Training notification sent successfully",
      trainingId,
      messageTs: slackResponse.data.ts,
    });
  } catch (error: any) {
    console.error("❌ [Cron Training] Error:", error);

    // エラーステータスを更新（trainingIdがある場合）
    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get("trainingId");

    if (trainingId) {
      try {
        await prisma.trainingNotification.update({
          where: { id: trainingId },
          data: {
            notificationStatus: "failed",
            errorMessage: error.message || "送信に失敗しました",
          },
        });
      } catch (updateError) {
        console.error("Failed to update error status:", updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send training notification",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
