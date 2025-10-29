import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requirePermission } from "@/app/lib/auth/middleware";

// GET: 通知条件一覧取得
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, ["earthquake:condition:read"]);
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
  const authCheck = await requirePermission(request, ["earthquake:condition:write"]);
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

    // トランザクションで通知条件とチャンネルを同時に保存
    const result = await prisma.$transaction(async (tx) => {
      // 通知条件を保存
      const condition = await tx.earthquakeNotificationCondition.upsert({
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

      // notification_channels テーブルにも earthquake 用チャンネルを登録
      await tx.notificationChannel.upsert({
        where: {
          workspaceRef_channelId_purpose: {
            workspaceRef: workspace.id,
            channelId,
            purpose: "earthquake",
          },
        },
        create: {
          workspaceRef: workspace.id,
          channelId,
          channelName: "earthquake-notifications",
          purpose: "earthquake",
          isActive: true,
        },
        update: {
          channelName: "earthquake-notifications",
          isActive: true,
        },
      });

      return condition;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to create notification condition:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
