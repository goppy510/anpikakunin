import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/auth/middleware";
import {
  getPermissionById,
  updatePermission,
  deletePermission,
  PermissionInput,
} from "@/app/lib/db/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/permissions/:id
 * 権限詳細取得
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authCheck = await requirePermission(request, ["system:admin"]);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id } = await context.params;

  try {
    const permission = await getPermissionById(id);

    if (!permission) {
      return NextResponse.json(
        { error: "権限が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(permission);
  } catch (error) {
    console.error("Failed to fetch permission:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/permissions/:id
 * 権限更新
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authCheck = await requirePermission(request, ["system:admin"]);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Partial<PermissionInput>;

    const permission = await updatePermission(id, body);
    return NextResponse.json(permission);
  } catch (error: any) {
    console.error("Failed to update permission:", error);

    // レコードが存在しない
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "権限が見つかりません" },
        { status: 404 }
      );
    }

    // ユニーク制約違反
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "この権限名は既に使用されています" },
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
 * DELETE /api/permissions/:id
 * 権限削除
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authCheck = await requirePermission(request, ["system:admin"]);
  if (authCheck instanceof NextResponse) return authCheck;

  const { id } = await context.params;

  try {
    await deletePermission(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete permission:", error);

    // レコードが存在しない
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "権限が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
