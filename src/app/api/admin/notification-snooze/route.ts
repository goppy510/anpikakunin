import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAuth } from "@/app/lib/auth/middleware";
import { getUserPermissions } from "@/app/lib/db/permissions";

async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.some(p => p.name === permissionName);
}

/**
 * スヌーズ状態取得
 * GET /api/admin/notification-snooze?workspaceRef=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAuth(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }
    const { user } = authCheck;

    // notification:snooze 権限チェック
    const canSnooze = await hasPermission(user.id, "notification:snooze");
    if (!canSnooze) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceRef = searchParams.get("workspaceRef");

    if (!workspaceRef) {
      return NextResponse.json(
        { error: "workspaceRef is required" },
        { status: 400 }
      );
    }

    // 現在のスヌーズ状態を取得
    const snooze = await prisma.notificationSnooze.findUnique({
      where: { workspaceRef },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 期限切れの場合は削除
    if (snooze && snooze.expiresAt < new Date()) {
      await prisma.notificationSnooze.delete({
        where: { id: snooze.id },
      });
      return NextResponse.json({ snoozed: false });
    }

    if (!snooze) {
      return NextResponse.json({ snoozed: false });
    }

    return NextResponse.json({
      snoozed: true,
      snooze: {
        id: snooze.id,
        snoozedBy: snooze.snoozedBy,
        snoozedAt: snooze.snoozedAt,
        expiresAt: snooze.expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch snooze status:", error);
    return NextResponse.json(
      { error: "Failed to fetch snooze status" },
      { status: 500 }
    );
  }
}

/**
 * スヌーズ実行
 * POST /api/admin/notification-snooze
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireAuth(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }
    const { user } = authCheck;

    // notification:snooze 権限チェック
    const canSnooze = await hasPermission(user.id, "notification:snooze");
    if (!canSnooze) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { workspaceRef } = body;

    if (!workspaceRef) {
      return NextResponse.json(
        { error: "workspaceRef is required" },
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

    // スヌーズ設定を取得（デフォルト24時間）
    const config = await prisma.notificationSnoozeConfig.findUnique({
      where: { workspaceRef },
    });

    const durationHours = config?.durationHours ?? 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    // スヌーズを作成/更新
    const snooze = await prisma.notificationSnooze.upsert({
      where: { workspaceRef },
      update: {
        snoozedBy: user.id,
        snoozedAt: new Date(),
        expiresAt,
      },
      create: {
        workspaceRef,
        snoozedBy: user.id,
        expiresAt,
      },
    });

    return NextResponse.json({
      snooze: {
        id: snooze.id,
        snoozedBy: snooze.snoozedBy,
        snoozedAt: snooze.snoozedAt,
        expiresAt: snooze.expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to activate snooze:", error);
    return NextResponse.json(
      { error: "Failed to activate snooze" },
      { status: 500 }
    );
  }
}

/**
 * スヌーズ解除
 * DELETE /api/admin/notification-snooze?workspaceRef=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await requireAuth(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }
    const { user } = authCheck;

    // notification:snooze 権限チェック
    const canSnooze = await hasPermission(user.id, "notification:snooze");
    if (!canSnooze) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceRef = searchParams.get("workspaceRef");

    if (!workspaceRef) {
      return NextResponse.json(
        { error: "workspaceRef is required" },
        { status: 400 }
      );
    }

    // スヌーズを削除
    await prisma.notificationSnooze.deleteMany({
      where: { workspaceRef },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to deactivate snooze:", error);
    return NextResponse.json(
      { error: "Failed to deactivate snooze" },
      { status: 500 }
    );
  }
}
