// 地震イベントローカルストレージ管理
import { EventItem } from "../types/EventItem";

const STORAGE_KEY = "anpikakunin_earthquake_events";
const MAX_STORED_EVENTS = 100; // 最大保存件数

export class EventStorage {
  // イベントを保存
  static saveEvents(events: EventItem[]): void {
    try {
      if (typeof window === "undefined") return;
      
      // 最新の100件のみ保存
      const eventsToSave = events.slice(0, MAX_STORED_EVENTS);
      
      // 保存データに日時を付与
      const storageData = {
        events: eventsToSave.map(event => ({
          ...event,
          savedAt: new Date().toISOString()
        })),
        lastSaved: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
      console.log(`地震イベント ${eventsToSave.length}件 をローカルストレージに保存しました`);
    } catch (error) {
      console.error("地震イベントの保存に失敗:", error);
    }
  }

  // イベントを読み込み
  static loadEvents(): EventItem[] {
    try {
      if (typeof window === "undefined") return [];
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const storageData = JSON.parse(stored);
      const events = storageData.events || [];
      
      console.log(`地震イベント ${events.length}件 をローカルストレージから読み込みました`);
      console.log(`最終保存日時: ${storageData.lastSaved}`);
      
      // savedAt フィールドを除去して返す
      return events.map(({ savedAt, ...event }: any) => event);
    } catch (error) {
      console.error("地震イベントの読み込みに失敗:", error);
      return [];
    }
  }

  // ストレージをクリア
  static clearEvents(): void {
    try {
      if (typeof window === "undefined") return;
      
      localStorage.removeItem(STORAGE_KEY);
      console.log("地震イベントストレージをクリアしました");
    } catch (error) {
      console.error("地震イベントストレージのクリアに失敗:", error);
    }
  }

  // 単一のイベントを更新（既存の配列から特定のイベントを更新）
  static updateEvent(eventId: string, updatedEvent: EventItem): void {
    try {
      const events = this.loadEvents();
      const index = events.findIndex(e => e.eventId === eventId);
      
      if (index >= 0) {
        events[index] = updatedEvent;
        this.saveEvents(events);
        console.log(`イベント ${eventId} を更新しました`);
      } else {
        console.log(`イベント ${eventId} が見つかりません`);
      }
    } catch (error) {
      console.error(`イベント ${eventId} の更新に失敗:`, error);
    }
  }

  // 新しいイベントを追加（重複チェック付き）
  static addEvent(newEvent: EventItem): void {
    try {
      const events = this.loadEvents();
      const existingIndex = events.findIndex(e => e.eventId === newEvent.eventId);
      
      if (existingIndex >= 0) {
        // 既存イベントを更新
        events[existingIndex] = newEvent;
      } else {
        // 新規イベントを先頭に追加
        events.unshift(newEvent);
      }
      
      this.saveEvents(events);
    } catch (error) {
      console.error("イベントの追加に失敗:", error);
    }
  }

  // ストレージの状態を確認
  static getStorageInfo(): { eventCount: number; lastSaved?: string; storageSize: number } {
    try {
      if (typeof window === "undefined") return { eventCount: 0, storageSize: 0 };
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { eventCount: 0, storageSize: 0 };
      
      const storageData = JSON.parse(stored);
      
      return {
        eventCount: storageData.events?.length || 0,
        lastSaved: storageData.lastSaved,
        storageSize: new Blob([stored]).size
      };
    } catch (error) {
      console.error("ストレージ情報の取得に失敗:", error);
      return { eventCount: 0, storageSize: 0 };
    }
  }
}