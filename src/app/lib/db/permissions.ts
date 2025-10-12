import { prisma } from "./prisma";

// ==================== Types ====================

export type PermissionInput = {
  name: string;
  displayName: string;
  description?: string;
  category: string;
};

export type PermissionSummary = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
};

// ==================== CRUD Operations ====================

/**
 * 権限一覧取得
 */
export const listPermissions = async (): Promise<PermissionSummary[]> => {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return permissions.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    category: p.category,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
};

/**
 * カテゴリ別権限一覧取得
 */
export const listPermissionsByCategory = async (
  category: string
): Promise<PermissionSummary[]> => {
  const permissions = await prisma.permission.findMany({
    where: { category },
    orderBy: { name: "asc" },
  });

  return permissions.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    category: p.category,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
};

/**
 * 権限詳細取得
 */
export const getPermissionById = async (
  id: string
): Promise<PermissionSummary | null> => {
  const permission = await prisma.permission.findUnique({
    where: { id },
  });

  if (!permission) return null;

  return {
    id: permission.id,
    name: permission.name,
    displayName: permission.displayName,
    description: permission.description,
    category: permission.category,
    createdAt: permission.createdAt.toISOString(),
    updatedAt: permission.updatedAt.toISOString(),
  };
};

/**
 * 権限作成
 */
export const createPermission = async (
  input: PermissionInput
): Promise<PermissionSummary> => {
  const permission = await prisma.permission.create({
    data: {
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      category: input.category,
    },
  });

  return {
    id: permission.id,
    name: permission.name,
    displayName: permission.displayName,
    description: permission.description,
    category: permission.category,
    createdAt: permission.createdAt.toISOString(),
    updatedAt: permission.updatedAt.toISOString(),
  };
};

/**
 * 権限更新
 */
export const updatePermission = async (
  id: string,
  input: Partial<PermissionInput>
): Promise<PermissionSummary> => {
  const permission = await prisma.permission.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.displayName && { displayName: input.displayName }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.category && { category: input.category }),
    },
  });

  return {
    id: permission.id,
    name: permission.name,
    displayName: permission.displayName,
    description: permission.description,
    category: permission.category,
    createdAt: permission.createdAt.toISOString(),
    updatedAt: permission.updatedAt.toISOString(),
  };
};

/**
 * 権限削除
 */
export const deletePermission = async (id: string): Promise<void> => {
  await prisma.permission.delete({
    where: { id },
  });
};

// ==================== User Permission Management ====================

/**
 * ユーザーに権限を直接アタッチ
 */
export const attachPermissionToUser = async (
  userId: string,
  permissionId: string
): Promise<void> => {
  await prisma.userPermissionAttachment.create({
    data: {
      userId,
      permissionId,
    },
  });
};

/**
 * ユーザーから権限をデタッチ
 */
export const detachPermissionFromUser = async (
  userId: string,
  permissionId: string
): Promise<void> => {
  await prisma.userPermissionAttachment.deleteMany({
    where: {
      userId,
      permissionId,
    },
  });
};

/**
 * ユーザーの全権限取得（グループ経由 + 直接アタッチ）
 */
export const getUserPermissions = async (
  userId: string
): Promise<PermissionSummary[]> => {
  // 直接アタッチされた権限
  const directPermissions = await prisma.userPermissionAttachment.findMany({
    where: { userId },
    include: {
      permission: true,
    },
  });

  // グループ経由の権限
  const groupPermissions = await prisma.userGroupMembership.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // 重複を排除してマージ
  const permissionMap = new Map<string, PermissionSummary>();

  directPermissions.forEach((p) => {
    permissionMap.set(p.permission.id, {
      id: p.permission.id,
      name: p.permission.name,
      displayName: p.permission.displayName,
      description: p.permission.description,
      category: p.permission.category,
      createdAt: p.permission.createdAt.toISOString(),
      updatedAt: p.permission.updatedAt.toISOString(),
    });
  });

  groupPermissions.forEach((gm) => {
    gm.group.permissions.forEach((gp) => {
      permissionMap.set(gp.permission.id, {
        id: gp.permission.id,
        name: gp.permission.name,
        displayName: gp.permission.displayName,
        description: gp.permission.description,
        category: gp.permission.category,
        createdAt: gp.permission.createdAt.toISOString(),
        updatedAt: gp.permission.updatedAt.toISOString(),
      });
    });
  });

  return Array.from(permissionMap.values()).sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  );
};
