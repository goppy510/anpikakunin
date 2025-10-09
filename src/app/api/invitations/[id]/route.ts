import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/middleware";
import { prisma } from "@/app/lib/db/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/invitations/:id
 * 招待キャンセル
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id } = await context.params;

  try {
    await prisma.userInvitation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete invitation:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "招待が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
