import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAdmin } from "@/app/lib/auth/middleware";

// GET: 通知条件一覧取得
export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
      include: {
        notificationCondition: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json(workspace.notificationCondition);
  } catch (error) {
    console.error("Failed to fetch notification condition:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: 通知条件作成
export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { workspaceId, minIntensity, targetPrefectures, channelId } = await request.json();

    if (!workspaceId || !minIntensity || !channelId) {
      return NextResponse.json(
        { error: "workspaceId, minIntensity, and channelId are required" },
        { status: 400 }
      );
    }

    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const condition = await prisma.earthquakeNotificationCondition.upsert({
      where: { workspaceRef: workspace.id },
      create: {
        workspaceRef: workspace.id,
        minIntensity,
        targetPrefectures: targetPrefectures || [],
        channelId,
      },
      update: {
        minIntensity,
        targetPrefectures: targetPrefectures || [],
        channelId,
      },
    });

    return NextResponse.json(condition);
  } catch (error) {
    console.error("Failed to create notification condition:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
