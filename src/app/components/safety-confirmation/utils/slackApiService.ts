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
    error?: string;
  }> {
    try {
      const response = await this.makeApiCall('/conversations.info', botToken, {
        channel: channelId
      });

      if (!response.ok) {
        return {
          success: false,
          error: response.error || 'チャンネル情報の取得に失敗'
        };
      }

      return {
        success: true,
        channelName: response.channel?.name || 'Unknown Channel'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'チャンネル情報取得エラー'
      };
    }
  }

  // Webhook URLのテスト
  static async testWebhookUrl(webhookUrl: string, testMessage: string = 'Webhook接続テスト'): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/slack/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webhookUrl, testMessage })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Webhook テスト失敗'
        };
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error("Webhook テストエラー:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook テストエラー'
      };
    }
  }

}