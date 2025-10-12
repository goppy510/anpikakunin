import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

/**
 * バッチヘルスチェックAPI
 * GET /api/admin/batch-health
 *
 * バッチ処理の稼働状況を返す
 * - healthy: 1分以内に正常実行（緑）
 * - warning: 3分以内に実行（黄）
 * - error: 3分以上実行されていない（赤）
 */
export async function GET() {
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
      return NextResponse.json({
        status: "error",
        lastRunAt: null,
        message: "バッチが一度も実行されていません",
        elapsedMinutes: null,
      });
    }

    const now = new Date();
    const lastRunAt = latestLog.createdAt;
    const elapsedMinutes = (now.getTime() - lastRunAt.getTime()) / 1000 / 60;

    let status: "healthy" | "warning" | "error";
    let message: string;

    if (elapsedMinutes <= 1.5) {
      status = "healthy";
      message = "正常稼働中";
    } else if (elapsedMinutes <= 3) {
      status = "warning";
      message = `前回実行から${Math.floor(elapsedMinutes)}分経過`;
    } else {
      status = "error";
      message = `前回実行から${Math.floor(elapsedMinutes)}分経過（異常）`;
    }

    // 詳細情報を取得
    let details = null;
    try {
      details = JSON.parse(latestLog.details || "{}");
    } catch {
      // JSON parse error は無視
    }

    return NextResponse.json({
      status,
      lastRunAt: lastRunAt.toISOString(),
      elapsedMinutes: Math.floor(elapsedMinutes * 10) / 10, // 小数点1桁
      message,
      details,
    });
  } catch (error) {
    console.error("バッチヘルスチェック取得エラー:", error);
    return NextResponse.json(
      {
        status: "error",
        lastRunAt: null,
        message: "ヘルスチェックの取得に失敗しました",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
