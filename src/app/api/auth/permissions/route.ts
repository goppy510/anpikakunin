import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth/middleware";
import { getUserPermissions } from "@/app/lib/db/permissions";
import { prisma } from "@/app/lib/db/prisma";

/**
 * GET /api/auth/permissions
 * ログインユーザーの全権限取得（グループ経由含む）
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const userId = authCheck.user.id;

  try {
    // ユーザーの所属グループ取得
    const userGroups = await prisma.userGroupMembership.findMany({
      where: { userId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const groupNames = userGroups.map((ug) => ug.group.name);

    // 管理者は全権限を持つ
    if (authCheck.user.role === "ADMIN") {
      const allPermissions = await prisma.permission.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });

      return NextResponse.json({
        permissions: allPermissions.map((p) => p.name),
        groups: groupNames,
        isAdmin: true,
      });
    }

    // 一般ユーザーは個別権限 + グループ権限
    const permissions = await getUserPermissions(userId);

    return NextResponse.json({
      permissions: permissions.map((p) => p.name),
      groups: groupNames,
      isAdmin: false,
    });
  } catch (error) {
    console.error("Failed to fetch user permissions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
