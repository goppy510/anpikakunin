/* 安否確認応答 IndexedDB 管理クラス */
import { getDb } from "@/app/lib/db/indexed-db";

export interface SafetyResponse {
  id: string;
  userId: string;
  userName: string;
  userRealName: string;
  departmentId: string;
  departmentName: string;
  timestamp: string;
  channelId: string;
  messageTs: string;
  eventId?: string; // 関連する地震イベントID
}

export class SafetyResponseDatabase {
  // 応答を保存
  static async saveResponse(response: SafetyResponse): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      await db.put("safetyResponses", response);
      console.log("✅ 安否確認応答を保存しました:", response.id);
    } catch (error) {
      console.error("安否確認応答の保存に失敗:", error);
    }
  }

  // 特定メッセージの応答一覧を取得
  static async getResponsesByMessage(messageTs: string, channelId: string): Promise<SafetyResponse[]> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return [];
      }

      const allResponses = await db.getAll("safetyResponses");
      return allResponses.filter(response => 
        response.messageTs === messageTs && response.channelId === channelId
      );
    } catch (error) {
      console.error("安否確認応答の取得に失敗:", error);
      return [];
    }
  }

  // 部署別の応答カウントを取得
  static async getDepartmentCounts(messageTs: string, channelId: string): Promise<Record<string, number>> {
    try {
      const responses = await this.getResponsesByMessage(messageTs, channelId);
      const counts: Record<string, number> = {};
      
      responses.forEach(response => {
        counts[response.departmentId] = (counts[response.departmentId] || 0) + 1;
      });
      
      return counts;
    } catch (error) {
      console.error("部署別カウントの取得に失敗:", error);
      return {};
    }
  }

  // 最新の応答を取得
  static async getLatestResponses(limit: number = 50): Promise<SafetyResponse[]> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return [];
      }

      const allResponses = await db.getAll("safetyResponses");
      return allResponses
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error("最新応答の取得に失敗:", error);
      return [];
    }
  }

  // 応答を削除
  static async deleteResponse(id: string): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      await db.delete("safetyResponses", id);
      console.log("🗑️ 安否確認応答を削除しました:", id);
    } catch (error) {
      console.error("安否確認応答の削除に失敗:", error);
    }
  }

  // 古い応答をクリーンアップ
  static async cleanupOldResponses(daysToKeep: number = 30): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const allResponses = await db.getAll("safetyResponses");
      const oldResponses = allResponses.filter(response => 
        new Date(response.timestamp) < cutoffDate
      );

      for (const response of oldResponses) {
        await db.delete("safetyResponses", response.id);
      }

      console.log(`🧹 ${oldResponses.length}件の古い安否確認応答をクリーンアップしました`);
    } catch (error) {
      console.error("安否確認応答のクリーンアップに失敗:", error);
    }
  }

  // 全応答をクリア
  static async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("IndexedDB not available (SSR)");
        return;
      }

      await db.clear("safetyResponses");
      console.log("🗑️ 全ての安否確認応答をクリアしました");
    } catch (error) {
      console.error("安否確認応答のクリアに失敗:", error);
    }
  }
}