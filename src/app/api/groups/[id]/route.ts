import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/middleware";
import {
  getGroupById,
  updateGroup,
  deleteGroup,
  GroupInput,
} from "@/app/lib/db/groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/groups/:id
 * グループ詳細取得
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id } = await context.params;

  try {
    const group = await getGroupById(id);

    if (!group) {
      return NextResponse.json(
        { error: "グループが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("Failed to fetch group:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/groups/:id
 * グループ更新
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Partial<GroupInput>;

    const group = await updateGroup(id, body);
    return NextResponse.json(group);
  } catch (error: any) {
    console.error("Failed to update group:", error);

    // レコードが存在しない
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "グループが見つかりません" },
        { status: 404 }
      );
    }

    // ユニーク制約違反
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "このグループ名は既に使用されています" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/:id
 * グループ削除
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id } = await context.params;

  try {
    await deleteGroup(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete group:", error);

    // レコードが存在しない
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "グループが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
