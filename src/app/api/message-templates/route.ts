import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireEditor } from "@/app/lib/auth/middleware";

export async function POST(request: NextRequest) {
  const authCheck = await requireEditor(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { workspaceId, production, training } = await request.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceIdは必須です" }, { status: 400 });
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

    const templates = [];

    // 本番用メッセージ
    if (production?.title && production?.body) {
      const productionTemplate = await prisma.messageTemplate.upsert({
        where: {
          unique_workspace_type: {
            workspaceRef: workspace.id,
            type: "PRODUCTION",
          },
        },
        create: {
          workspaceRef: workspace.id,
          type: "PRODUCTION",
          title: production.title,
          body: production.body,
        },
        update: {
          title: production.title,
          body: production.body,
        },
      });
      templates.push(productionTemplate);
    }

    // 訓練用メッセージ
    if (training?.title && training?.body) {
      const trainingTemplate = await prisma.messageTemplate.upsert({
        where: {
          unique_workspace_type: {
            workspaceRef: workspace.id,
            type: "TRAINING",
          },
        },
        create: {
          workspaceRef: workspace.id,
          type: "TRAINING",
          title: training.title,
          body: training.body,
        },
        update: {
          title: training.title,
          body: training.body,
        },
      });
      templates.push(trainingTemplate);
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error("メッセージテンプレート登録エラー:", error);
    return NextResponse.json(
      { error: "メッセージテンプレートの登録に失敗しました" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authCheck = await requireEditor(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceIdは必須です" }, { status: 400 });
    }

    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
      include: {
        messageTemplates: {
          where: { isActive: true },
          orderBy: { type: "asc" },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "ワークスペースが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(workspace.messageTemplates);
  } catch (error) {
    console.error("メッセージテンプレート取得エラー:", error);
    return NextResponse.json(
      { error: "メッセージテンプレートの取得に失敗しました" },
      { status: 500 }
    );
  }
}
