import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAdmin } from "@/app/lib/auth/middleware";
import { logActivity, getRequestInfo } from "@/app/lib/activity/logger";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { user } = authCheck;

  try {
    const { id } = params;

    // 削除前に情報を取得
    const department = await prisma.department.findUnique({
      where: { id },
    });

    await prisma.department.delete({
      where: { id },
    });

    // アクティビティログ記録
    if (department) {
      const requestInfo = getRequestInfo(request);
      await logActivity({
        userId: user.id,
        userEmail: user.email,
        action: "deleted",
        resourceType: "department",
        resourceId: id,
        resourceName: department.name,
        ...requestInfo,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("部署削除エラー:", error);
    return NextResponse.json(
      { error: "部署の削除に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { user } = authCheck;

  try {
    const { id } = params;
    const { name, slackEmoji, buttonColor, displayOrder, isActive } =
      await request.json();

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slackEmoji !== undefined && { slackEmoji }),
        ...(buttonColor !== undefined && { buttonColor }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // アクティビティログ記録
    const requestInfo = getRequestInfo(request);
    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: "updated",
      resourceType: "department",
      resourceId: id,
      resourceName: department.name,
      details: { name, slackEmoji, buttonColor, displayOrder, isActive },
      ...requestInfo,
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("部署更新エラー:", error);
    return NextResponse.json(
      { error: "部署の更新に失敗しました" },
      { status: 500 }
    );
  }
}
