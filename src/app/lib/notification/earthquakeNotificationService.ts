/**
 * 地震通知サービス（PostgreSQL版）
 *
 * WebSocketから受信した地震情報を処理し、
 * PostgreSQLに保存された設定に基づいてSlack通知を送信
 */

import type { EventItem } from "@/app/components/monitor/types/EventItem";
import type { SlackWorkspaceSummary } from "@/app/lib/db/slackSettings";
import { shouldNotify, getMaxIntensityFromEvent } from "./notificationFilter";

export class EarthquakeNotificationService {
  private static instance: EarthquakeNotificationService | null = null;
  private lastNotifiedEventId: string | null = null;

  private constructor() {}

  public static getInstance(): EarthquakeNotificationService {
    if (!this.instance) {
      this.instance = new EarthquakeNotificationService();
    }
    return this.instance;
  }

  /**
   * 地震イベントを処理し、必要に応じて通知を送信
   */
  public async processEarthquakeEvent(event: EventItem): Promise<void> {
    try {
      console.log("=== 地震通知サービス: イベント処理開始 ===");
      console.log("Event ID:", event.eventId);
      console.log("Event maxInt:", event.maxInt);
      console.log("Event isTest:", event.isTest);

      // テストイベントは除外
      if (event.isTest) {
        console.log("地震通知サービス: テストイベントのためスキップ");
        return;
      }

      // 同じイベントIDで既に通知済みの場合はスキップ
      if (this.lastNotifiedEventId === event.eventId) {
        console.log("地震通知サービス: 既に通知済みのイベントのためスキップ");
        return;
      }

      // PostgreSQLからワークスペース設定を取得
      const workspaces = await this.fetchWorkspaceSettings();

      if (!workspaces || workspaces.length === 0) {
        console.log("地震通知サービス: ワークスペース設定が未登録");
        return;
      }

      console.log(`地震通知サービス: ${workspaces.length}件のワークスペースを確認`);

      // 各ワークスペースの設定を確認して通知判定
      for (const workspace of workspaces) {
        await this.processWorkspaceNotification(event, workspace);
      }

      // 通知完了後、最終通知イベントIDを更新
      this.lastNotifiedEventId = event.eventId;

      console.log("=== 地震通知サービス: イベント処理完了 ===");
    } catch (error) {
      console.error("地震通知サービス: イベント処理中にエラー:", error);
    }
  }

  /**
   * ワークスペース設定を取得
   */
  private async fetchWorkspaceSettings(): Promise<SlackWorkspaceSummary[]> {
    try {
      const response = await fetch("/api/slack/workspaces");
      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("ワークスペース設定の取得に失敗:", error);
      return [];
    }
  }

  /**
   * ワークスペースごとの通知処理
   */
  private async processWorkspaceNotification(
    event: EventItem,
    workspace: SlackWorkspaceSummary
  ): Promise<void> {
    console.log(`=== ワークスペース処理: ${workspace.name} ===`);

    // 無効なワークスペースはスキップ
    if (!workspace.isEnabled) {
      console.log(`ワークスペース ${workspace.name}: 無効のためスキップ`);
      return;
    }

    // 通知設定がない場合はスキップ
    if (!workspace.notificationSettings) {
      console.log(`ワークスペース ${workspace.name}: 通知設定未登録のためスキップ`);
      return;
    }

    const settings = workspace.notificationSettings;

    // 通知条件チェック
    const notify = shouldNotify(event, {
      minIntensity: settings.minIntensity,
      targetPrefectures: settings.targetPrefectures,
    });

    if (!notify) {
      console.log(`ワークスペース ${workspace.name}: 通知条件に一致せず`);
      return;
    }

    console.log(`ワークスペース ${workspace.name}: 通知条件に一致、Slack通知を送信`);

    // Slack通知を送信
    await this.sendSlackNotification(event, workspace);
  }

