import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    // 訓練の安否確認応答を取得
    const responses = await prisma.trainingConfirmationResponse.findMany({
      include: {
        department: true,
        trainingNotification: true,
      },
      orderBy: {
        respondedAt: "desc",
      },
    });

    // レスポンス形式を整形
    const formattedResponses = responses.map((response) => ({
      id: response.id,
      slackUserId: response.slackUserId,
      slackUserName: response.slackUserName,
      departmentName: response.department.name,
      respondedAt: response.respondedAt.toISOString(),
      trainingInfo: {
        notifiedAt: response.trainingNotification.notifiedAt?.toISOString() || response.trainingNotification.createdAt.toISOString(),
      },
    }));

    return NextResponse.json({
      responses: formattedResponses,
      total: formattedResponses.length,
    });
  } catch (error) {
    console.error("訓練応答履歴取得エラー:", error);
    return NextResponse.json(
      { error: "訓練応答履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}
