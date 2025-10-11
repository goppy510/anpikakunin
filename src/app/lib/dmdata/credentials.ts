// src/app/lib/dmdata/credentials.ts
/**
 * DMData.jp 認証情報取得ヘルパー
 */

import { prisma } from "@/app/lib/db/prisma";
import { decrypt } from "@/app/lib/security/encryption";
import { env } from "@/app/lib/env";

/**
 * 有効なAPI Keyをデータベースから取得
 * データベースに登録がない場合は環境変数から取得
 */
export async function getDmdataApiKey(): Promise<string | null> {
  try {
    // データベースから有効なAPI Keyを取得
    const apiKeyRecord = await prisma.dmdataApiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (apiKeyRecord) {
      try {
        const payload = JSON.parse(apiKeyRecord.apiKey);
        const decrypted = decrypt(payload);
        if (decrypted) {
          console.log("Using DMData API key from database");
          return decrypted;
        }
      } catch (error) {
        console.error("Failed to decrypt API key from database:", error);
      }
    }

    // データベースに登録がない場合、環境変数から取得
    const envKey = env.DMDATA_API_KEY;
    if (envKey) {
      console.log("Using DMData API key from environment variable");
      return envKey;
    }

    console.warn("No DMData API key found in database or environment");
    return null;
  } catch (error) {
    console.error("Failed to get DMData API key:", error);
    // エラー時は環境変数から取得を試みる
    return env.DMDATA_API_KEY || null;
  }
}
