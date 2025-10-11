// src/app/api/admin/dmdata-api-keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { encrypt, decrypt } from "@/app/lib/security/encryption";

/**
 * API Key一覧取得
 * GET /api/admin/dmdata-api-keys
 */
export async function GET(request: NextRequest) {
  try {
    const apiKeys = await prisma.dmdataApiKey.findMany({
      orderBy: { createdAt: "desc" },
    });

    // APIキーを復号化して返す（マスク表示用）
    const keys = apiKeys.map((key) => {
      try {
        const payload = JSON.parse(key.apiKey);
        const decrypted = decrypt(payload);
        const masked = decrypted
          ? `${decrypted.slice(0, 8)}...${decrypted.slice(-4)}`
          : "****";

        return {
          id: key.id,
          description: key.description,
          maskedKey: masked,
          isActive: key.isActive,
          createdAt: key.createdAt,
          updatedAt: key.updatedAt,
        };
      } catch (error) {
        console.error("Failed to decrypt API key:", error);
        return {
          id: key.id,
          description: key.description,
          maskedKey: "****",
          isActive: key.isActive,
          createdAt: key.createdAt,
          updatedAt: key.updatedAt,
        };
      }
    });

    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    console.error("Failed to fetch API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

/**
 * API Key登録
 * POST /api/admin/dmdata-api-keys
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, description } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // 既存のAPIキーと重複チェック
    const existingKeys = await prisma.dmdataApiKey.findMany();
    for (const existingKey of existingKeys) {
      try {
        const payload = JSON.parse(existingKey.apiKey);
        const decrypted = decrypt(payload);
        if (decrypted === apiKey) {
          return NextResponse.json(
            { error: "このAPIキーは既に登録されています" },
            { status: 400 }
          );
        }
      } catch (error) {
        // 復号化エラーは無視して次へ
        console.error("Failed to decrypt existing key for comparison:", error);
      }
    }

    // APIキーを暗号化して保存
    const encrypted = encrypt(apiKey);
    const encryptedJson = JSON.stringify(encrypted);

    // 既存の有効なキーを無効化
    await prisma.dmdataApiKey.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const newKey = await prisma.dmdataApiKey.create({
      data: {
        apiKey: encryptedJson,
        description: description || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      apiKey: {
        id: newKey.id,
        description: newKey.description,
        maskedKey: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to create API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
