import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

/**
 * PATCH /api/notification-channels/[id]
 * 通知チャンネルのステータス更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActiveはboolean型である必要があります" },
        { status: 400 }
      );
    }

    const channel = await prisma.notificationChannel.update({
      where: { id: params.id },
      data: { isActive },
    });

    return NextResponse.json(channel);
  } catch (error) {
    console.error("通知チャンネル更新エラー:", error);
    return NextResponse.json(
      { error: "通知チャンネルの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notification-channels/[id]
 * 通知チャンネル削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.notificationChannel.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("通知チャンネル削除エラー:", error);
    return NextResponse.json(
      { error: "通知チャンネルの削除に失敗しました" },
      { status: 500 }
    );
  }
}
