import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth/middleware";
import { prisma } from "@/app/lib/db/prisma";

/**
 * GET /api/earthquake-info-types
 * 地震情報種別マスター一覧取得
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const infoTypes = await prisma.earthquakeInfoType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ infoTypes });
  } catch (error) {
    console.error("Failed to fetch earthquake info types:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
