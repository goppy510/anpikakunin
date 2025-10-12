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
    } catch (error) {
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
      
      
      // savedAt フィールドを除去して返す
      return events.map(({ savedAt, ...event }: any) => event);
    } catch (error) {
      return [];
    }
  }

  // ストレージをクリア
  static clearEvents(): void {
    try {
      if (typeof window === "undefined") return;
      
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
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
      } else {
      }
    } catch (error) {
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
      return { eventCount: 0, storageSize: 0 };
    }
  }
}