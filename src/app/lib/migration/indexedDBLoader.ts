import { getDb } from "@/app/lib/db/indexed-db";

export type IndexedDBWorkspaceData = {
  workspaceId: string;
  name: string;
  botToken: string;
};

export type IndexedDBDepartment = {
  id: string;
  name: string;
  slackEmoji: { name: string; url?: string };
  buttonColor: string;
};

export type IndexedDBNotificationCondition = {
  minIntensity: string;
  targetPrefectures: string[];
  notificationChannel: string;
};

export type IndexedDBMessageTemplate = {
  production: { title: string; body: string };
  training: { title: string; body: string };
};

export type IndexedDBMigrationData = {
  workspace?: IndexedDBWorkspaceData;
  departments: IndexedDBDepartment[];
  notificationCondition?: IndexedDBNotificationCondition;
  messageTemplate?: IndexedDBMessageTemplate;
  spreadsheetUrl?: string;
};

/**
 * IndexedDBから既存の設定データを読み込む
 */
export async function loadIndexedDBData(): Promise<IndexedDBMigrationData> {
  const db = await getDb();
  if (!db) {
    throw new Error("IndexedDBにアクセスできません（ブラウザ環境が必要です）");
  }

  const result: IndexedDBMigrationData = {
    departments: [],
  };

  try {
    // safetySettings から設定を取得
    const settings = await db.get("safetySettings", "default");

    if (!settings) {
      console.warn("IndexedDBに設定データが見つかりません");
      return result;
    }

    console.log("IndexedDB設定データ:", settings);

    const workspace = settings.slack?.workspaces?.[0];
    const channel = settings.slack?.channels?.[0];

    // Slackワークスペース情報
    if (workspace) {
      result.workspace = {
        workspaceId: workspace.id || "",
        name: workspace.name || "",
        botToken: workspace.botToken || "",
      };
    }

    // 部署スタンプ設定（workspaces[0].departments から取得）
    if (workspace?.departments && Array.isArray(workspace.departments)) {
      result.departments = workspace.departments.map((dept: any) => ({
        id: dept.id,
        name: dept.name,
        slackEmoji: {
          name: dept.slackEmoji?.name || "",
          url: dept.slackEmoji?.url,
        },
        buttonColor: dept.color || "#5B8FF9",
      }));
    }

    // 通知チャンネル情報
    if (channel) {
      result.notificationCondition = {
        minIntensity: channel.minIntensity || "5-",
        targetPrefectures: channel.targetPrefectures || [],
        notificationChannel: channel.channelId || "",
      };
    }

    // メッセージテンプレート
    if (channel?.productionMessage || channel?.trainingMessage) {
      result.messageTemplate = {
        production: {
          title: channel.productionMessage?.title || "地震発生通知",
          body: channel.productionMessage?.body || "",
        },
        training: {
          title: channel.trainingMessage?.title || "【訓練】地震発生通知",
          body: channel.trainingMessage?.body || "",
        },
      };
    }

    // スプレッドシートURL
    if (settings.spreadsheet?.url) {
      result.spreadsheetUrl = settings.spreadsheet.url;
    }

    return result;
  } catch (error) {
    console.error("IndexedDBデータ読み込みエラー:", error);
    throw error;
  }
}

/**
 * settings ストアから特定のキーの値を取得
 */
export async function loadSettingsKey(key: string): Promise<any> {
  const db = await getDb();
  if (!db) return undefined;
  return await db.get("settings", key);
}

/**
 * 全てのsettingsキーを取得
 */
export async function loadAllSettings(): Promise<Record<string, any>> {
  const db = await getDb();
  if (!db) return {};

  const tx = db.transaction("settings", "readonly");
  const store = tx.objectStore("settings");
  const keys = await store.getAllKeys();
  const values = await store.getAll();

  const result: Record<string, any> = {};
  keys.forEach((key, index) => {
    result[String(key)] = values[index];
  });

  return result;
}
