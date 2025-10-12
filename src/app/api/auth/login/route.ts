import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { verifyPassword } from "@/app/lib/auth/password";
import { createOtpCode } from "@/app/lib/auth/otp";
import { sendOtpEmail } from "@/app/lib/email/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // パスワード未設定（招待中）
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "アカウントがまだ有効化されていません。招待メールからアカウントを作成してください" },
        { status: 401 }
      );
    }

    // パスワード検証
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // アカウント無効化チェック
    if (!user.isActive) {
      return NextResponse.json(
        { error: "このアカウントは無効化されています" },
        { status: 403 }
      );
    }

    // OTPコード生成
    const otpCode = await createOtpCode(user.id);

    // OTPメール送信
    await sendOtpEmail({
      toEmail: user.email,
      otpCode,
    });

    return NextResponse.json({
      message: "認証コードを送信しました",
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "ログイン処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
