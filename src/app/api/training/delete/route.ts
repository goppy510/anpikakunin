import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { CronJobOrgClient } from "@/app/lib/cron/cronjobOrgClient";

/**
 * 訓練通知を削除（cron-job.org のジョブも削除）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get("trainingId");

    if (!trainingId) {
      return NextResponse.json(
        { error: "trainingId is required" },
        { status: 400 }
      );
    }

    // 訓練通知レコードを取得
    const trainingNotification = await prisma.trainingNotification.findUnique({
      where: { id: trainingId },
    });

    if (!trainingNotification) {
      return NextResponse.json(
        { error: "Training notification not found" },
        { status: 404 }
      );
    }

    // cron-job.org のジョブを削除（cronJobIdが存在する場合）
    if (trainingNotification.cronJobId) {
      try {
        const cronClient = new CronJobOrgClient();
        await cronClient.deleteJob(parseInt(trainingNotification.cronJobId));
        console.log(
          `✅ Deleted cron job: ${trainingNotification.cronJobId}`
        );
      } catch (cronError: any) {
        console.error("❌ Failed to delete cron job:", cronError);
        // cronジョブ削除失敗してもDB削除は続行
      }
    }

    // DBから訓練通知レコードを削除
    await prisma.trainingNotification.delete({
      where: { id: trainingId },
    });

    console.log(`✅ Deleted training notification: ${trainingId}`);

    return NextResponse.json({
      success: true,
      message: "Training notification deleted successfully",
      trainingId,
    });
  } catch (error: any) {
    console.error("❌ Training delete API error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete training notification",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
