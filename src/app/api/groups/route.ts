import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/auth/middleware";
import { listGroups, createGroup, GroupInput } from "@/app/lib/db/groups";

/**
 * GET /api/groups
 * グループ一覧取得
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, ["view_groups"]);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const groups = await listGroups();
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups
 * グループ作成
 */
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, ["manage_groups"]);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const body = (await request.json()) as GroupInput;

    // バリデーション
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json(
        { error: "グループ名は必須です" },
        { status: 400 }
      );
    }

    const group = await createGroup(body);
    return NextResponse.json(group, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create group:", error);

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
