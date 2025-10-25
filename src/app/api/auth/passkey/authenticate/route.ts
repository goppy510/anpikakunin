import { NextRequest, NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";
import { prisma } from "@/app/lib/db/prisma";
import crypto from "crypto";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000";

/**
 * パスキー認証の検証・ログイン
 * POST /api/auth/passkey/authenticate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, credential } = body;

    if (!email || !credential) {
      return NextResponse.json(
        { error: "email and credential are required" },
        { status: 400 }
      );
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

    // チャレンジ取得
    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        userId: user.id,
        type: "authentication",
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

    // 使用されたパスキーを特定
    const credentialIdBuffer = Buffer.from(credential.rawId, "base64");
    const passkey = user.passkeys.find((pk) =>
      pk.credentialId.equals(credentialIdBuffer)
    );

    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 400 }
      );
    }

    // WebAuthn検証
    const opts: VerifyAuthenticationResponseOpts = {
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: passkey.credentialId,
        credentialPublicKey: passkey.publicKey,
        counter: Number(passkey.counter),
      },
      requireUserVerification: false, // preferredなのでfalse
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 400 }
      );
    }

    // カウンターを更新（リプレイ攻撃防止）
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // 使用済みチャレンジを削除
    await prisma.webAuthnChallenge.delete({
      where: { id: challengeRecord.id },
    });

    // セッション作成
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7日間有効

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    });

    const response = NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      message: "Authentication successful",
    });

    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("Passkey authentication error:", error);
    return NextResponse.json(
      { error: "Failed to authenticate" },
      { status: 500 }
    );
  }
}