  /**
   * Slack通知を送信
   */
  private async sendSlackNotification(
    event: EventItem,
    workspace: SlackWorkspaceSummary
  ): Promise<void> {
    try {
      console.log(`Slack通知送信開始: ワークスペース=${workspace.name}`);

      // 通知チャンネル情報を取得
      const channels = this.getNotificationChannels(workspace);

      if (channels.length === 0) {
        console.log("通知チャンネルが設定されていないためスキップ");
        return;
      }

      // 通知メッセージを構築
      const message = this.buildNotificationMessage(event);

      // 各チャンネルに送信
      for (const channel of channels) {
        console.log(`チャンネル ${channel.channelId} に通知送信`);

        const response = await fetch("/api/slack/send-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId: workspace.workspaceId,
            channelId: channel.channelId,
            message: message,
          }),
        });

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Slack通知送信成功: チャンネル=${channel.channelId}`);
        } else {
          console.error(
            `❌ Slack通知送信失敗: チャンネル=${channel.channelId}, エラー=${result.error}`
          );
        }
      }

      console.log("Slack通知送信完了");
    } catch (error) {
      console.error("Slack通知送信中にエラー:", error);
    }
  }

  /**
   * 通知チャンネル一覧を取得
   */
  private getNotificationChannels(
    workspace: SlackWorkspaceSummary
  ): Array<{ channelId: string; channelName?: string }> {
    const channels: Array<{ channelId: string; channelName?: string }> = [];

    const notificationChannels =
      workspace.notificationSettings?.notificationChannels;

    if (!notificationChannels) {
      return channels;
    }

    // notificationChannels の形式に応じて解析
    if (Array.isArray(notificationChannels)) {
      for (const ch of notificationChannels) {
        if (typeof ch === "string") {
          channels.push({ channelId: ch });
        } else if (typeof ch === "object" && ch.channelId) {
          channels.push({
            channelId: ch.channelId,
            channelName: ch.channelName,
          });
        }
      }
    } else if (
      typeof notificationChannels === "object" &&
      notificationChannels.channelId
    ) {
      channels.push({
        channelId: notificationChannels.channelId,
        channelName: notificationChannels.channelName,
      });
    }

    return channels;
  }

  /**
   * 通知メッセージを構築
   */
  private buildNotificationMessage(event: EventItem): any {
    const maxIntensity = getMaxIntensityFromEvent(event);
    const intensityText =
      maxIntensity && maxIntensity !== "0"
        ? `最大震度${maxIntensity}`
        : "震度調査中";
    const hypocenterText = event.hypocenter?.name
      ? `震源地: ${event.hypocenter.name}`
      : "震源地: 調査中";
    const magnitudeText = event.magnitude?.value
      ? `マグニチュード: M${event.magnitude.value}`
      : "";
    const depthText = event.hypocenter?.depth?.value
      ? `震源の深さ: 約${event.hypocenter.depth.value}km`
      : "";
    const timeText = event.originTime
      ? `発生時刻: ${new Date(event.originTime).toLocaleString("ja-JP")}`
      : "";

    // 確定状態の表示
    const statusText = event.isConfirmed ? "【確定情報】" : "【速報】";

    // Slack Blocks API形式でメッセージを構築
    return {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🚨 ${statusText}地震発生 - ${intensityText}`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*発生時刻:*\n${timeText || "調査中"}`,
            },
            {
              type: "mrkdwn",
              text: `*震源地:*\n${event.hypocenter?.name || "調査中"}`,
            },
            {
              type: "mrkdwn",
              text: `*マグニチュード:*\n${event.magnitude?.value ? `M${event.magnitude.value}` : "調査中"}`,
            },
            {
              type: "mrkdwn",
              text: `*最大震度:*\n${intensityText}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "**【安否確認のため、下記対応をお願いします】**\n" +
              "各リーダー・上長の方は、自組織のメンバーの確認をお願いします。\n" +
              "• 無事な方は所属の絵文字を押してください\n" +
              "• 救助などが必要な方は :sos: を押してください\n" +
              "• 連続で通知された場合は最後の通知の絵文字を押してください\n" +
              "落ち着いて行動してください",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `データ提供: DMData.jp | イベントID: ${event.eventId}`,
            },
          ],
        },
      ],
    };
  }
}
