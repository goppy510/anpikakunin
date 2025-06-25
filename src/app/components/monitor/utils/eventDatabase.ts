/* 地震イベント IndexedDB 管理クラス */
import { getDb } from "@/app/lib/db/indexed-db";
import { EventItem } from "../types/EventItem";

export interface StoredEventItem extends EventItem {
  createdAt: string; // DB保存日時
  updatedAt: string; // 最終更新日時
}

export class EventDatabase {
  // イベントを保存（新規作成または更新）
  static async saveEvent(event: EventItem): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      const now = new Date().toISOString();
      
      // 既存データを確認
      const existing = await db.get("earthquakeEvents", event.eventId);
      
      const storedEvent: StoredEventItem = {
        ...event,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      await db.put("earthquakeEvents", storedEvent);
      console.log(`地震イベント ${event.eventId} をIndexedDBに保存しました`);
    } catch (error) {
      console.error("地震イベントの保存に失敗:", error);
    }
  }

  // 複数のイベントを一括保存
  static async saveEvents(events: EventItem[]): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      const tx = db.transaction("earthquakeEvents", "readwrite");
      const now = new Date().toISOString();

      for (const event of events) {
        // 既存データを確認
        const existing = await tx.store.get(event.eventId);
        
        const storedEvent: StoredEventItem = {
          ...event,
          createdAt: existing?.createdAt || now,
          updatedAt: now
        };

        await tx.store.put(storedEvent);
      }

      await tx.done;
      console.log(`地震イベント ${events.length}件 をIndexedDBに一括保存しました`);
    } catch (error) {
      console.error("地震イベントの一括保存に失敗:", error);
    }
  }

  // 最新のイベントを取得（到達時刻順）
  static async getLatestEvents(limit: number = 50): Promise<EventItem[]> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return [];
      }

      // 到達時刻の降順で取得
      const events = await db.getAllFromIndex(
        "earthquakeEvents", 
        "by-arrival-time",
        undefined,
        limit
      );

      // 到達時刻で降順ソート（最新順）
      const sortedEvents = events
        .sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime())
        .map(({ createdAt, updatedAt, ...event }) => event); // DB固有フィールドを除去

      console.log(`IndexedDBから地震イベント ${sortedEvents.length}件 を取得しました`);
      return sortedEvents;
    } catch (error) {
      console.error("地震イベントの取得に失敗:", error);
      return [];
    }
  }

  // 特定のイベントを取得
  static async getEvent(eventId: string): Promise<EventItem | null> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return null;
      }

      const storedEvent = await db.get("earthquakeEvents", eventId);
      if (!storedEvent) return null;

      // DB固有フィールドを除去して返す
      const { createdAt, updatedAt, ...event } = storedEvent;
      return event;
    } catch (error) {
      console.error(`地震イベント ${eventId} の取得に失敗:`, error);
      return null;
    }
  }

  // イベントを削除
  static async deleteEvent(eventId: string): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      await db.delete("earthquakeEvents", eventId);
      console.log(`地震イベント ${eventId} を削除しました`);
    } catch (error) {
      console.error(`地震イベント ${eventId} の削除に失敗:`, error);
    }
  }

  // 古いイベントを削除（保存件数制限）
  static async cleanupOldEvents(keepCount: number = 100): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      // 作成日時順で全件取得
      const allEvents = await db.getAllFromIndex("earthquakeEvents", "by-created-at");
      
      if (allEvents.length <= keepCount) {
        console.log(`保存済みイベント数 ${allEvents.length}件 は上限 ${keepCount}件 以下のため、クリーンアップ不要`);
        return;
      }

      // 作成日時で降順ソート（新しい順）
      const sortedEvents = allEvents.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // 上限を超える古いイベントを削除
      const eventsToDelete = sortedEvents.slice(keepCount);
      const tx = db.transaction("earthquakeEvents", "readwrite");

      for (const event of eventsToDelete) {
        await tx.store.delete(event.eventId);
      }

      await tx.done;
      console.log(`古い地震イベント ${eventsToDelete.length}件 を削除しました（残り ${keepCount}件）`);
    } catch (error) {
      console.error("古いイベントのクリーンアップに失敗:", error);
    }
  }

  // データベースの統計情報を取得
  static async getStats(): Promise<{
    totalEvents: number;
    confirmedEvents: number;
    testEvents: number;
    oldestEvent?: string;
    newestEvent?: string;
  }> {
    try {
      const db = await getDb();
      if (!db) {
        return { totalEvents: 0, confirmedEvents: 0, testEvents: 0 };
      }

      const allEvents = await db.getAll("earthquakeEvents");
      
      const confirmedEvents = allEvents.filter(e => e.isConfirmed).length;
      const testEvents = allEvents.filter(e => e.isTest).length;
      
      const sortedByArrival = allEvents.sort(
        (a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
      );

      return {
        totalEvents: allEvents.length,
        confirmedEvents,
        testEvents,
        oldestEvent: sortedByArrival[0]?.arrivalTime,
        newestEvent: sortedByArrival[sortedByArrival.length - 1]?.arrivalTime
      };
    } catch (error) {
      console.error("データベース統計の取得に失敗:", error);
      return { totalEvents: 0, confirmedEvents: 0, testEvents: 0 };
    }
  }

  // データベースを完全にクリア
  static async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      await db.clear("earthquakeEvents");
      console.log("地震イベントデータベースをクリアしました");
    } catch (error) {
      console.error("データベースのクリアに失敗:", error);
    }
  }
}