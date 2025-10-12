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
        return;
      }

      await db.put("safetyResponses", response);
    } catch (error) {
    }
  }

  // 特定メッセージの応答一覧を取得
  static async getResponsesByMessage(messageTs: string, channelId: string): Promise<SafetyResponse[]> {
    try {
      const db = await getDb();
      if (!db) {
        return [];
      }

      const allResponses = await db.getAll("safetyResponses");
      return allResponses.filter(response => 
        response.messageTs === messageTs && response.channelId === channelId
      );
    } catch (error) {
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
      return {};
    }
  }

  // 最新の応答を取得
  static async getLatestResponses(limit: number = 50): Promise<SafetyResponse[]> {
    try {
      const db = await getDb();
      if (!db) {
        return [];
      }

      const allResponses = await db.getAll("safetyResponses");
      return allResponses
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      return [];
    }
  }

  // 応答を削除
  static async deleteResponse(id: string): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        return;
      }

      await db.delete("safetyResponses", id);
    } catch (error) {
    }
  }

  // 古い応答をクリーンアップ
  static async cleanupOldResponses(daysToKeep: number = 30): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
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

    } catch (error) {
    }
  }

  // 全応答をクリア
  static async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        return;
      }

      await db.clear("safetyResponses");
    } catch (error) {
    }
  }
}