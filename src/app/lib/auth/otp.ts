/**
 * OTP（ワンタイムパスワード）生成・検証ユーティリティ
 */

import { prisma } from "@/app/lib/db/prisma";

/**
 * 6桁のOTPコードを生成
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * OTPコードを作成してDBに保存
 * @param userId ユーザーID
 * @param expiryMinutes 有効期限（分）
 * @returns 生成されたOTPコード
 */
export async function createOtpCode(
  userId: string,
  expiryMinutes: number = 5
): Promise<string> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      userId,
      code,
      expiresAt,
    },
  });

  return code;
}

/**
 * OTPコードを検証
 * @param userId ユーザーID
 * @param code 入力されたコード
 * @returns 検証結果
 */
export async function verifyOtpCode(
  userId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      userId,
      code,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!otpRecord) {
    return {
      valid: false,
      error: "無効または期限切れのコードです",
    };
  }

  // コードを使用済みにマーク
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  return { valid: true };
}

/**
 * 期限切れOTPコードをクリーンアップ
 */
export async function cleanupExpiredOtpCodes(): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
