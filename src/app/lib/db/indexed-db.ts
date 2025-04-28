/* src/app/lib/db/indexed-db.ts */
import type { IDBPDatabase } from "idb";
import { openDB, DBSchema } from "idb";

const SCHEMA_VERSION = 6550;

/* ---------- DB スキーマ ---------- */
export interface AppDBSchema extends DBSchema {
  settings: {
    key: string;
    value: unknown;
  };
}

/* ---------- ブラウザのみ openDB ---------- */
export async function getDb(): Promise<IDBPDatabase<AppDBSchema> | undefined> {
  if (typeof window === "undefined") {
    // SSR では indexedDB が存在しない
    return undefined;
  }

  return openDB<AppDBSchema>("@dmdata/app-etcm", SCHEMA_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
    },
  });
}
