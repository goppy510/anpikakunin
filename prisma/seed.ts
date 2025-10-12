import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 47都道府県マスターデータ
const PREFECTURES = [
  {
    code: "01",
    name: "北海道",
    nameKana: "ほっかいどう",
    region: "北海道",
    displayOrder: 1,
  },
  {
    code: "02",
    name: "青森県",
    nameKana: "あおもりけん",
    region: "東北",
    displayOrder: 2,
  },
  {
    code: "03",
    name: "岩手県",
    nameKana: "いわてけん",
    region: "東北",
    displayOrder: 3,
  },
  {
    code: "04",
    name: "宮城県",
    nameKana: "みやぎけん",
    region: "東北",
    displayOrder: 4,
  },
  {
    code: "05",
    name: "秋田県",
    nameKana: "あきたけん",
    region: "東北",
    displayOrder: 5,
  },
  {
    code: "06",
    name: "山形県",
    nameKana: "やまがたけん",
    region: "東北",
    displayOrder: 6,
  },
  {
    code: "07",
    name: "福島県",
    nameKana: "ふくしまけん",
    region: "東北",
    displayOrder: 7,
  },
  {
    code: "08",
    name: "茨城県",
    nameKana: "いばらきけん",
    region: "関東",
    displayOrder: 8,
  },
  {
    code: "09",
    name: "栃木県",
    nameKana: "とちぎけん",
    region: "関東",
    displayOrder: 9,
  },
  {
    code: "10",
    name: "群馬県",
    nameKana: "ぐんまけん",
    region: "関東",
    displayOrder: 10,
  },
  {
    code: "11",
    name: "埼玉県",
    nameKana: "さいたまけん",
    region: "関東",
    displayOrder: 11,
  },
  {
    code: "12",
    name: "千葉県",
    nameKana: "ちばけん",
    region: "関東",
    displayOrder: 12,
  },
  {
    code: "13",
    name: "東京都",
    nameKana: "とうきょうと",
    region: "関東",
    displayOrder: 13,
  },
  {
    code: "14",
    name: "神奈川県",
    nameKana: "かながわけん",
    region: "関東",
    displayOrder: 14,
  },
  {
    code: "15",
    name: "新潟県",
    nameKana: "にいがたけん",
    region: "中部",
    displayOrder: 15,
  },
  {
    code: "16",
    name: "富山県",
    nameKana: "とやまけん",
    region: "中部",
    displayOrder: 16,
  },
  {
    code: "17",
    name: "石川県",
    nameKana: "いしかわけん",
    region: "中部",
    displayOrder: 17,
  },
  {
    code: "18",
    name: "福井県",
    nameKana: "ふくいけん",
    region: "中部",
    displayOrder: 18,
  },
  {
    code: "19",
    name: "山梨県",
    nameKana: "やまなしけん",
    region: "中部",
    displayOrder: 19,
  },
  {
    code: "20",
    name: "長野県",
    nameKana: "ながのけん",
    region: "中部",
    displayOrder: 20,
  },
  {
    code: "21",
    name: "岐阜県",
    nameKana: "ぎふけん",
    region: "中部",
    displayOrder: 21,
  },
  {
    code: "22",
    name: "静岡県",
    nameKana: "しずおかけん",
    region: "中部",
    displayOrder: 22,
  },
  {
    code: "23",
    name: "愛知県",
    nameKana: "あいちけん",
    region: "中部",
    displayOrder: 23,
  },
  {
    code: "24",
    name: "三重県",
    nameKana: "みえけん",
    region: "近畿",
    displayOrder: 24,
  },
  {
    code: "25",
    name: "滋賀県",
    nameKana: "しがけん",
    region: "近畿",
    displayOrder: 25,
  },
  {
    code: "26",
    name: "京都府",
    nameKana: "きょうとふ",
    region: "近畿",
    displayOrder: 26,
  },
  {
    code: "27",
    name: "大阪府",
    nameKana: "おおさかふ",
    region: "近畿",
    displayOrder: 27,
  },
  {
    code: "28",
    name: "兵庫県",
    nameKana: "ひょうごけん",
    region: "近畿",
    displayOrder: 28,
  },
  {
    code: "29",
    name: "奈良県",
    nameKana: "ならけん",
    region: "近畿",
    displayOrder: 29,
  },
  {
    code: "30",
    name: "和歌山県",
    nameKana: "わかやまけん",
    region: "近畿",
    displayOrder: 30,
  },
  {
    code: "31",
    name: "鳥取県",
    nameKana: "とっとりけん",
    region: "中国",
    displayOrder: 31,
  },
  {
    code: "32",
    name: "島根県",
    nameKana: "しまねけん",
    region: "中国",
    displayOrder: 32,
  },
  {
    code: "33",
    name: "岡山県",
    nameKana: "おかやまけん",
    region: "中国",
    displayOrder: 33,
  },
  {
    code: "34",
    name: "広島県",
    nameKana: "ひろしまけん",
    region: "中国",
    displayOrder: 34,
  },
  {
    code: "35",
    name: "山口県",
    nameKana: "やまぐちけん",
    region: "中国",
    displayOrder: 35,
  },
  {
    code: "36",
    name: "徳島県",
    nameKana: "とくしまけん",
    region: "四国",
    displayOrder: 36,
  },
  {
    code: "37",
    name: "香川県",
    nameKana: "かがわけん",
    region: "四国",
    displayOrder: 37,
  },
  {
    code: "38",
    name: "愛媛県",
    nameKana: "えひめけん",
    region: "四国",
    displayOrder: 38,
  },
  {
    code: "39",
    name: "高知県",
    nameKana: "こうちけん",
    region: "四国",
    displayOrder: 39,
  },
  {
    code: "40",
    name: "福岡県",
    nameKana: "ふくおかけん",
    region: "九州",
    displayOrder: 40,
  },
  {
    code: "41",
    name: "佐賀県",
    nameKana: "さがけん",
    region: "九州",
    displayOrder: 41,
  },
  {
    code: "42",
    name: "長崎県",
    nameKana: "ながさきけん",
    region: "九州",
    displayOrder: 42,
  },
  {
    code: "43",
    name: "熊本県",
    nameKana: "くまもとけん",
    region: "九州",
    displayOrder: 43,
  },
  {
    code: "44",
    name: "大分県",
    nameKana: "おおいたけん",
    region: "九州",
    displayOrder: 44,
  },
  {
    code: "45",
    name: "宮崎県",
    nameKana: "みやざきけん",
    region: "九州",
    displayOrder: 45,
  },
  {
    code: "46",
    name: "鹿児島県",
    nameKana: "かごしまけん",
    region: "九州",
    displayOrder: 46,
  },
  {
    code: "47",
    name: "沖縄県",
    nameKana: "おきなわけん",
    region: "九州",
    displayOrder: 47,
  },
];

