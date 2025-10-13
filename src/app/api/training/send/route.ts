import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { decrypt } from "@/app/lib/security/encryption";
import {
  buildTrainingNotificationMessage,
  type Department,
  type MessageTemplate,
} from "@/app/lib/slack/messageBuilder";
import { CronJobOrgClient } from "@/app/lib/cron/cronjobOrgClient";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, channelId, scheduledAt, earthquakeInfo } = body;

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

    // スケジュール送信の場合: EventBridge Scheduler にジョブを登録
    if (scheduledAt) {
      try {
        // EventBridge Schedulerに登録
        const scheduleDate = new Date(scheduledAt);
        const scheduleExpression = `at(${scheduleDate.toISOString().slice(0, 19)})`;
        const scheduleName = `training-${trainingNotification.id}`;

        const scheduleResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8080'}/api/training/schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": "admin123", // TODO: 実際の認証に置き換える
          },
          body: JSON.stringify({
            trainingId: trainingNotification.id,
            scheduleExpression,
            scheduleName,
            timezone: "Asia/Tokyo",
          }),
        });

        if (!scheduleResponse.ok) {
          throw new Error("EventBridge Schedulerの登録に失敗しました");
        }

        const scheduleData = await scheduleResponse.json();

        return NextResponse.json({
          success: true,
          notificationId: trainingNotification.id,
          scheduleName: scheduleData.scheduleName,
          message: "訓練通知をスケジュールしました（EventBridge Scheduler）",
        });
      } catch (scheduleError: any) {
        console.error("EventBridge Scheduler registration failed:", scheduleError);

        // EventBridge登録失敗時はレコードを削除
        await prisma.trainingNotification.delete({
          where: { id: trainingNotification.id },
        });

        return NextResponse.json(
          {
            error: "EventBridge Schedulerの登録に失敗しました",
            details: scheduleError.message,
          },
          { status: 500 }
        );
      }
    }

    // 即座に送信する場合
    try {
      // Bot Tokenを復号化
      const botToken = decrypt({
        ciphertext: workspace.botTokenCiphertext,
        iv: workspace.botTokenIv,
        authTag: workspace.botTokenTag,
      });

      // テンプレート変数を置換（訓練モード用）
      const now = new Date();
      const replacedTitle = template.title
        .replace(/\{\{epicenter\}\}/g, earthquakeInfo?.epicenter || "訓練")
        .replace(/\{\{maxIntensity\}\}/g, earthquakeInfo?.maxIntensity || "訓練")
        .replace(/\{\{occurrenceTime\}\}/g, now.toLocaleString("ja-JP"))
        .replace(/\{\{magnitude\}\}/g, earthquakeInfo?.magnitude || "M0.0")
        .replace(/\{\{depth\}\}/g, earthquakeInfo?.depth || "0km")
        .replace(/\{\{infoType\}\}/g, "訓練");

      const replacedBody = template.body
        .replace(/\{\{epicenter\}\}/g, earthquakeInfo?.epicenter || "訓練")
        .replace(/\{\{maxIntensity\}\}/g, earthquakeInfo?.maxIntensity || "訓練")
        .replace(/\{\{occurrenceTime\}\}/g, now.toLocaleString("ja-JP"))
        .replace(/\{\{magnitude\}\}/g, earthquakeInfo?.magnitude || "M0.0")
        .replace(/\{\{depth\}\}/g, earthquakeInfo?.depth || "0km")
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
    return NextResponse.json(
      { error: "訓練通知の処理に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
