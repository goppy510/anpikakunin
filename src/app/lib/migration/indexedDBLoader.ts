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

    // Slackワークスペース情報
    if (settings.slack?.workspaces && settings.slack.workspaces.length > 0) {
      const workspace = settings.slack.workspaces[0];
      result.workspace = {
        workspaceId: workspace.id || workspace.workspaceId || "",
        name: workspace.name || "",
        botToken: workspace.botToken || workspace.accessToken || "",
      };
    }

    // 部署スタンプ設定
    if (settings.slack?.departments && Array.isArray(settings.slack.departments)) {
      result.departments = settings.slack.departments.map((dept: any) => ({
        id: dept.id,
        name: dept.name,
        slackEmoji: {
          name: dept.slackEmoji?.name || dept.emoji || "",
          url: dept.slackEmoji?.url,
        },
        buttonColor: dept.buttonColor || dept.color || "#5B8FF9",
      }));
    }

    // 通知チャンネル情報
    if (settings.slack?.channels && settings.slack.channels.length > 0) {
      const channel = settings.slack.channels[0];
      result.notificationCondition = {
        minIntensity: channel.minIntensity || "5-",
        targetPrefectures: channel.targetPrefectures || [],
        notificationChannel: channel.channelId || channel.id || "",
      };
    }

    // 地震通知条件（別の場所にある可能性）
    if (settings.earthquake) {
      if (!result.notificationCondition) {
        result.notificationCondition = {
          minIntensity: "5-",
          targetPrefectures: [],
          notificationChannel: "",
        };
      }
      result.notificationCondition.minIntensity =
        settings.earthquake.minIntensity || result.notificationCondition.minIntensity;
      result.notificationCondition.targetPrefectures =
        settings.earthquake.targetPrefectures || result.notificationCondition.targetPrefectures;
    }

    // メッセージテンプレート
    if (settings.messages || settings.messageTemplates) {
      const messages = settings.messages || settings.messageTemplates;
      result.messageTemplate = {
        production: {
          title: messages.production?.title || messages.title || "地震発生通知",
          body: messages.production?.body || messages.body || "",
        },
        training: {
          title:
            messages.training?.title || messages.trainingTitle || "【訓練】地震発生通知",
          body: messages.training?.body || messages.trainingBody || "",
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
