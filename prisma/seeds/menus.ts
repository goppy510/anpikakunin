import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const menus = [
  {
    name: "ダッシュボード",
    path: "/admin",
    icon: "🏠",
    displayOrder: 0,
    categoryPermission: "", // 全ユーザーアクセス可
  },
  {
    name: "ワークスペース",
    path: "/admin/workspaces",
    icon: "🔗",
    displayOrder: 10,
    categoryPermission: "workspace:read",
  },
  {
    name: "メンバー管理",
    path: "/admin/members",
    icon: "👤",
    displayOrder: 20,
    categoryPermission: "member:read",
  },
  {
    name: "グループ管理",
    path: "/admin/groups",
    icon: "🔐",
    displayOrder: 30,
    categoryPermission: "group:read",
  },
  {
    name: "部署設定",
    path: "/admin/departments",
    icon: "👥",
    displayOrder: 40,
    categoryPermission: "department:read",
  },
  {
    name: "通知条件",
    path: "/admin/conditions",
    icon: "⚙️",
    displayOrder: 50,
    categoryPermission: "condition:read",
  },
  {
    name: "メッセージ設定",
    path: "/admin/messages",
    icon: "💬",
    displayOrder: 60,
    categoryPermission: "message:read",
  },
];

export async function seedMenus() {
  console.log("📋 メニューマスターデータをシード中...");

  for (const menu of menus) {
    await prisma.menu.upsert({
      where: { path: menu.path },
      update: {
        name: menu.name,
        icon: menu.icon,
        displayOrder: menu.displayOrder,
        categoryPermission: menu.categoryPermission,
      },
      create: menu,
    });
  }

  console.log(`✅ ${menus.length}件のメニューをシードしました`);
}

async function main() {
  await seedMenus();
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
