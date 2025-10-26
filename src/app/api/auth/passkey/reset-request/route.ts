import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import crypto from "crypto";
import { sendPasskeyResetEmail } from "@/app/lib/email/sendPasskeyResetEmail";

/**
 * パスキー再登録用のリンクをメール送信
 * POST /api/auth/passkey/reset-request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // ユーザー存在チェック
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // セキュリティのため、ユーザーが存在しなくても成功レスポンスを返す
      return NextResponse.json({
        message: "パスキー再登録用のリンクをメールで送信しました",
      });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    // トークン生成
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24時間有効

    // 既存の未使用トークンを削除
    await prisma.passkeyResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    });

    // 新しいトークンを作成
    await prisma.passkeyResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // メール送信
    await sendPasskeyResetEmail({
      toEmail: user.email,
      token,
    });

    return NextResponse.json({
      message: "パスキー再登録用のリンクをメールで送信しました",
    });
  } catch (error) {
    console.error("Passkey reset request error:", error);
    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 }
    );
  }
}
