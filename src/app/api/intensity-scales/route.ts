import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const intensityScales = await prisma.intensityScale.findMany({
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(intensityScales);
  } catch (error) {
    console.error("Failed to fetch intensity scales:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
