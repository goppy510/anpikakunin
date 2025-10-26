import { NextRequest, NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";
import { prisma } from "@/app/lib/db/prisma";

const RP_NAME = process.env.NEXT_PUBLIC_RP_NAME || "安否確認システム";
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";

/**
 * パスキー登録用のチャレンジを生成
 * POST /api/auth/passkey/registration-options
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // ユーザー存在チェック
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        passkeys: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 既存のパスキーを除外リストに追加
    const excludeCredentials = user.passkeys.map((passkey) => ({
      id: Buffer.from(passkey.credentialId).toString("base64url"),
      type: "public-key" as const,
      transports: passkey.transports as AuthenticatorTransport[],
    }));

    const options: GenerateRegistrationOptionsOpts = {
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.email,
      timeout: 60000, // 60秒
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        // authenticatorAttachmentを指定しない = ブラウザが最適な方法を選択
        // Touch IDがあれば優先的に使われる
        residentKey: "preferred",
        userVerification: "preferred",
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    };

    const registrationOptions = await generateRegistrationOptions(options);

    // チャレンジをDBに保存（60秒有効）
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + 60);

    await prisma.webAuthnChallenge.create({
      data: {
        userId: user.id,
        challenge: registrationOptions.challenge,
        type: "registration",
        expiresAt,
      },
    });

    return NextResponse.json({
      options: registrationOptions,
    });
  } catch (error: any) {
    console.error("Registration options error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      {
        error: "Failed to generate registration options",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
