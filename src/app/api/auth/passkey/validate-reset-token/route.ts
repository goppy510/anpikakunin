import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

/**
 * パスキー再登録トークンの検証
 * GET /api/auth/passkey/validate-reset-token?token=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // トークン検証
    const resetToken = await prisma.passkeyResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 404 }
      );
    }

    if (resetToken.used) {
      return NextResponse.json(
        { error: "Token already used" },
        { status: 400 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 400 }
      );
    }

    if (!resetToken.user.isActive) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      userId: resetToken.user.id,
      email: resetToken.user.email,
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
