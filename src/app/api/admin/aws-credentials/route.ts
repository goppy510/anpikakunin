import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { encrypt, decrypt } from "@/app/lib/security/encryption";

/**
 * AWS認証情報管理API（管理者のみ）
 * EventBridge Scheduler用のAWS Access Key / Secret Keyを管理
 */

// 管理者認証チェック（簡易版）
function isAdmin(request: NextRequest): boolean {
  // TODO: 実際の管理者認証ロジックに置き換える
  const adminPassword = request.headers.get("x-admin-password");
  return adminPassword === "admin123";
}

/**
 * GET: AWS認証情報の取得（復号化せずに存在確認のみ）
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const credential = await prisma.awsCredential.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        region: true,
        eventBridgeRoleArn: true,
        apiDestinationArn: true,
        connectionArn: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // 暗号化された認証情報は返さない
      },
    });

    if (!credential) {
      return NextResponse.json({
        configured: false,
        message: "AWS認証情報が未設定です"
      });
    }

    return NextResponse.json({
      configured: true,
      credential,
    });
  } catch (error: any) {
    console.error("Failed to get AWS credentials:", error);
    return NextResponse.json(
      { error: "Failed to get AWS credentials" },
      { status: 500 }
    );
  }
}

/**
 * POST: AWS認証情報の保存（暗号化して保存）
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accessKeyId, secretAccessKey, region } = body;

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: "accessKeyId and secretAccessKey are required" },
        { status: 400 }
      );
    }

    // AWS Access Key IDの形式チェック（簡易）
    if (!/^AKIA[0-9A-Z]{16}$/.test(accessKeyId)) {
      return NextResponse.json(
        { error: "Invalid AWS Access Key ID format" },
        { status: 400 }
      );
    }

    // 既存の認証情報を無効化
    await prisma.awsCredential.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // 暗号化して保存
    const encryptedAccessKey = encrypt(accessKeyId);
    const encryptedSecretKey = encrypt(secretAccessKey);

    const credential = await prisma.awsCredential.create({
      data: {
        accessKeyId: `${encryptedAccessKey.ciphertext}:${encryptedAccessKey.iv}:${encryptedAccessKey.authTag}`,
        secretAccessKey: `${encryptedSecretKey.ciphertext}:${encryptedSecretKey.iv}:${encryptedSecretKey.authTag}`,
        region: region || "ap-northeast-1",
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "AWS認証情報を保存しました",
      credentialId: credential.id,
    });
  } catch (error: any) {
    console.error("Failed to save AWS credentials:", error);
    return NextResponse.json(
      { error: "Failed to save AWS credentials", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE: AWS認証情報の削除
 */
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 全てのAWS認証情報を無効化
    await prisma.awsCredential.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "AWS認証情報を削除しました",
    });
  } catch (error: any) {
    console.error("Failed to delete AWS credentials:", error);
    return NextResponse.json(
      { error: "Failed to delete AWS credentials" },
      { status: 500 }
    );
  }
}

/**
 * AWS認証情報を復号化して取得（内部使用のみ）
 */
export async function getDecryptedAwsCredentials(): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
} | null> {
  try {
    const credential = await prisma.awsCredential.findFirst({
      where: { isActive: true },
    });

    if (!credential) {
      return null;
    }

    // 暗号化データを分割
    const [accessKeyCiphertext, accessKeyIv, accessKeyTag] = credential.accessKeyId.split(":");
    const [secretKeyCiphertext, secretKeyIv, secretKeyTag] = credential.secretAccessKey.split(":");

    // 復号化
    const accessKeyId = decrypt({
      ciphertext: accessKeyCiphertext,
      iv: accessKeyIv,
      authTag: accessKeyTag,
    });

    const secretAccessKey = decrypt({
      ciphertext: secretKeyCiphertext,
      iv: secretKeyIv,
      authTag: secretKeyTag,
    });

    return {
      accessKeyId,
      secretAccessKey,
      region: credential.region,
    };
  } catch (error) {
    console.error("Failed to decrypt AWS credentials:", error);
    return null;
  }
}
