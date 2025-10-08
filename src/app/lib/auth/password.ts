/**
 * パスワードハッシュ化・検証ユーティリティ
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * パスワードをbcryptでハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * パスワードとハッシュを検証
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * パスワード強度チェック
 * 最小8文字、英数字を含む
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("パスワードは8文字以上である必要があります");
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push("パスワードは英字を含む必要があります");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("パスワードは数字を含む必要があります");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
