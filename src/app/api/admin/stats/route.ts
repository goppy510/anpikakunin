import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth/middleware";
import { prisma } from "@/app/lib/db/prisma";

/**
 * GET /api/admin/stats
 * 管理画面ダッシュボードの統計情報取得
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    // 並列でカウント取得
    const [workspaces, departments, members, activeNotifications] =
      await Promise.all([
        prisma.slackWorkspace.count(),
        prisma.department.count(),
        prisma.user.count(),
        prisma.earthquakeNotificationCondition.count({
          where: { isEnabled: true },
        }),
      ]);

    return NextResponse.json({
      workspaces,
      departments,
      members,
      activeNotifications,
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
