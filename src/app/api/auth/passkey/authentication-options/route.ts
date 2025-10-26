import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  GenerateAuthenticationOptionsOpts,
} from "@simplewebauthn/server";
import { prisma } from "@/app/lib/db/prisma";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";

/**
 * パスキーログイン用のチャレンジを生成
 * POST /api/auth/passkey/authentication-options
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
      include: {
        passkeys: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    // パスキー未登録の場合は専用レスポンスを返す
    if (user.passkeys.length === 0) {
      return NextResponse.json(
        {
          error: "No passkeys registered",
          noPasskeys: true,
          userId: user.id,
        },
        { status: 400 }
      );
    }

    // 登録済みパスキーのリスト
    const allowCredentials = user.passkeys.map((passkey) => ({
      id: Buffer.from(passkey.credentialId).toString("base64url"),
      type: "public-key" as const,
      transports: passkey.transports as AuthenticatorTransport[],
    }));

    const options: GenerateAuthenticationOptionsOpts = {
      rpID: RP_ID,
      timeout: 60000, // 60秒
      allowCredentials,
      userVerification: "preferred",
    };

    const authenticationOptions = await generateAuthenticationOptions(options);

    // チャレンジをDBに保存（60秒有効）
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + 60);

    await prisma.webAuthnChallenge.create({
      data: {
        userId: user.id,
        challenge: authenticationOptions.challenge,
        type: "authentication",
        expiresAt,
      },
    });

    return NextResponse.json({
      options: authenticationOptions,
    });
  } catch (error: any) {
    console.error("Authentication options error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      {
        error: "Failed to generate authentication options",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
