import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword, validatePasswordStrength } from "@/app/lib/auth/password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token) {
      return NextResponse.json(
        { error: "トークンが指定されていません" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "新しいパスワードを入力してください" },
        { status: 400 }
      );
    }

    // パスワード強度チェック
    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join("\n") },
        { status: 400 }
      );
    }

    // トークンを検証
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "無効なリセットリンクです" },
        { status: 400 }
      );
    }

    // トークンが使用済みか確認
    if (resetToken.used) {
      return NextResponse.json(
        { error: "このリセットリンクは既に使用されています" },
        { status: 400 }
      );
    }

    // トークンの有効期限確認
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: "リセットリンクの有効期限が切れています。再度リクエストしてください。" },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(password);

    // トランザクションでパスワード更新とトークン無効化
    await prisma.$transaction([
      // パスワード更新
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      // トークンを使用済みにマーク
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "パスワードが正常にリセットされました。ログイン画面からログインしてください。",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "パスワードリセットに失敗しました" },
      { status: 500 }
    );
  }
}
