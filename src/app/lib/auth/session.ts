/**
 * セッション管理ユーティリティ
 */

import { randomUUID } from "crypto";
import { prisma } from "@/app/lib/db/prisma";
import type { User } from "@prisma/client";

const SESSION_EXPIRY_DAYS = 7;

/**
 * 新しいセッションを作成
 * @param userId ユーザーID
 * @returns セッショントークン
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

/**
 * セッショントークンからユーザー情報を取得
 * @param token セッショントークン
 * @returns ユーザー情報（セッションが無効な場合はnull）
 */
export async function getUserBySession(
  token: string
): Promise<User | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // 期限切れチェック
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({
      where: { id: session.id },
    });
    return null;
  }

  // 無効化されたユーザーはセッション無効
  if (!session.user.isActive) {
    return null;
  }

  return session.user;
}

/**
 * セッションを削除（ログアウト）
 * @param token セッショントークン
 */
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.delete({
    where: { token },
  });
}

/**
 * ユーザーのすべてのセッションを削除
 * @param userId ユーザーID
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * 期限切れセッションをクリーンアップ
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
