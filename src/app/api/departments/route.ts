import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAdmin } from "@/app/lib/auth/middleware";

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { workspaceId, name, slackEmoji, buttonColor } = await request.json();

    if (!workspaceId || !name || !slackEmoji) {
      return NextResponse.json(
        { error: "workspaceId, name, slackEmojiは必須です" },
        { status: 400 }
      );
    }

    // ワークスペース存在確認
    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    // 表示順序を自動設定（既存の最大値+1）
    const maxOrder = await prisma.department.aggregate({
      where: { workspaceRef: workspace.id },
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

    const department = await prisma.department.create({
      data: {
        workspaceRef: workspace.id,
        name,
        slackEmoji,
        buttonColor: buttonColor || "#5B8FF9",
        displayOrder,
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("部署登録エラー:", error);
    return NextResponse.json(
      { error: "部署の登録に失敗しました" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceIdは必須です" },
        { status: 400 }
      );
    }

    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
      include: {
        departments: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(workspace.departments);
  } catch (error) {
    console.error("部署取得エラー:", error);
    return NextResponse.json(
      { error: "部署の取得に失敗しました" },
      { status: 500 }
    );
  }
}
