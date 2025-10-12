import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  try {
    // 最新の地震イベントログ（RESTソース）を取得
    const latestRestEvent = await prisma.earthquakeEventLog.findFirst({
      where: { source: "rest" },
      orderBy: { fetchedAt: "desc" },
    });

    if (!latestRestEvent) {
      return NextResponse.json({
        status: "warning",
        lastRunAt: null,
        elapsedMinutes: null,
        message: "RESTポーリングがまだ実行されていません",
      });
    }

    const now = new Date();
    const lastRun = new Date(latestRestEvent.fetchedAt);
    const elapsedMinutes = Math.floor((now.getTime() - lastRun.getTime()) / 60000);

    let status: "healthy" | "warning" | "error";
    let message: string;

    if (elapsedMinutes <= 2) {
      status = "healthy";
      message = "正常に動作しています";
    } else if (elapsedMinutes <= 5) {
      status = "warning";
      message = `最終実行から${elapsedMinutes}分経過（警告）`;
    } else {
      status = "error";
      message = `最終実行から${elapsedMinutes}分経過（エラー）`;
    }

    return NextResponse.json({
      status,
      lastRunAt: latestRestEvent.fetchedAt.toISOString(),
      elapsedMinutes,
      message,
    });
  } catch (error) {
    console.error("REST poller health check error:", error);
    return NextResponse.json(
      {
        status: "error",
        lastRunAt: null,
        elapsedMinutes: null,
        message: "ヘルスチェック取得に失敗しました",
      },
      { status: 500 }
    );
  }
}
