import { dbPromise } from "@/app/lib/db/indexed-db";
import { AppSettings } from "@/app/lib/db/setting";

export class Settings {
  static get<K extends Extract<keyof T, string>, T = AppSettings>(key: K) {
    return dbPromise.then(
      (db) => db.get("settings", key) as Promise<T[K] | undefined>
    );
  }

  static async set<K extends Extract<keyof T, string>, T = AppSettings>(
    key: K,
    value: T[K]
  ) {
    return (await dbPromise).put("settings", value, key);
  }

  static async delete(key: keyof AppSettings) {
    return (await dbPromise).delete("settings", key);
  }
}
