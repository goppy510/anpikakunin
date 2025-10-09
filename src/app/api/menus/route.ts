import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth/middleware";
import { prisma } from "@/app/lib/db/prisma";

/**
 * GET /api/menus
 * メニュー一覧取得（権限チェック済み）
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const userId = authCheck.user.id;

  try {
    // 全メニュー取得
    const allMenus = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    // 管理者は全メニュー表示
    if (authCheck.user.role === "ADMIN") {
      return NextResponse.json({
        menus: allMenus.map((m) => ({
          name: m.name,
          path: m.path,
          icon: m.icon,
          requiredPermission: m.categoryPermission,
        })),
      });
    }

    // 一般ユーザーは権限チェック
    // ユーザーの全権限取得（グループ経由 + 直接アタッチ）
    const directPermissions = await prisma.userPermissionAttachment.findMany({
      where: { userId },
      include: { permission: true },
    });

    const groupPermissions = await prisma.userGroupMembership.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const userPermissions = new Set<string>();

    directPermissions.forEach((p) => {
      userPermissions.add(p.permission.name);
    });

    groupPermissions.forEach((gm) => {
      gm.group.permissions.forEach((gp) => {
        userPermissions.add(gp.permission.name);
      });
    });

    // 権限があるメニューのみフィルタリング
    const filteredMenus = allMenus.filter((menu) => {
      // categoryPermissionが空文字の場合は全ユーザーアクセス可
      if (!menu.categoryPermission || menu.categoryPermission === "") {
        return true;
      }
      return userPermissions.has(menu.categoryPermission);
    });

    return NextResponse.json({
      menus: filteredMenus.map((m) => ({
        name: m.name,
        path: m.path,
        icon: m.icon,
        requiredPermission: m.categoryPermission,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch menus:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
