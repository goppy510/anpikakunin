import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import bcrypt from "bcryptjs";

/**
 * POST /api/invitations/accept
 * 招待受諾・アカウント作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token: string;
      password: string;
    };

    // バリデーション
    if (!body.token) {
      return NextResponse.json(
        { error: "トークンが指定されていません" },
        { status: 400 }
      );
    }

    if (!body.password || body.password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上で入力してください" },
        { status: 400 }
      );
    }

    // 招待確認
    const invitation = await prisma.userInvitation.findUnique({
      where: { token: body.token },
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

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(body.password, 10);

    // トランザクションでユーザー作成 + 招待受諾
    const user = await prisma.$transaction(async (tx) => {
      // ユーザー作成
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          role: invitation.role,
          emailVerified: true, // 招待経由なのでメール確認済み
          isActive: true,
        },
      });

      // 招待を受諾済みにマーク
      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
        },
      });

      return newUser;
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to accept invitation:", error);

    // ユニーク制約違反（既にユーザーが存在）
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
