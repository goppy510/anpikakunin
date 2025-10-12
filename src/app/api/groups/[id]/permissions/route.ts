import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/middleware";
import {
  attachPermissionToGroup,
  detachPermissionFromGroup,
} from "@/app/lib/db/groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/groups/:id/permissions
 * グループに権限をアタッチ
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id: groupId } = await context.params;

  try {
    const body = (await request.json()) as { permissionId: string };

    if (!body.permissionId) {
      return NextResponse.json(
        { error: "permissionIdは必須です" },
        { status: 400 }
      );
    }

    await attachPermissionToGroup(groupId, body.permissionId);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to attach permission to group:", error);

    // ユニーク制約違反（既にアタッチ済み）
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "この権限は既にグループにアタッチされています" },
        { status: 409 }
      );
    }

    // 外部キー制約違反
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "グループまたは権限が見つかりません" },
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
 * DELETE /api/groups/:id/permissions
 * グループから権限をデタッチ
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id: groupId } = await context.params;

  try {
    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get("permissionId");

    if (!permissionId) {
      return NextResponse.json(
        { error: "permissionIdは必須です" },
        { status: 400 }
      );
    }

    await detachPermissionFromGroup(groupId, permissionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to detach permission from group:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
