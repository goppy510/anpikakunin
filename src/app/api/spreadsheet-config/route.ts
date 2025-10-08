import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAdmin } from "@/app/lib/auth/middleware";

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { workspaceId, spreadsheetUrl } = await request.json();

    if (!workspaceId || !spreadsheetUrl) {
      return NextResponse.json(
        { error: "workspaceId, spreadsheetUrlは必須です" },
        { status: 400 }
      );
    }

    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    const config = await prisma.spreadsheetConfig.upsert({
      where: { workspaceRef: workspace.id },
      create: {
        workspaceRef: workspace.id,
        spreadsheetUrl,
      },
      update: {
        spreadsheetUrl,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("スプレッドシート設定エラー:", error);
    return NextResponse.json(
      { error: "スプレッドシート設定に失敗しました" },
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
      return NextResponse.json({ error: "workspaceIdは必須です" }, { status: 400 });
    }

    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
      include: { spreadsheetConfig: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(workspace.spreadsheetConfig);
  } catch (error) {
    console.error("スプレッドシート設定取得エラー:", error);
    return NextResponse.json(
      { error: "スプレッドシート設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}
