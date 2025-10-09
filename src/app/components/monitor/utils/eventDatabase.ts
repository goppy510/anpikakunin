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
    } catch (error) {
      console.error("地震イベントの一括保存に失敗:", error);
    }
  }

  // 最新のイベントを取得（到達時刻順）
  static async getLatestEvents(limit: number = 30): Promise<EventItem[]> {
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

      // 発生時刻で降順ソート（新しいものが上）、発生時刻がなければ到達時刻を使用
      const sortedEvents = events
        .sort((a, b) => {
          const timeA = new Date(a.originTime || a.arrivalTime).getTime();
          const timeB = new Date(b.originTime || b.arrivalTime).getTime();
          return timeB - timeA; // 降順ソート（新しいものが上）
        })
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
  static async cleanupOldEvents(keepCount: number = 30): Promise<void> {
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

  // 日付ベースでの古いイベント削除（7日以上前のデータを削除）
  static async cleanupOldEventsByDate(retentionDays: number = 7): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
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
        console.log(`保持期間 ${retentionDays}日 以内のイベントのみのため、日付ベースクリーンアップ不要`);
        return;
      }

      const tx = db.transaction("earthquakeEvents", "readwrite");
      for (const event of eventsToDelete) {
        await tx.store.delete(event.eventId);
      }
      await tx.done;

      console.log(`${retentionDays}日以上前の地震イベント ${eventsToDelete.length}件 を削除しました`);
    } catch (error) {
      console.error("日付ベースの古いイベントクリーンアップに失敗:", error);
    }
  }

  // 包括的なクリーンアップ（件数制限と日付制限の両方を適用）
  static async performComprehensiveCleanup(keepCount: number = 30, retentionDays: number = 7): Promise<void> {
    try {
      console.log("=== 包括的なIndexedDBクリーンアップ開始 ===");
      
      // まず日付ベースでの削除
      await this.cleanupOldEventsByDate(retentionDays);
      
      // 次に件数制限での削除
      await this.cleanupOldEvents(keepCount);
      
      // 統計情報を取得して結果を表示
      const stats = await this.getStats();
      console.log(`クリーンアップ完了: 現在の保存イベント数 ${stats.totalEvents}件`);
      
      console.log("=== 包括的なIndexedDBクリーンアップ完了 ===");
    } catch (error) {
      console.error("包括的なクリーンアップに失敗:", error);
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
      console.error("ストレージ使用量の取得に失敗:", error);
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
