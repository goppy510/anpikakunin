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
        isActive: true,
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
