import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    // 本番の安否確認応答を取得
    const responses = await prisma.safetyConfirmationResponse.findMany({
      include: {
        department: true,
        notification: {
          include: {
            earthquakeRecord: true,
          },
        },
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
      earthquakeInfo: {
        title: response.notification.earthquakeRecord.title,
        maxIntensity: response.notification.earthquakeRecord.maxIntensity,
        epicenter: response.notification.earthquakeRecord.epicenter || "",
        occurrenceTime: response.notification.earthquakeRecord.occurrenceTime?.toISOString() || "",
      },
    }));

    return NextResponse.json({
      responses: formattedResponses,
      total: formattedResponses.length,
    });
  } catch (error) {
    console.error("応答履歴取得エラー:", error);
    return NextResponse.json(
      { error: "応答履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}
