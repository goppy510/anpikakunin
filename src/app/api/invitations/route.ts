import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/middleware";
import { prisma } from "@/app/lib/db/prisma";
import crypto from "crypto";

/**
 * GET /api/invitations
 * 招待一覧取得
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const invitations = await prisma.userInvitation.findMany({
      include: {
        inviter: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        inviterEmail: inv.inviter.email,
        expiresAt: inv.expiresAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString() || null,
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch invitations:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invitations
 * メンバー招待
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const inviterId = authCheck.user.id;

  try {
    const body = (await request.json()) as {
      email: string;
      role?: "ADMIN" | "EDITOR";
    };

    // バリデーション
    if (!body.email || !body.email.includes("@")) {
      return NextResponse.json(
        { error: "有効なメールアドレスを入力してください" },
        { status: 400 }
      );
    }

    // 既存ユーザーチェック
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    // 未承認招待チェック
    const existingInvitation = await prisma.userInvitation.findFirst({
      where: {
        email: body.email,
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "このメールアドレスには既に招待が送信されています" },
        { status: 409 }
      );
    }

    // 招待トークン生成（セキュアなランダム文字列）
    const token = crypto.randomBytes(32).toString("hex");

    // 有効期限: 7日後
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 招待レコード作成
    const invitation = await prisma.userInvitation.create({
      data: {
        email: body.email,
        invitedBy: inviterId,
        token,
        role: body.role || "EDITOR",
        expiresAt,
      },
      include: {
        inviter: {
          select: {
            email: true,
          },
        },
      },
    });

    // TODO: メール送信処理
    // 招待URL: http://localhost:3000/accept-invitation?token=xxx

    return NextResponse.json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        inviterEmail: invitation.inviter.email,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
        invitationUrl: `${process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || "http://localhost:3000"}/accept-invitation?token=${invitation.token}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create invitation:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
