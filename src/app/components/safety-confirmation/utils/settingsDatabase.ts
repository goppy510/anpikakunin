/* 安否確認設定 IndexedDB 管理クラス */
import { getDb } from "@/app/lib/db/indexed-db";
import { SafetyConfirmationConfig } from "../types/SafetyConfirmationTypes";

export interface StoredSafetySettings extends SafetyConfirmationConfig {
  id: string; // 設定ID（通常は'default'）
  createdAt: string; // DB保存日時
  updatedAt: string; // 最終更新日時
}

export class SafetySettingsDatabase {
  private static readonly SETTINGS_ID = 'default';

  // 設定を保存
  static async saveSettings(config: SafetyConfirmationConfig): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      const now = new Date().toISOString();
      
      // 既存設定を確認
      const existing = await db.get("safetySettings", this.SETTINGS_ID);
      
      const storedSettings: StoredSafetySettings = {
        ...config,
        id: this.SETTINGS_ID,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      await db.put("safetySettings", storedSettings);
      console.log(`安否確認設定をIndexedDBに保存しました`);
    } catch (error) {
      console.error("安否確認設定の保存に失敗:", error);
      throw error;
    }
  }

  // 設定を読み込み
  static async loadSettings(): Promise<SafetyConfirmationConfig | null> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return null;
      }

      const storedSettings = await db.get("safetySettings", this.SETTINGS_ID);
      if (!storedSettings) {
        console.log("保存済み安否確認設定が見つかりません");
        return null;
      }

      // DB固有フィールドを除去して返す
      const { id, createdAt, updatedAt, ...config } = storedSettings;
      console.log(`IndexedDBから安否確認設定を読み込みました`);
      return config;
    } catch (error) {
      console.error("安否確認設定の読み込みに失敗:", error);
      return null;
    }
  }

  // 設定を削除
  static async deleteSettings(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      await db.delete("safetySettings", this.SETTINGS_ID);
      console.log("安否確認設定を削除しました");
    } catch (error) {
      console.error("安否確認設定の削除に失敗:", error);
      throw error;
    }
  }

  // 設定の統計情報を取得
  static async getSettingsInfo(): Promise<{
    hasSettings: boolean;
    workspaceCount: number;
    channelCount: number;
    lastUpdated?: string;
  }> {
    try {
      const db = await getDb();
      if (!db) {
        return { hasSettings: false, workspaceCount: 0, channelCount: 0 };
      }

      const storedSettings = await db.get("safetySettings", this.SETTINGS_ID);
      if (!storedSettings) {
        return { hasSettings: false, workspaceCount: 0, channelCount: 0 };
      }

      return {
        hasSettings: true,
        workspaceCount: storedSettings.slack.workspaces.length,
        channelCount: storedSettings.slack.channels.length,
        lastUpdated: storedSettings.updatedAt
      };
    } catch (error) {
      console.error("安否確認設定情報の取得に失敗:", error);
      return { hasSettings: false, workspaceCount: 0, channelCount: 0 };
    }
  }

  // 設定をエクスポート（バックアップ用）
  static async exportSettings(): Promise<string | null> {
    try {
      const config = await this.loadSettings();
      if (!config) {
        return null;
      }
      
      return JSON.stringify(config, null, 2);
    } catch (error) {
      console.error("安否確認設定のエクスポートに失敗:", error);
      return null;
    }
  }

  // 設定をインポート（復元用）
  static async importSettings(jsonString: string): Promise<void> {
    try {
      const config = JSON.parse(jsonString) as SafetyConfirmationConfig;
      await this.saveSettings(config);
      console.log("安否確認設定をインポートしました");
    } catch (error) {
      console.error("安否確認設定のインポートに失敗:", error);
      throw error;
    }
  }
}