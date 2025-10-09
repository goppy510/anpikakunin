import { prisma } from "./prisma";

// ==================== Types ====================

export type GroupInput = {
  name: string;
  description?: string;
  isActive?: boolean;
};

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  memberCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupDetail = GroupSummary & {
  members: {
    id: string;
    email: string;
    role: string;
  }[];
  permissions: {
    id: string;
    name: string;
    displayName: string;
    category: string;
  }[];
};

// ==================== CRUD Operations ====================

/**
 * グループ一覧取得
 */
export const listGroups = async (): Promise<GroupSummary[]> => {
  const groups = await prisma.group.findMany({
    include: {
      _count: {
        select: {
          members: true,
          permissions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    isActive: g.isActive,
    memberCount: g._count.members,
    permissionCount: g._count.permissions,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));
};

/**
 * グループ詳細取得
 */
export const getGroupById = async (id: string): Promise<GroupDetail | null> => {
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      },
      permissions: {
        include: {
          permission: {
            select: {
              id: true,
              name: true,
              displayName: true,
              category: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
          permissions: true,
        },
      },
    },
  });

  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    isActive: group.isActive,
    memberCount: group._count.members,
    permissionCount: group._count.permissions,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    members: group.members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      role: m.user.role,
    })),
    permissions: group.permissions.map((p) => ({
      id: p.permission.id,
      name: p.permission.name,
      displayName: p.permission.displayName,
      category: p.permission.category,
    })),
  };
};

/**
 * グループ作成
 */
export const createGroup = async (input: GroupInput): Promise<GroupSummary> => {
  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      isActive: input.isActive ?? true,
    },
    include: {
      _count: {
        select: {
          members: true,
          permissions: true,
        },
      },
    },
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    isActive: group.isActive,
    memberCount: group._count.members,
    permissionCount: group._count.permissions,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
};

/**
 * グループ更新
 */
export const updateGroup = async (
  id: string,
  input: Partial<GroupInput>
): Promise<GroupSummary> => {
  const group = await prisma.group.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: {
      _count: {
        select: {
          members: true,
          permissions: true,
        },
      },
    },
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    isActive: group.isActive,
    memberCount: group._count.members,
    permissionCount: group._count.permissions,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
};

/**
 * グループ削除
 */
export const deleteGroup = async (id: string): Promise<void> => {
  await prisma.group.delete({
    where: { id },
  });
};

// ==================== Member Management ====================

/**
 * グループにユーザーを追加
 */
export const addUserToGroup = async (
  groupId: string,
  userId: string
): Promise<void> => {
  await prisma.userGroupMembership.create({
    data: {
      groupId,
      userId,
    },
  });
};

/**
 * グループからユーザーを削除
 */
export const removeUserFromGroup = async (
  groupId: string,
  userId: string
): Promise<void> => {
  await prisma.userGroupMembership.deleteMany({
    where: {
      groupId,
      userId,
    },
  });
};

// ==================== Permission Management ====================

/**
 * グループに権限をアタッチ
 */
export const attachPermissionToGroup = async (
  groupId: string,
  permissionId: string
): Promise<void> => {
  await prisma.groupPermissionAttachment.create({
    data: {
      groupId,
      permissionId,
    },
  });
};

/**
 * グループから権限をデタッチ
 */
export const detachPermissionFromGroup = async (
  groupId: string,
  permissionId: string
): Promise<void> => {
  await prisma.groupPermissionAttachment.deleteMany({
    where: {
      groupId,
      permissionId,
    },
  });
};
