"use client";

import { ScheduledTraining } from "../types/SafetyConfirmationTypes";
import { Settings } from "../../../lib/db/settings";

export class TrainingScheduleExecutor {
  private static instance: TrainingScheduleExecutor;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  static getInstance(): TrainingScheduleExecutor {
    if (!TrainingScheduleExecutor.instance) {
      TrainingScheduleExecutor.instance = new TrainingScheduleExecutor();
    }
    return TrainingScheduleExecutor.instance;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTrainings();
    }, 60000); // 1分ごとにチェック

    console.log("訓練スケジューラーを開始しました");
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("訓練スケジューラーを停止しました");
  }

  private async checkAndExecuteTrainings() {
    try {
      // 設定を読み込み
      const config = await Settings.get("safetyConfirmationConfig");
      if (!config?.training?.isEnabled) return;

      const now = new Date();
      const scheduledTrainings = config.training.scheduledTrainings || [];

      for (const training of scheduledTrainings) {
        if (!training.isActive) continue;

        const nextExecution = this.getNextExecutionTime(training);
        if (!nextExecution) continue;

        // 実行時間に達している場合
        if (nextExecution <= now && this.shouldExecute(training, now)) {
          await this.executeTraining(training);
          await this.updateLastExecuted(training.id);
        }
      }
    } catch (error) {
      console.error("訓練スケジュール実行エラー:", error);
    }
  }

  private getNextExecutionTime(training: ScheduledTraining): Date | null {
    if (!training.isRecurring) {
      return training.scheduledTime;
    }

    const now = new Date();
    let nextTime = new Date(training.scheduledTime);

    // 過去の時間の場合、次の実行時間を計算
    while (nextTime < now) {
      switch (training.recurringPattern) {
        case 'daily':
          nextTime.setDate(nextTime.getDate() + 1);
          break;
        case 'weekly':
          nextTime.setDate(nextTime.getDate() + 7);
          break;
        case 'monthly':
          nextTime.setMonth(nextTime.getMonth() + 1);
          break;
        default:
          return null;
      }
    }

    return nextTime;
  }

  private shouldExecute(training: ScheduledTraining, now: Date): boolean {
    const nextExecution = this.getNextExecutionTime(training);
    if (!nextExecution) return false;

    // 1分以内の誤差を許容
    const timeDiff = Math.abs(now.getTime() - nextExecution.getTime());
    const oneMinute = 60 * 1000;

    // 繰り返しの場合、前回実行から最低でも1時間は空ける
    if (training.isRecurring && training.lastExecuted) {
      const timeSinceLastExecution = now.getTime() - training.lastExecuted.getTime();
      const oneHour = 60 * 60 * 1000;
      if (timeSinceLastExecution < oneHour) {
        return false;
      }
    }

    return timeDiff <= oneMinute;
  }

  private async executeTraining(training: ScheduledTraining) {
    console.log(`訓練通知を実行中: ${training.message}`);
    
    try {
      // TODO: 実際のSlack通知送信実装
      await this.sendTrainingNotification(training);
      
      // 実行ログ
      console.log(`訓練通知送信完了: ${training.id}`);
      
      // ブラウザ通知も送信
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚧 訓練通知送信', {
          body: training.message,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('訓練通知送信エラー:', error);
    }
  }

  private async sendTrainingNotification(training: ScheduledTraining) {
    try {
      // 設定を読み込み
      const { SafetySettingsDatabase } = await import('./settingsDatabase');
      const config = await SafetySettingsDatabase.loadSettings();
      
      if (!config) {
        throw new Error('安否確認設定が見つかりません');
      }

      // ワークスペースを取得
      const targetWorkspace = training.workspaceId 
        ? config.slack.workspaces.find(ws => ws.id === training.workspaceId)
        : config.slack.workspaces.find(ws => ws.isEnabled); // 最初の有効ワークスペース

      if (!targetWorkspace) {
        throw new Error('送信先ワークスペースが見つかりません');
      }

      if (!targetWorkspace.botToken) {
        throw new Error('ワークスペースのBot Tokenが設定されていません');
      }

      // 訓練用チャンネルを取得
      const trainingChannels = config.slack.channels.filter(ch => 
        ch.workspaceId === targetWorkspace.id && ch.channelType === 'training'
      );

      if (trainingChannels.length === 0) {
        throw new Error('訓練用チャンネルが設定されていません');
      }

      const { SlackApiService } = await import('./slackApiService');
      const results = [];

      // 各訓練チャンネルに送信
      for (const channel of trainingChannels) {
        console.log(`訓練メッセージを送信中: ${channel.channelId}`);
        
        // チャンネル情報を事前に確認
        try {
          const channelInfo = await SlackApiService.getChannelInfo(
            targetWorkspace.botToken,
            channel.channelId
          );
          
          if (!channelInfo.success) {
            console.warn(`⚠️ チャンネル情報取得失敗: ${channel.channelId}`, channelInfo.error);
          } else {
            console.log(`チャンネル情報: ${channel.channelId} - ${channelInfo.channelName} (プライベート: ${channelInfo.isPrivate})`);
          }
        } catch (error) {
          console.warn(`チャンネル情報取得エラー: ${channel.channelId}`, error);
        }
        
        const result = await SlackApiService.sendMessage({
          botToken: targetWorkspace.botToken,
          channelId: channel.channelId,
          title: targetWorkspace.template.title,
          message: training.message,
          isTraining: true,
          departments: targetWorkspace.departments
        });

        results.push({ channel: channel.channelId, result });
        
        if (result.success) {
          console.log(`✅ 訓練メッセージ送信成功: ${channel.channelId}`);
        } else {
          console.error(`❌ 訓練メッセージ送信失敗: ${channel.channelId}`, result.error);
          
          // エラーの原因を詳しく表示
          if (result.error?.includes('チャンネルが見つかりません')) {
            console.error(`📝 解決方法: チャンネルID ${channel.channelId} が正しいか確認し、プライベートチャンネルの場合はボットを招待してください。`);
          }
        }
      }

      // 結果をチョック
      const successCount = results.filter(r => r.result.success).length;
      const totalCount = results.length;
      
      if (successCount > 0) {
        console.log(`🎉 訓練メッセージ送信完了: ${successCount}/${totalCount}チャンネル成功`);
      } else {
        throw new Error('すべてのチャンネルで送信に失敗しました');
      }
      
      return { success: true, results };
    } catch (error) {
      console.error('訓練通知送信エラー:', error);
      throw error;
    }
  }

  private async updateLastExecuted(trainingId: string) {
    try {
      const config = await Settings.get("safetyConfirmationConfig");
      if (!config) return;

      const updatedTrainings = config.training.scheduledTrainings.map(training =>
        training.id === trainingId
          ? { ...training, lastExecuted: new Date() }
          : training
      );

      const updatedConfig = {
        ...config,
        training: {
          ...config.training,
          scheduledTrainings: updatedTrainings
        }
      };

      await Settings.set("safetyConfirmationConfig", updatedConfig);
    } catch (error) {
      console.error('最終実行時間更新エラー:', error);
    }
  }

  // 手動でスケジュールチェックを実行
  async manualCheck() {
    console.log('手動スケジュールチェック実行');
    await this.checkAndExecuteTrainings();
  }

  // 即座に訓練を実行
  async executeImmediateTraining(message: string, workspaceId?: string) {
    const immediateTraining: ScheduledTraining = {
      id: `immediate_${Date.now()}`,
      workspaceId,
      scheduledTime: new Date(),
      message,
      enableMentions: false,
      mentionTargets: [],
      isRecurring: false,
      isActive: true
    };

    await this.executeTraining(immediateTraining);
  }
}

// ブラウザ環境でのみ自動開始
if (typeof window !== 'undefined') {
  // ページ読み込み時に自動開始
  window.addEventListener('load', () => {
    const scheduler = TrainingScheduleExecutor.getInstance();
    scheduler.start();
  });

  // ページ離脱時に停止
  window.addEventListener('beforeunload', () => {
    const scheduler = TrainingScheduleExecutor.getInstance();
    scheduler.stop();
  });
}