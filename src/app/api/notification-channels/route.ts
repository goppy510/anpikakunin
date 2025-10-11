import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceIdは必須です" },
        { status: 400 }
      );
    }

    const channels = await prisma.notificationChannel.findMany({
      where: {
        workspaceRef: workspaceId,
      },
      orderBy: {
        purpose: "asc",
      },
    });

    return NextResponse.json({
      channels,
      total: channels.length,
    });
  } catch (error) {
    console.error("通知チャンネル取得エラー:", error);
    return NextResponse.json(
      { error: "通知チャンネルの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notification-channels
 * 通知チャンネル追加
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, channelId, channelName, purpose } = body;

    if (!workspaceId || !channelId || !channelName || !purpose) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    // 重複チェック
    const existing = await prisma.notificationChannel.findFirst({
      where: {
        workspaceRef: workspaceId,
        channelId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "このチャンネルは既に登録されています" },
        { status: 409 }
      );
    }

    const channel = await prisma.notificationChannel.create({
      data: {
        workspaceRef: workspaceId,
        channelId,
        channelName,
        purpose,
        isActive: true,
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    console.error("通知チャンネル追加エラー:", error);
    return NextResponse.json(
      { error: "通知チャンネルの追加に失敗しました" },
      { status: 500 }
    );
  }
}
