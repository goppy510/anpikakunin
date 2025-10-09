/* src/app/lib/db/indexed-db.ts */
import type { IDBPDatabase } from "idb";
import { openDB, DBSchema } from "idb";

const DB_NAME = "@dmdata/app-etcm";
const SCHEMA_VERSION = 6554; // バージョンは維持（既存利用との互換保持）

/* ---------- DB スキーマ ---------- */
export interface AppDBSchema extends DBSchema {
  settings: {
    key: string;
    value: unknown;
  };
  earthquakeEvents: {
    key: string; // eventId
    value: {
      eventId: string;
      arrivalTime: string;
      originTime?: string;
      maxInt?: string;
      currentMaxInt?: string;
      magnitude?: { value?: number; condition?: string };
      hypocenter?: {
        name?: string;
        depth?: { value?: number; condition?: string };
      };
      isTest?: boolean;
      isConfirmed?: boolean;
      createdAt: string; // 保存日時
      updatedAt: string; // 更新日時
    };
    indexes: {
      'by-arrival-time': string; // arrivalTime
      'by-created-at': string; // createdAt
    };
  };
  safetyResponses: {
    key: string; // response id
    value: {
      id: string;
      userId: string;
      userName: string;
      userRealName: string;
      departmentId: string;
      departmentName: string;
      timestamp: string;
      channelId: string;
      messageTs: string;
      eventId?: string;
    };
    indexes: {
      'by-timestamp': string;
      'by-message': string; // messageTs + channelId
    };
  };
  safetySettings: {
    key: string; // 設定ID（通常は'default'）
    value: {
      id: string;
      slack: {
        workspaces: Array<any>;
        channels: Array<any>;
      };
      training: {
        isEnabled: boolean;
        testMessage: string;
        enableMentions: boolean;
        mentionTargets: string[];
        scheduledTrainings: Array<any>;
      };
      isActive: boolean;
      createdAt: string; // 保存日時
      updatedAt: string; // 更新日時
    };
  };
}

/* ---------- ブラウザのみ openDB ---------- */
function ensureStores(db: IDBPDatabase<AppDBSchema>) {
  if (!db.objectStoreNames.contains("settings")) {
    db.createObjectStore("settings");
  }

  if (!db.objectStoreNames.contains("earthquakeEvents")) {
    const eventStore = db.createObjectStore("earthquakeEvents", {
      keyPath: "eventId",
    });
    eventStore.createIndex("by-arrival-time", "arrivalTime");
    eventStore.createIndex("by-created-at", "createdAt");
  }

  if (!db.objectStoreNames.contains("safetyResponses")) {
    const responseStore = db.createObjectStore("safetyResponses", {
      keyPath: "id",
    });
    responseStore.createIndex("by-timestamp", "timestamp");
    responseStore.createIndex("by-message", ["messageTs", "channelId"]);
  }

  if (!db.objectStoreNames.contains("safetySettings")) {
    db.createObjectStore("safetySettings", { keyPath: "id" });
  }

}

async function openDatabase(
  version?: number
): Promise<IDBPDatabase<AppDBSchema>> {
  return openDB<AppDBSchema>(DB_NAME, version, {
    upgrade(db) {
      ensureStores(db);
    },
  });
}

export async function getDb(): Promise<IDBPDatabase<AppDBSchema> | undefined> {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return await openDatabase(SCHEMA_VERSION);
  } catch (error) {
    if (error instanceof DOMException && error.name === "VersionError") {
      console.warn(
        "IndexedDB version mismatch detected. Falling back to existing version.",
        error
      );

      const existingDb = await openDatabase();
      return existingDb;
    }
    throw error;
  }
}
