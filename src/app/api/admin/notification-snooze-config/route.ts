import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { hasPermission } from "@/app/lib/auth/authorization";

/**
 * スヌーズ設定取得
 * GET /api/admin/notification-snooze-config
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // notification:snooze:config 権限チェック
    const canConfigSnooze = await hasPermission(
      user.id,
      "notification:snooze:config"
    );
    if (!canConfigSnooze) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 全ワークスペースのスヌーズ設定を取得
    const configs = await prisma.notificationSnoozeConfig.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Failed to fetch snooze config:", error);
    return NextResponse.json(
      { error: "Failed to fetch snooze config" },
      { status: 500 }
    );
  }
}

/**
 * スヌーズ設定更新
 * PUT /api/admin/notification-snooze-config
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // notification:snooze:config 権限チェック
    const canConfigSnooze = await hasPermission(
      user.id,
      "notification:snooze:config"
    );
    if (!canConfigSnooze) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { workspaceRef, durationHours } = body;

    if (!workspaceRef || typeof durationHours !== "number") {
      return NextResponse.json(
        { error: "workspaceRef and durationHours are required" },
        { status: 400 }
      );
    }

    if (durationHours <= 0 || durationHours > 168) {
      return NextResponse.json(
        { error: "durationHours must be between 1 and 168 (7 days)" },
        { status: 400 }
      );
    }

    // ワークスペース存在確認
    const workspace = await prisma.slackWorkspace.findUnique({
      where: { id: workspaceRef },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // 設定をupsert
    const config = await prisma.notificationSnoozeConfig.upsert({
      where: { workspaceRef },
      update: {
        durationHours,
      },
      create: {
        workspaceRef,
        durationHours,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Failed to update snooze config:", error);
    return NextResponse.json(
      { error: "Failed to update snooze config" },
      { status: 500 }
    );
  }
}
