import { NextRequest, NextResponse } from "next/server";
import { getActivityLogs } from "@/app/lib/activity/logger";

/**
 * GET /api/admin/activity-logs
 * アクティビティログを取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const resourceType = searchParams.get("resourceType") || undefined;
    const action = searchParams.get("action") || undefined;

    const result = await getActivityLogs({
      limit,
      offset,
      resourceType: resourceType as any,
      action: action as any,
    });

    return NextResponse.json({
      logs: result.logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userEmail: log.userEmail,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        resourceName: log.resourceName,
        details: log.details ? JSON.parse(log.details) : null,
        createdAt: log.createdAt.toISOString(),
        user: log.user
          ? {
              id: log.user.id,
              email: log.user.email,
              role: log.user.role,
            }
          : null,
      })),
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch activity logs:", error);
    return NextResponse.json(
      { error: "アクティビティログの取得に失敗しました" },
      { status: 500 }
    );
  }
}
