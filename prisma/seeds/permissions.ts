import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  // ワークスペース
  {
    name: "workspace:read",
    displayName: "ワークスペース閲覧",
    description: "ワークスペース情報の閲覧",
    category: "workspace",
  },
  {
    name: "workspace:write",
    displayName: "ワークスペース編集",
    description: "ワークスペース情報の作成・編集",
    category: "workspace",
  },
  {
    name: "workspace:delete",
    displayName: "ワークスペース削除",
    description: "ワークスペースの削除",
    category: "workspace",
  },

  // 部署設定
  {
    name: "department:read",
    displayName: "部署閲覧",
    description: "部署情報の閲覧",
    category: "department",
  },
  {
    name: "department:write",
    displayName: "部署編集",
    description: "部署の作成・編集",
    category: "department",
  },
  {
    name: "department:delete",
    displayName: "部署削除",
    description: "部署の削除",
    category: "department",
  },

  // 通知条件
  {
    name: "condition:read",
    displayName: "通知条件閲覧",
    description: "通知条件の閲覧",
    category: "condition",
  },
  {
    name: "condition:write",
    displayName: "通知条件編集",
    description: "通知条件の作成・編集",
    category: "condition",
  },
  {
    name: "condition:delete",
    displayName: "通知条件削除",
    description: "通知条件の削除",
    category: "condition",
  },

  // メッセージ設定
  {
    name: "message:read",
    displayName: "メッセージ閲覧",
    description: "メッセージテンプレートの閲覧",
    category: "message",
  },
  {
    name: "message:write",
    displayName: "メッセージ編集",
    description: "メッセージテンプレートの編集",
    category: "message",
  },

  // メンバー管理
  {
    name: "member:read",
    displayName: "メンバー閲覧",
    description: "メンバー情報の閲覧",
    category: "member",
  },
  {
    name: "member:write",
    displayName: "メンバー編集",
    description: "メンバー情報の編集",
    category: "member",
  },
  {
    name: "member:delete",
    displayName: "メンバー削除",
    description: "メンバーの削除",
    category: "member",
  },
  {
    name: "member:invite",
    displayName: "メンバー招待",
    description: "新規メンバーの招待",
    category: "member",
  },

  // グループ管理
  {
    name: "group:read",
    displayName: "グループ閲覧",
    description: "グループ情報の閲覧",
    category: "group",
  },
  {
    name: "group:write",
    displayName: "グループ編集",
    description: "グループの作成・編集",
    category: "group",
  },
  {
    name: "group:delete",
    displayName: "グループ削除",
    description: "グループの削除",
    category: "group",
  },
  {
    name: "group:attach_permission",
    displayName: "グループ権限管理",
    description: "グループへの権限アタッチ・デタッチ",
    category: "group",
  },
];

export async function seedPermissions() {
  // Silenced

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        displayName: permission.displayName,
        description: permission.description,
        category: permission.category,
      },
      create: permission,
    });
  }

  // Silenced
}

async function main() {
  await seedPermissions();
}

if (require.main === module) {
  main()
    .catch(() => {
      // Silenced
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
