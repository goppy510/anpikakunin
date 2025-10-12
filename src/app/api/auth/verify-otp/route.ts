import { NextRequest, NextResponse } from "next/server";
import { verifyOtpCode } from "@/app/lib/auth/otp";
import { createSession } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "メールアドレスと認証コードを入力してください" },
        { status: 400 }
      );
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // OTPコード検証
    const verification = await verifyOtpCode(user.id, code);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "認証コードが無効です" },
        { status: 401 }
      );
    }

    // セッション作成
    const sessionToken = await createSession(user.id);

    // レスポンスにCookieを設定
    const response = NextResponse.json({
      message: "ログインしました",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token: sessionToken,
    });

    // HttpOnly Cookieでセッショントークンを設定
    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7日
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "認証処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
