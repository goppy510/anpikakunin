// src/app/lib/db/settings.ts
import { getDb } from "@/app/lib/db/indexed-db";
import type { AppSettings } from "@/app/lib/db/setting"; // スキーマ型

export class Settings {
  /* ---------- 取得 ---------- */
  static async get<K extends keyof AppSettings>(
    key: K
  ): Promise<AppSettings[K] | undefined> {
    const db = await getDb();
    return db
      ? ((await db.get("settings", key as string)) as
          | AppSettings[K]
          | undefined)
      : undefined;
  }

  /* ---------- 保存 ---------- */
  static async set<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> {
    const db = await getDb();
    if (db) await db.put("settings", value, key as string);
  }

  /* ---------- 削除 ---------- */
  static async delete(key: keyof AppSettings): Promise<void> {
    const db = await getDb();
    if (db) await db.delete("settings", key as string);
  }
}
