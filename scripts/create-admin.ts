#!/usr/bin/env ts-node

/**
 * 初回管理者アカウント作成スクリプト
 *
 * 使用方法:
 *   docker-compose exec anpikakunin npx ts-node scripts/create-admin.ts
 */

import { createInterface } from "readline";
import { prisma } from "../src/app/lib/db/prisma";
import { hashPassword, validatePasswordStrength } from "../src/app/lib/auth/password";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {

  // メールアドレス入力
  const email = await question("メールアドレス: ");

  if (!email || !email.includes("@")) {
    process.exit(1);
  }

  // 既存ユーザーチェック
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    process.exit(1);
  }

  // パスワード入力
  const password = await question("パスワード（8文字以上、英数字を含む）: ");

  // パスワード強度チェック
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    passwordValidation.errors.forEach((error) => {
    });
    process.exit(1);
  }

  // パスワード確認
  const passwordConfirm = await question("パスワード（確認）: ");

  if (password !== passwordConfirm) {
    process.exit(1);
  }

  // ハッシュ化
  const passwordHash = await hashPassword(password);

  // ユーザー作成
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
      emailVerified: true, // 初回管理者は自動的にメール確認済み
    },
  });


  rl.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  rl.close();
  prisma.$disconnect();
  process.exit(1);
});