// 震度マスターデータ（DMData.jp API準拠）
const INTENSITY_SCALES = [
  {
    value: "1",
    displayName: "震度1以上",
    shortName: "1",
    numericValue: 1.0,
    displayOrder: 1,
  },
  {
    value: "2",
    displayName: "震度2以上",
    shortName: "2",
    numericValue: 2.0,
    displayOrder: 2,
  },
  {
    value: "3",
    displayName: "震度3以上",
    shortName: "3",
    numericValue: 3.0,
    displayOrder: 3,
  },
  {
    value: "4",
    displayName: "震度4以上",
    shortName: "4",
    numericValue: 4.0,
    displayOrder: 4,
  },
  {
    value: "5-",
    displayName: "震度5弱以上",
    shortName: "5弱",
    numericValue: 5.0,
    displayOrder: 5,
  },
  {
    value: "5+",
    displayName: "震度5強以上",
    shortName: "5強",
    numericValue: 5.5,
    displayOrder: 6,
  },
  {
    value: "6-",
    displayName: "震度6弱以上",
    shortName: "6弱",
    numericValue: 6.0,
    displayOrder: 7,
  },
  {
    value: "6+",
    displayName: "震度6強以上",
    shortName: "6強",
    numericValue: 6.5,
    displayOrder: 8,
  },
  {
    value: "7",
    displayName: "震度7",
    shortName: "7",
    numericValue: 7.0,
    displayOrder: 9,
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // 都道府県マスターデータ投入
  console.log("📍 Seeding prefectures...");
  for (const pref of PREFECTURES) {
    await prisma.prefecture.upsert({
      where: { code: pref.code },
      update: pref,
      create: pref,
    });
  }
  console.log(`✅ Created/Updated ${PREFECTURES.length} prefectures`);

  // 震度マスターデータ投入
  console.log("📊 Seeding intensity scales...");
  for (const intensity of INTENSITY_SCALES) {
    await prisma.intensityScale.upsert({
      where: { value: intensity.value },
      update: intensity,
      create: intensity,
    });
  }
  console.log(`✅ Created/Updated ${INTENSITY_SCALES.length} intensity scales`);

  // 権限マスターデータ投入
  console.log("🔐 Seeding permissions...");
  const permissions = [
    // ダッシュボード
    {
      name: "dashboard:read",
      displayName: "ダッシュボード閲覧",
      description: "ダッシュボードの閲覧",
      category: "dashboard",
    },

    // Slack設定
    {
      name: "slack:setup:read",
      displayName: "Slack初期設定閲覧",
      description: "Slack初期設定の閲覧",
      category: "slack",
    },
    {
      name: "slack:setup:write",
      displayName: "Slack初期設定編集",
      description: "Slack初期設定の編集",
      category: "slack",
    },
    {
      name: "slack:workspace:read",
      displayName: "Slackワークスペース閲覧",
      description: "Slackワークスペース設定の閲覧",
      category: "slack",
    },
    {
      name: "slack:workspace:write",
      displayName: "Slackワークスペース編集",
      description: "Slackワークスペース設定の作成・編集・削除",
      category: "slack",
    },

    // 部署管理
    {
      name: "department:read",
      displayName: "部署閲覧",
      description: "部署情報の閲覧",
      category: "department",
    },
    {
      name: "department:write",
      displayName: "部署編集",
      description: "部署の作成・編集・削除",
      category: "department",
    },

    // 地震通知条件
    {
      name: "earthquake:condition:read",
      displayName: "地震通知条件閲覧",
      description: "地震通知条件の閲覧",
      category: "earthquake",
    },
    {
      name: "earthquake:condition:write",
      displayName: "地震通知条件編集",
      description: "地震通知条件の作成・編集・削除",
      category: "earthquake",
    },

    // メッセージテンプレート
    {
      name: "message:template:read",
      displayName: "メッセージテンプレート閲覧",
      description: "メッセージテンプレートの閲覧",
      category: "message",
    },
    {
      name: "message:template:write",
      displayName: "メッセージテンプレート編集",
      description: "メッセージテンプレートの作成・編集",
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
      description: "メンバーの招待・編集・削除",
      category: "member",
    },

    // グループ・権限管理
    {
      name: "group:read",
      displayName: "グループ閲覧",
      description: "グループ情報の閲覧",
      category: "group",
    },
    {
      name: "group:write",
      displayName: "グループ編集",
      description: "グループの作成・編集・削除",
      category: "group",
    },

    // DMData設定
    {
      name: "dmdata:settings:read",
      displayName: "DMData設定閲覧",
      description: "DMData認証設定の閲覧",
      category: "dmdata",
    },
    {
      name: "dmdata:settings:write",
      displayName: "DMData設定編集",
      description: "DMData認証設定の編集",
      category: "dmdata",
    },

    // 訓練モード
    {
      name: "training:read",
      displayName: "訓練モード閲覧",
      description: "訓練モードの閲覧",
      category: "training",
    },
    {
      name: "training:write",
      displayName: "訓練モード実行",
      description: "訓練通知の送信・スケジュール設定",
      category: "training",
    },

    // 応答履歴
    {
      name: "response:read",
      displayName: "本番応答履歴閲覧",
      description: "本番環境での安否確認応答履歴の閲覧",
      category: "response",
    },
    {
      name: "training:response:read",
      displayName: "訓練応答履歴閲覧",
      description: "訓練環境での安否確認応答履歴の閲覧",
      category: "training",
    },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm,
    });
  }
  console.log(`✅ Created/Updated ${permissions.length} permissions`);

  // グループマスターデータ投入
  console.log("👥 Seeding groups...");
  const adminGroup = await prisma.group.upsert({
    where: { name: "管理者グループ" },
    update: {},
    create: {
      name: "管理者グループ",
      description: "全ての権限を持つ管理者グループ",
      isActive: true,
      isSystem: true,
    },
  });

  // 管理者グループに全権限を付与
  for (const perm of permissions) {
    const permission = await prisma.permission.findUnique({
      where: { name: perm.name },
    });
    if (permission) {
      await prisma.groupPermissionAttachment.upsert({
        where: {
          groupId_permissionId: {
            groupId: adminGroup.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          groupId: adminGroup.id,
          permissionId: permission.id,
        },
      });
    }
  }
  console.log(`✅ Created admin group with all permissions`);

  // 初期管理者アカウント作成
  console.log("👤 Creating initial admin user...");
  const adminEmail = process.env.ADMIN_EMAIL || "tgoto@eviry.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      role: "ADMIN",
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Admin user created: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   ⚠️  Please change this password after first login!`);

  // 管理者ユーザーを管理者グループに追加
  await prisma.userGroupMembership.upsert({
    where: {
      userId_groupId: {
        userId: adminUser.id,
        groupId: adminGroup.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      groupId: adminGroup.id,
    },
  });
  console.log(`✅ Admin user added to admin group`);

  // 地震情報種別マスターデータ投入
  console.log("📋 Seeding earthquake info types...");
  const earthquakeInfoTypes = [
    {
      code: "VXSE51",
      name: "震度速報",
      description: "地震発生後、速報的に発表される震度情報",
      displayOrder: 1,
      isActive: true,
    },
    {
      code: "VXSE53",
      name: "震源・震度情報",
      description: "地震の震源と各地の震度情報",
      displayOrder: 2,
      isActive: true,
    },
  ];

  for (const infoType of earthquakeInfoTypes) {
    await prisma.earthquakeInfoType.upsert({
      where: { code: infoType.code },
      update: infoType,
      create: infoType,
    });
  }
  console.log(
    `✅ Created/Updated ${earthquakeInfoTypes.length} earthquake info types`
  );

  // メニューマスターデータ投入
  console.log("📱 Seeding menus...");
  const menus = [
    {
      name: "ダッシュボード",
      path: "/admin",
      icon: "fa-solid fa-chart-line",
      displayOrder: 1,
      isActive: true,
      categoryPermission: "dashboard:read",
    },
    {
      name: "Slack初期設定",
      path: "/admin/slack-setup",
      icon: "fa-solid fa-link",
      displayOrder: 2,
      isActive: true,
      categoryPermission: "slack:setup:read",
    },
    {
      name: "ワークスペース",
      path: "/admin/workspaces",
      icon: "fa-brands fa-slack",
      displayOrder: 3,
      isActive: true,
      categoryPermission: "slack:workspace:read",
    },
    {
      name: "部署管理",
      path: "/admin/departments",
      icon: "fa-solid fa-tag",
      displayOrder: 4,
      isActive: true,
      categoryPermission: "department:read",
    },
    {
      name: "通知条件",
      path: "/admin/conditions",
      icon: "fa-solid fa-gear",
      displayOrder: 5,
      isActive: true,
      categoryPermission: "earthquake:condition:read",
    },
    {
      name: "メッセージ",
      path: "/admin/messages",
      icon: "fa-solid fa-message",
      displayOrder: 6,
      isActive: true,
      categoryPermission: "message:template:read",
    },
    {
      name: "メンバー",
      path: "/admin/members",
      icon: "fa-solid fa-users",
      displayOrder: 7,
      isActive: true,
      categoryPermission: "member:read",
    },
    {
      name: "グループ",
      path: "/admin/groups",
      icon: "fa-solid fa-user-group",
      displayOrder: 8,
      isActive: true,
      categoryPermission: "group:read",
    },
    {
      name: "DMData設定",
      path: "/admin/dmdata-settings",
      icon: "fa-solid fa-key",
      displayOrder: 9,
      isActive: true,
      categoryPermission: "dmdata:settings:read",
    },
    {
      name: "訓練モード",
      path: "/admin/training",
      icon: "fa-solid fa-graduation-cap",
      displayOrder: 10,
      isActive: true,
      categoryPermission: "training:read",
    },
    {
      name: "本番応答履歴",
      path: "/admin/responses",
      icon: "fa-solid fa-list-check",
      displayOrder: 11,
      isActive: true,
      categoryPermission: "response:read",
    },
    {
      name: "訓練応答履歴",
      path: "/admin/training-responses",
      icon: "fa-solid fa-clipboard-list",
      displayOrder: 12,
      isActive: true,
      categoryPermission: "training:response:read",
    },
  ];

  for (const menu of menus) {
    await prisma.menu.upsert({
      where: { path: menu.path },
      update: menu,
      create: menu,
    });
  }
  console.log(`✅ Created/Updated ${menus.length} menus`);

  // デフォルトメッセージテンプレート投入
  console.log("💬 Seeding default message templates...");

  // ワークスペースが存在する場合のみテンプレート作成
  const workspaces = await prisma.slackWorkspace.findMany();

  if (workspaces.length > 0) {
    for (const workspace of workspaces) {
      // 本番用テンプレート
      await prisma.messageTemplate.upsert({
        where: {
          unique_workspace_type: {
            workspaceRef: workspace.id,
            type: "PRODUCTION",
          },
        },
        update: {},
        create: {
          workspaceRef: workspace.id,
          type: "PRODUCTION",
          title: "地震発生通知",
          body: `:rotating_light: 地震発生通知
【安否確認のため、下記対応をお願いします】
各リーダー・上長の方は、自組織のメンバーの押下確認お願いします。
・無事な方は所属の絵文字を押してください
・救助などが必要な方は:sos:を押してください
・連続で通知された場合は最後の通知の絵文字を押してください
落ち着いて行動してください

**【地震情報詳細】**
:round_pushpin: 震源地: {{epicenter}}
:chart_with_upwards_trend: 最大震度{{maxIntensity}}
発生時刻: {{occurrenceTime}}
マグニチュード: M{{magnitude}}
震源の深さ: {{depth}}
:clipboard: 情報種別: {{infoType}}`,
          isActive: true,
        },
      });

      // 訓練用テンプレート
      await prisma.messageTemplate.upsert({
        where: {
          unique_workspace_type: {
            workspaceRef: workspace.id,
            type: "TRAINING",
          },
        },
        update: {},
        create: {
          workspaceRef: workspace.id,
          type: "TRAINING",
          title: "【訓練】地震発生通知",
          body: `:construction: **これは訓練です** :construction:

:rotating_light: 地震発生通知（訓練）
【安否確認のため、下記対応をお願いします】
各リーダー・上長の方は、自組織のメンバーの押下確認お願いします。
・無事な方は所属の絵文字を押してください
・救助などが必要な方は:sos:を押してください
・連続で通知された場合は最後の通知の絵文字を押してください
落ち着いて行動してください

**【地震情報詳細】**
:round_pushpin: 震源地: {{epicenter}}
:chart_with_upwards_trend: 最大震度{{maxIntensity}}
発生時刻: {{occurrenceTime}}
マグニチュード: M{{magnitude}}
震源の深さ: {{depth}}
:clipboard: 情報種別: {{infoType}}

:construction: **これは訓練です** :construction:`,
          isActive: true,
        },
      });
    }
    console.log(`✅ Created message templates for ${workspaces.length} workspace(s)`);
  } else {
    console.log("ℹ️  No workspaces found, skipping message template creation");
  }

  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
