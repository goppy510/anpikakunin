import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/app/lib/db/prisma";
import { sendEmail } from "@/app/lib/email/mailer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスを入力してください" },
        { status: 400 }
      );
    }

    // ユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // セキュリティのため、ユーザーが存在しない場合も成功レスポンスを返す
    // （メールアドレスの存在確認を防ぐ）
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "パスワードリセットメールを送信しました。メールをご確認ください。",
      });
    }

    // 既存の未使用トークンを無効化
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // 新しいトークンを生成（32バイト = 64文字のhex）
    const token = crypto.randomBytes(32).toString("hex");

    // トークンの有効期限（1時間）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // トークンをDBに保存
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // リセットリンクを生成
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // メール送信
    await sendEmail({
      to: user.email,
      subject: "パスワードリセットのご案内 - 安否確認システム",
      html: `
        <h2>パスワードリセットのご案内</h2>
        <p>${user.email} 様</p>
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p><strong>このリンクの有効期限は1時間です。</strong></p>
        <p>このリクエストに心当たりがない場合は、このメールを無視してください。</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          このメールは安否確認システムから自動送信されています。<br>
          返信はできませんのでご了承ください。
        </p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "パスワードリセットメールを送信しました。メールをご確認ください。",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "パスワードリセットメールの送信に失敗しました" },
      { status: 500 }
    );
  }
}
