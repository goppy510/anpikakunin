import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/auth/middleware";
import {
  listPermissions,
  listPermissionsByCategory,
  createPermission,
  PermissionInput,
} from "@/app/lib/db/permissions";

/**
 * GET /api/permissions
 * 権限一覧取得
 * グループ管理画面で使用するため、group:read権限でもアクセス可能
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, ["group:read", "group:write", "system:admin"]);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const permissions = category
      ? await listPermissionsByCategory(category)
      : await listPermissions();

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/permissions
 * 権限作成
 */
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, ["system:admin"]);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const body = (await request.json()) as PermissionInput;

    // バリデーション
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json(
        { error: "権限名は必須です" },
        { status: 400 }
      );
    }

    if (!body.displayName || body.displayName.trim() === "") {
      return NextResponse.json(
        { error: "表示名は必須です" },
        { status: 400 }
      );
    }

    if (!body.category || body.category.trim() === "") {
      return NextResponse.json(
        { error: "カテゴリは必須です" },
        { status: 400 }
      );
    }

    const permission = await createPermission(body);
    return NextResponse.json(permission, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create permission:", error);

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
