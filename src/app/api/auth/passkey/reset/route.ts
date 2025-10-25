import { NextRequest, NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from "@simplewebauthn/server";
import { prisma } from "@/app/lib/db/prisma";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000";

/**
 * パスキー再登録（トークン検証後）
 * POST /api/auth/passkey/reset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, credential, deviceName } = body;

    if (!token || !credential) {
      return NextResponse.json(
        { error: "token and credential are required" },
        { status: 400 }
      );
    }

    // トークン検証
    const resetToken = await prisma.passkeyResetToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            passkeys: true,
          },
        },
      },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    if (resetToken.used) {
      return NextResponse.json(
        { error: "Token already used" },
        { status: 400 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 400 }
      );
    }

    // チャレンジ取得
    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        userId: resetToken.userId,
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
      requireUserVerification: false,
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

    const transports = credential.response?.transports || [];

    // 既存のパスキーを削除（再登録なので）
    await prisma.passkey.deleteMany({
      where: {
        userId: resetToken.userId,
      },
    });

    // 新しいパスキーを保存
    const passkey = await prisma.passkey.create({
      data: {
        userId: resetToken.userId,
        credentialId: Buffer.from(credentialID),
        publicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        deviceName: deviceName || null,
        transports,
      },
    });

    // トークンを使用済みにする
    await prisma.passkeyResetToken.update({
      where: { id: resetToken.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // 使用済みチャレンジを削除
    await prisma.webAuthnChallenge.delete({
      where: { id: challengeRecord.id },
    });

    return NextResponse.json({
      success: true,
      passkeyId: passkey.id,
      message: "Passkey reset successfully",
    });
  } catch (error) {
    console.error("Passkey reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset passkey" },
      { status: 500 }
    );
  }
}
