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
    } catch (error) {
    }
  }

  // 複数のイベントを一括保存
  static async saveEvents(events: EventItem[]): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
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
    } catch (error) {
    }
  }

  // 最新のイベントを取得（到達時刻順）
  static async getLatestEvents(limit: number = 30): Promise<EventItem[]> {
    try {
      const db = await getDb();
      if (!db) {
        return [];
      }

      // 到達時刻の降順で取得
      const events = await db.getAllFromIndex(
        "earthquakeEvents", 
        "by-arrival-time",
        undefined,
        limit
      );

      // 発生時刻で降順ソート（新しいものが上）、発生時刻がなければ到達時刻を使用
      const sortedEvents = events
        .sort((a, b) => {
          const timeA = new Date(a.originTime || a.arrivalTime).getTime();
          const timeB = new Date(b.originTime || b.arrivalTime).getTime();
          return timeB - timeA; // 降順ソート（新しいものが上）
        })
        .map(({ createdAt, updatedAt, ...event }) => event); // DB固有フィールドを除去

      return sortedEvents;
    } catch (error) {
      return [];
    }
  }

  // 特定のイベントを取得
  static async getEvent(eventId: string): Promise<EventItem | null> {
    try {
      const db = await getDb();
      if (!db) {
        return null;
      }

      const storedEvent = await db.get("earthquakeEvents", eventId);
      if (!storedEvent) return null;

      // DB固有フィールドを除去して返す
      const { createdAt, updatedAt, ...event } = storedEvent;
      return event;
    } catch (error) {
      return null;
    }
  }

  // イベントを削除
  static async deleteEvent(eventId: string): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        return;
      }

      await db.delete("earthquakeEvents", eventId);
    } catch (error) {
    }
  }

  // 古いイベントを削除（保存件数制限）
  static async cleanupOldEvents(keepCount: number = 30): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        return;
      }

      // 作成日時順で全件取得
      const allEvents = await db.getAllFromIndex("earthquakeEvents", "by-created-at");
      
      if (allEvents.length <= keepCount) {
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
    } catch (error) {
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
      return { totalEvents: 0, confirmedEvents: 0, testEvents: 0 };
    }
  }

  // 日付ベースでの古いイベント削除（7日以上前のデータを削除）
  static async cleanupOldEventsByDate(retentionDays: number = 7): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffTime = cutoffDate.toISOString();

      // 全イベントを取得して日付フィルタリング
      const allEvents = await db.getAll("earthquakeEvents");
      const eventsToDelete = allEvents.filter(event => {
        const eventTime = new Date(event.arrivalTime || event.createdAt);
        return eventTime < cutoffDate;
      });

      if (eventsToDelete.length === 0) {
        return;
      }

      const tx = db.transaction("earthquakeEvents", "readwrite");
      for (const event of eventsToDelete) {
        await tx.store.delete(event.eventId);
      }
      await tx.done;

    } catch (error) {
    }
  }

  // 包括的なクリーンアップ（件数制限と日付制限の両方を適用）
  static async performComprehensiveCleanup(keepCount: number = 30, retentionDays: number = 7): Promise<void> {
    try {
      
      // まず日付ベースでの削除
      await this.cleanupOldEventsByDate(retentionDays);
      
      // 次に件数制限での削除
      await this.cleanupOldEvents(keepCount);
      
      // 統計情報を取得して結果を表示
      const stats = await this.getStats();
      
    } catch (error) {
    }
  }

  // ストレージ使用量の概算を取得
  static async getStorageEstimate(): Promise<{
    totalEvents: number;
    estimatedSizeKB: number;
    estimatedSizeMB: number;
  }> {
    try {
      const stats = await this.getStats();
      // 1イベントあたり約2KB と仮定（JSON文字列化後のサイズ）
      const estimatedSizeKB = stats.totalEvents * 2;
      const estimatedSizeMB = estimatedSizeKB / 1024;
      
      return {
        totalEvents: stats.totalEvents,
        estimatedSizeKB,
        estimatedSizeMB: Math.round(estimatedSizeMB * 100) / 100
      };
    } catch (error) {
      return {
        totalEvents: 0,
        estimatedSizeKB: 0,
        estimatedSizeMB: 0
      };
    }
  }

  // データベースを完全にクリア
  static async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        return;
      }

      await db.clear("earthquakeEvents");
    } catch (error) {
    }
  }
}
