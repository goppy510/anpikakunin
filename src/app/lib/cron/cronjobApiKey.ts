// cron-job.org APIキー取得ヘルパー
import { prisma } from "@/app/lib/db/prisma";
import { decrypt } from "@/app/lib/security/encryption";
import { env } from "@/app/lib/env";

/**
 * cron-job.org APIキーを取得（DB優先、環境変数フォールバック）
 */
export async function getCronJobApiKey(): Promise<string | null> {
  try {
    // DBから有効なAPIキーを取得
    const dbKey = await prisma.cronJobApiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (dbKey) {
      try {
        const payload = JSON.parse(dbKey.apiKey);
        const decrypted = decrypt(payload);
        if (decrypted) {
          console.log("✅ Using cron-job.org API key from database");
          return decrypted;
        }
      } catch (error) {
        console.error("Failed to decrypt cron-job.org API key from DB:", error);
      }
    }

    // 環境変数フォールバック
    if (env.CRONJOB_API_KEY) {
      console.log("⚠️ Using cron-job.org API key from environment variable (fallback)");
      return env.CRONJOB_API_KEY;
    }

    console.warn("⚠️ No cron-job.org API key found (neither DB nor environment variable)");
    return null;
  } catch (error) {
    console.error("Failed to get cron-job.org API key:", error);

    // エラー時は環境変数フォールバック
    if (env.CRONJOB_API_KEY) {
      console.log("⚠️ Using cron-job.org API key from environment variable (error fallback)");
      return env.CRONJOB_API_KEY;
    }

    return null;
  }
}
