import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth/middleware";
import { prisma } from "@/app/lib/db/prisma";
import { verifyPassword, hashPassword } from "@/app/lib/auth/password";
import { validatePasswordStrength } from "@/app/lib/validation/password";

/**
 * POST /api/auth/change-password
 * パスワード変更
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const userId = authCheck.user.id;

  try {
    const body = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: "現在のパスワードと新しいパスワードを入力してください" },
        { status: 400 }
      );
    }

    // ユーザー取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // 現在のパスワード確認
    const isValidCurrentPassword = await verifyPassword(
      body.currentPassword,
      user.passwordHash
    );

    if (!isValidCurrentPassword) {
      return NextResponse.json(
        { error: "現在のパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // 新しいパスワードの強度チェック
    const passwordStrength = validatePasswordStrength(body.newPassword);
    if (!passwordStrength.isValid) {
      return NextResponse.json(
        {
          error: "新しいパスワードが要件を満たしていません",
          feedback: passwordStrength.feedback,
        },
        { status: 400 }
      );
    }

    // 新しいパスワードをハッシュ化
    const newPasswordHash = await hashPassword(body.newPassword);

    // パスワード更新
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "パスワードを変更しました",
    });
  } catch (error) {
    console.error("Failed to change password:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
