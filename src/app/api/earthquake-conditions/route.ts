import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireEditor } from "@/app/lib/auth/middleware";

export async function POST(request: NextRequest) {
  const authCheck = await requireEditor(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { workspaceId, minIntensity, targetPrefectures, notificationChannel } =
      await request.json();

    if (!workspaceId || !minIntensity || !notificationChannel) {
      return NextResponse.json(
        { error: "workspaceId, minIntensity, notificationChannelは必須です" },
        { status: 400 }
      );
    }

    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    const condition = await prisma.earthquakeNotificationCondition.upsert({
      where: { workspaceRef: workspace.id },
      create: {
        workspaceRef: workspace.id,
        minIntensity,
        targetPrefectures: targetPrefectures || [],
        notificationChannel,
      },
      update: {
        minIntensity,
        targetPrefectures: targetPrefectures || [],
        notificationChannel,
      },
    });

    return NextResponse.json(condition);
  } catch (error) {
    // Silenced
    return NextResponse.json(
      { error: "通知条件の登録に失敗しました" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authCheck = await requireEditor(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceIdは必須です" },
        { status: 400 }
      );
    }

    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
      include: { notificationCondition: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(workspace.notificationCondition);
  } catch (error) {
    // Silenced
    return NextResponse.json(
      { error: "通知条件の取得に失敗しました" },
      { status: 500 }
    );
  }
}
