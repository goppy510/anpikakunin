import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAdmin } from "@/app/lib/auth/middleware";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { id } = params;

    await prisma.department.delete({
      where: { id },
    });

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

    return NextResponse.json(department);
  } catch (error) {
    console.error("部署更新エラー:", error);
    return NextResponse.json(
      { error: "部署の更新に失敗しました" },
      { status: 500 }
    );
  }
}
