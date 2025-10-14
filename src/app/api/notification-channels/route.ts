import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    // notification_channelsテーブルから取得
    const channels = await prisma.notificationChannel.findMany({
      where: {
        workspaceRef: workspaceId,
        isActive: true,
      },
      orderBy: {
        channelName: "asc",
      },
    });

    // フロントエンドが期待する形式に変換
    const formattedChannels = channels.map((ch) => ({
      id: ch.channelId,
      name: ch.channelName,
      isPrivate: false,
    }));

    return NextResponse.json({
      channels: formattedChannels,
    });
  } catch (error: any) {
    console.error("Error fetching notification channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels", details: error.message },
      { status: 500 }
    );
  }
}
