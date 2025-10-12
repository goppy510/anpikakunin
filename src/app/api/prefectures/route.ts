import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const prefectures = await prisma.prefecture.findMany({
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(prefectures);
  } catch (error) {
    console.error("Failed to fetch prefectures:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
