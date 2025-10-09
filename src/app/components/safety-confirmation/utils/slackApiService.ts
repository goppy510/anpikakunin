/* Slack API 接続サービス */
import { SlackEmoji } from "../types/SafetyConfirmationTypes";

export interface SlackWorkspaceInfo {
  name: string;
  id: string;
  url: string;
  icon?: {
    image_102?: string;
    image_132?: string;
  };
}

export interface SlackTestResult {
  success: boolean;
  workspaceInfo?: SlackWorkspaceInfo;
  emojis?: SlackEmoji[];
  error?: string;
  scopes?: string[];
}

export class SlackApiService {
  // Bot Tokenの接続テスト
  static async testBotToken(botToken: string): Promise<SlackTestResult> {
    try {
      const response = await fetch('/api/slack/test-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botToken })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'API接続エラー'
        };
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error("Slack API接続テストエラー:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '接続テストに失敗しました'
      };
    }
  }

  // チャンネル情報を取得
  static async getChannelInfo(botToken: string, channelId: string): Promise<{
    success: boolean;
    channelName?: string;
    isPrivate?: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/slack/get-channel-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botToken, channelId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'チャンネル情報取得失敗'
        };
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error("チャンネル情報取得エラー:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'チャンネル情報取得エラー'
      };
    }
  }

  // メッセージを送信
  static async sendMessage({
    botToken,
    channelId,
    title,
    message,
    isTraining = false,
    departments = []
  }: {
    botToken: string;
    channelId: string;
    title: string;
    message: string;
    isTraining?: boolean;
    departments?: any[];
  }): Promise<{
    success: boolean;
    messageTs?: string;
    channel?: string;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/slack/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botToken,
          channelId,
          title,
          message,
          isTraining,
          departments
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'メッセージ送信失敗'
        };
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error("Slackメッセージ送信エラー:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'メッセージ送信エラー'
      };
    }
  }

}