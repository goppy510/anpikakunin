import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/auth/middleware";
import { addUserToGroup, removeUserFromGroup } from "@/app/lib/db/groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/groups/:id/members
 * グループにユーザーを追加
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authCheck = await requirePermission(request, ["group:read"]);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id: groupId } = await context.params;

  try {
    const body = (await request.json()) as { userId: string };

    if (!body.userId) {
      return NextResponse.json(
        { error: "userIdは必須です" },
        { status: 400 }
      );
    }

    await addUserToGroup(groupId, body.userId);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to add user to group:", error);

    // ユニーク制約違反（既に追加済み）
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "このユーザーは既にグループに所属しています" },
        { status: 409 }
      );
    }

    // 外部キー制約違反
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "グループまたはユーザーが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/:id/members
 * グループからユーザーを削除
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authCheck = await requirePermission(request, ["group:read"]);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id: groupId } = await context.params;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userIdは必須です" },
        { status: 400 }
      );
    }

    await removeUserFromGroup(groupId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove user from group:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
