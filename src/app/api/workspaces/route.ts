import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const workspaces = await prisma.slackWorkspace.findMany({
      where: {
        isEnabled: true,
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      workspaces,
      total: workspaces.length,
    });
  } catch (error) {
    console.error("ワークスペース取得エラー:", error);
    return NextResponse.json(
      { error: "ワークスペースの取得に失敗しました" },
      { status: 500 }
    );
  }
}
