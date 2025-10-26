import { NextRequest, NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from "@simplewebauthn/server";
import { prisma } from "@/app/lib/db/prisma";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000";

/**
 * パスキー登録の検証・保存
 * POST /api/auth/passkey/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, credential, deviceName } = body;

    if (!userId || !credential) {
      return NextResponse.json(
        { error: "userId and credential are required" },
        { status: 400 }
      );
    }

    // ユーザー存在チェック
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // チャレンジ取得
    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        userId: user.id,
        type: "registration",
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!challengeRecord) {
      return NextResponse.json(
        { error: "Challenge not found or expired" },
        { status: 400 }
      );
    }

    // WebAuthn検証
    const opts: VerifyRegistrationResponseOpts = {
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false, // preferredなのでfalse
    };

    const verification = await verifyRegistrationResponse(opts);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const { credentialPublicKey, credentialID, counter } =
      verification.registrationInfo;

    // トランスポート情報を取得
    const transports = credential.response?.transports || [];

    // パスキーをDBに保存
    const passkey = await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: Buffer.from(credentialID),
        publicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        deviceName: deviceName || null,
        transports,
      },
    });

    // 使用済みチャレンジを削除
    await prisma.webAuthnChallenge.delete({
      where: { id: challengeRecord.id },
    });

    return NextResponse.json({
      success: true,
      passkeyId: passkey.id,
      message: "Passkey registered successfully",
    });
  } catch (error) {
    console.error("Passkey registration error:", error);
    return NextResponse.json(
      { error: "Failed to register passkey" },
      { status: 500 }
    );
  }
}
