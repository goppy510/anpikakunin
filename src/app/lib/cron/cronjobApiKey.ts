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
          return decrypted;
        }
      } catch (error) {
      }
    }

    // 環境変数フォールバック
    if (env.CRONJOB_API_KEY) {
      return env.CRONJOB_API_KEY;
    }

    return null;
  } catch (error) {

    // エラー時は環境変数フォールバック
    if (env.CRONJOB_API_KEY) {
      return env.CRONJOB_API_KEY;
    }

    return null;
  }
}
