/**
 * 認証ミドルウェア
 *
 * APIルートやページで認証・認可をチェックするためのユーティリティ
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserBySession } from "./session";
import { getUserPermissions } from "@/app/lib/db/permissions";
import type { User, UserRole } from "@prisma/client";

export type AuthUser = User;

/**
 * リクエストからセッショントークンを取得
 */
export function getSessionToken(request: NextRequest): string | null {
  // Authorizationヘッダーから取得
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Cookieから取得
  const cookieToken = request.cookies.get("session_token")?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * リクエストから認証済みユーザーを取得
 * 未認証の場合はnullを返す
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  return getUserBySession(token);
}

/**
 * 認証が必要なAPIエンドポイント用ミドルウェア
 * 未認証の場合は401を返す
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "認証が必要です" },
      { status: 401 }
    );
  }

  return { user };
}

/**
 * 特定の権限が必要なAPIエンドポイント用ミドルウェア
 * 権限がない場合は403を返す
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<{ user: AuthUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult; // 認証エラー
  }

  const { user } = authResult;

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: "この操作を実行する権限がありません" },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * 管理者権限が必要なAPIエンドポイント用ミドルウェア
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  return requireRole(request, ["ADMIN"]);
}

/**
 * 設定権限以上が必要なAPIエンドポイント用ミドルウェア
 * （EDITORまたはADMIN）
 */
export async function requireEditor(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  return requireRole(request, ["EDITOR", "ADMIN"]);
}

/**
 * 特定の権限（permission）が必要なAPIエンドポイント用ミドルウェア
 * ADMINロールは全ての権限を持つものとして扱う
 */
export async function requirePermission(
  request: NextRequest,
  requiredPermissions: string[]
): Promise<{ user: AuthUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult; // 認証エラー
  }

  const { user } = authResult;

  // ADMINロールは全ての権限を持つ
  if (user.role === "ADMIN") {
    return { user };
  }

  // ユーザーの権限を取得
  const userPermissions = await getUserPermissions(user.id);
  const permissionNames = userPermissions.map((p) => p.name);

  // いずれかの権限を持っているかチェック
  const hasPermission = requiredPermissions.some((perm) =>
    permissionNames.includes(perm)
  );

  if (!hasPermission) {
    return NextResponse.json(
      { error: "この操作を実行する権限がありません" },
      { status: 403 }
    );
  }

  return { user };
}
