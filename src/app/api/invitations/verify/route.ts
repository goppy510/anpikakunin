import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

/**
 * GET /api/invitations/verify?token=xxx
 * 招待トークン検証
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "トークンが指定されていません" },
      { status: 400 }
    );
  }

  try {
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        inviter: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "招待が見つかりません" },
        { status: 404 }
      );
    }

    // 既に受諾済み
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "この招待は既に使用されています" },
        { status: 410 }
      );
    }

    // 有効期限切れ
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "この招待は有効期限切れです" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      inviterEmail: invitation.inviter.email,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    });
  } catch (error) {
    // Silenced
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
