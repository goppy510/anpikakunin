import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { decrypt } from "@/app/lib/security/encryption";
import {
  buildTrainingNotificationMessage,
  type Department,
  type MessageTemplate,
} from "@/app/lib/slack/messageBuilder";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, channelId, scheduledAt } = body;

    if (!workspaceId || !channelId) {
      return NextResponse.json(
        { error: "workspaceIdとchannelIdは必須です" },
        { status: 400 }
      );
    }

    // ワークスペース情報を取得
    const workspace = await prisma.slackWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    // 部署情報を取得
    const departments = await prisma.department.findMany({
      where: { workspaceRef: workspaceId, isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    if (departments.length === 0) {
      return NextResponse.json(
        { error: "部署が設定されていません" },
        { status: 400 }
      );
    }

    // 訓練用メッセージテンプレートを取得
    const template = await prisma.messageTemplate.findFirst({
      where: {
        workspaceRef: workspaceId,
        type: "TRAINING",
        isActive: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "訓練用メッセージテンプレートが見つかりません" },
        { status: 404 }
      );
    }

    // 訓練通知レコードを作成
    const trainingNotification = await prisma.trainingNotification.create({
      data: {
        workspaceId,
        channelId,
        notificationStatus: scheduledAt ? "pending" : "pending",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    // スケジュール送信の場合はここで終了（別途cronで処理）
    if (scheduledAt) {
      return NextResponse.json({
        success: true,
        notificationId: trainingNotification.id,
        message: "訓練通知をスケジュールしました",
      });
    }

    // 即座に送信する場合
    try {
      // Bot Tokenを復号化
      const botToken = decrypt({
        ciphertext: Buffer.from(workspace.botTokenCiphertext, "base64"),
        iv: Buffer.from(workspace.botTokenIv, "base64"),
        tag: Buffer.from(workspace.botTokenTag, "base64"),
      });

      // メッセージを作成
      const message = buildTrainingNotificationMessage(
        departments.map((d) => ({
          id: d.id,
          name: d.name,
          slackEmoji: d.slackEmoji,
          buttonColor: d.buttonColor,
        })),
        {
          title: template.title,
          body: template.body,
        }
      );

      // Slackに送信
      const slackResponse = await axios.post(
        "https://slack.com/api/chat.postMessage",
        {
          channel: channelId,
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
        where: { id: trainingNotification.id },
        data: {
          notificationStatus: "sent",
          messageTs: slackResponse.data.ts,
          notifiedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        notificationId: trainingNotification.id,
        messageTs: slackResponse.data.ts,
        message: "訓練通知を送信しました",
      });
    } catch (slackError: any) {
      console.error("Slack送信エラー:", slackError);

      // エラーステータスを更新
      await prisma.trainingNotification.update({
        where: { id: trainingNotification.id },
        data: {
          notificationStatus: "failed",
          errorMessage: slackError.message || "送信に失敗しました",
        },
      });

      return NextResponse.json(
        {
          error: "訓練通知の送信に失敗しました",
          details: slackError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("訓練通知APIエラー:", error);
    return NextResponse.json(
      { error: "訓練通知の処理に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
