import { NextRequest, NextResponse } from "next/server";
import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  FlexibleTimeWindowMode,
  ScheduleState,
} from "@aws-sdk/client-scheduler";
import { prisma } from "@/app/lib/db/prisma";
import { getDecryptedAwsCredentials } from "@/app/api/admin/aws-credentials/route";

/**
 * 訓練モードEventBridge Scheduler管理API
 * 訓練通知のスケジュール設定・削除を行う
 */

// 管理者認証チェック（簡易版）
function isAdmin(request: NextRequest): boolean {
  // TODO: 実際の管理者認証ロジックに置き換える
  const adminPassword = request.headers.get("x-admin-password");
  return adminPassword === "admin123";
}

/**
 * POST: 訓練モードのEventBridgeスケジュールを作成
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { trainingId, scheduleExpression, scheduleName, timezone } = body;

    if (!trainingId || !scheduleExpression) {
      return NextResponse.json(
        { error: "trainingId and scheduleExpression are required" },
        { status: 400 }
      );
    }

    // AWS認証情報を取得
    const awsCredentials = await getDecryptedAwsCredentials();
    if (!awsCredentials) {
      return NextResponse.json(
        { error: "AWS認証情報が設定されていません" },
        { status: 500 }
      );
    }

    // EventBridge Schedulerクライアントを作成
    const scheduler = new SchedulerClient({
      region: awsCredentials.region,
      credentials: {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
      },
    });

    // API DestinationのARNを取得
    const apiDestinationArn = process.env.EVENTBRIDGE_API_DESTINATION_ARN;
    if (!apiDestinationArn) {
      return NextResponse.json(
        { error: "EVENTBRIDGE_API_DESTINATION_ARN が設定されていません" },
        { status: 500 }
      );
    }

    // スケジュール名を生成
    const scheduleNameFinal = scheduleName || `training-${trainingId}`;

    // スケジュールを作成
    const command = new CreateScheduleCommand({
      Name: scheduleNameFinal,
      Description: `訓練通知スケジュール (Training ID: ${trainingId})`,
      ScheduleExpression: scheduleExpression, // e.g., "cron(0 0 1 * ? *)"
      ScheduleExpressionTimezone: timezone || "Asia/Tokyo",
      FlexibleTimeWindow: {
        Mode: FlexibleTimeWindowMode.OFF,
      },
      Target: {
        Arn: apiDestinationArn,
        RoleArn: process.env.EVENTBRIDGE_ROLE_ARN!,
        Input: JSON.stringify({ trainingId }),
        HttpParameters: {
          HeaderParameters: {
            "Content-Type": "application/json",
          },
        },
        RetryPolicy: {
          MaximumRetryAttempts: 2,
          MaximumEventAge: 3600, // 1時間
        },
      },
      State: ScheduleState.ENABLED,
    });

    const response = await scheduler.send(command);

    // 訓練通知レコードにスケジュール名を保存
    await prisma.trainingNotification.update({
      where: { id: trainingId },
      data: {
        cronJobId: scheduleNameFinal, // EventBridgeスケジュール名を保存
      },
    });

    return NextResponse.json({
      success: true,
      message: "EventBridgeスケジュールを作成しました",
      scheduleName: scheduleNameFinal,
      scheduleArn: response.ScheduleArn,
    });
  } catch (error: any) {
    console.error("Failed to create EventBridge schedule:", error);
    return NextResponse.json(
      {
        error: "Failed to create EventBridge schedule",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 訓練モードのEventBridgeスケジュールを削除
 */
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const scheduleName = searchParams.get("scheduleName");

    if (!scheduleName) {
      return NextResponse.json(
        { error: "scheduleName is required" },
        { status: 400 }
      );
    }

    // AWS認証情報を取得
    const awsCredentials = await getDecryptedAwsCredentials();
    if (!awsCredentials) {
      return NextResponse.json(
        { error: "AWS認証情報が設定されていません" },
        { status: 500 }
      );
    }

    // EventBridge Schedulerクライアントを作成
    const scheduler = new SchedulerClient({
      region: awsCredentials.region,
      credentials: {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
      },
    });

    // スケジュールを削除
    const command = new DeleteScheduleCommand({
      Name: scheduleName,
    });

    await scheduler.send(command);

    return NextResponse.json({
      success: true,
      message: "EventBridgeスケジュールを削除しました",
      scheduleName,
    });
  } catch (error: any) {
    console.error("Failed to delete EventBridge schedule:", error);
    return NextResponse.json(
      {
        error: "Failed to delete EventBridge schedule",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET: EventBridgeスケジュールの状態を取得
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const scheduleName = searchParams.get("scheduleName");

    if (!scheduleName) {
      return NextResponse.json(
        { error: "scheduleName is required" },
        { status: 400 }
      );
    }

    // AWS認証情報を取得
    const awsCredentials = await getDecryptedAwsCredentials();
    if (!awsCredentials) {
      return NextResponse.json(
        { error: "AWS認証情報が設定されていません" },
        { status: 500 }
      );
    }

    // EventBridge Schedulerクライアントを作成
    const scheduler = new SchedulerClient({
      region: awsCredentials.region,
      credentials: {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
      },
    });

    // スケジュールの状態を取得
    const command = new GetScheduleCommand({
      Name: scheduleName,
    });

    const response = await scheduler.send(command);

    return NextResponse.json({
      success: true,
      schedule: {
        name: response.Name,
        state: response.State,
        scheduleExpression: response.ScheduleExpression,
        scheduleExpressionTimezone: response.ScheduleExpressionTimezone,
        arn: response.Arn,
        createdAt: response.CreationDate,
        lastModifiedAt: response.LastModificationDate,
      },
    });
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      return NextResponse.json(
        { error: "スケジュールが見つかりません" },
        { status: 404 }
      );
    }

    console.error("Failed to get EventBridge schedule:", error);
    return NextResponse.json(
      {
        error: "Failed to get EventBridge schedule",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
