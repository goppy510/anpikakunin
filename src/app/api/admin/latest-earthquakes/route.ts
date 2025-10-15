import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

/**
 * GET /api/admin/latest-earthquakes
 * 最新の地震情報を取得（震度3以上、デフォルト3件）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "3");

    const earthquakes = await prisma.earthquakeRecord.findMany({
      where: {
        infoType: {
          not: "不明",
        },
      },
      orderBy: {
        occurrenceTime: "desc",
      },
      take: limit,
      include: {
        prefectureObservations: {
          orderBy: {
            prefectureName: "asc",
          },
        },
      },
    });

    return NextResponse.json({
      earthquakes: earthquakes.map((eq) => ({
        id: eq.id,
        eventId: eq.eventId,
        infoType: eq.infoType,
        title: eq.title,
        epicenter: eq.epicenter,
        magnitude: eq.magnitude,
        depth: eq.depth,
        maxIntensity: eq.maxIntensity,
        occurrenceTime: eq.occurrenceTime?.toISOString(),
        arrivalTime: eq.arrivalTime?.toISOString(),
        createdAt: eq.createdAt.toISOString(),
        prefectureObservations: eq.prefectureObservations.map((obs) => ({
          prefectureName: obs.prefectureName,
          maxIntensity: obs.maxIntensity,
        })),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch latest earthquakes:", error);
    return NextResponse.json(
      { error: "地震情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
