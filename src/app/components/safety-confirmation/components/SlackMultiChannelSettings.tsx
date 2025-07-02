"use client";

import { useState } from "react";
import cn from "classnames";
import { SlackNotificationSettings, SlackWorkspace, SlackChannel, createDefaultWorkspace } from "../types/SafetyConfirmationTypes";
import { WorkspaceDetailSettings } from "./WorkspaceDetailSettings";
import { SlackApiService, SlackTestResult } from "../utils/slackApiService";

interface SlackMultiChannelSettingsProps {
  settings: SlackNotificationSettings;
  onUpdate: (settings: SlackNotificationSettings) => void;
  currentConfig?: any; // 現在の全体設定を受け取る
}

export function SlackMultiChannelSettings({ settings, onUpdate, currentConfig }: SlackMultiChannelSettingsProps) {
  const [activeTab, setActiveTab] = useState<'workspaces' | 'channels'>('workspaces');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [tokenVerificationStatus, setTokenVerificationStatus] = useState<Record<string, { 
    status: 'idle' | 'verifying' | 'success' | 'error'; 
    message?: string;
    workspaceInfo?: any;
  }>>({});

  const addWorkspace = () => {
    const newWorkspace = createDefaultWorkspace(
      `workspace_${Date.now()}`
    );
    
    onUpdate({
      ...settings,
      workspaces: [...settings.workspaces, newWorkspace]
    });
  };

  const updateWorkspace = async (id: string, updates: Partial<SlackWorkspace>) => {
    const newSettings = {
      ...settings,
      workspaces: settings.workspaces.map(ws => 
        ws.id === id ? { ...ws, ...updates } : ws
      )
    };
    
    onUpdate(newSettings);
    
    // 自動保存（接続確認後やトークン更新時）
    try {
      const { SafetySettingsDatabase } = await import('../utils/settingsDatabase');
      if (currentConfig) {
        await SafetySettingsDatabase.saveSettings({
          ...currentConfig,
          slack: newSettings
        });
        console.log('ワークスペース設定を自動保存しました');
      }
    } catch (error) {
      console.error('ワークスペース設定の自動保存に失敗:', error);
    }
  };

  const verifyBotToken = async (workspaceId: string, botToken: string) => {
    if (!botToken.trim()) return;

    setTokenVerificationStatus(prev => ({
      ...prev,
      [workspaceId]: { status: 'verifying', message: 'トークンを検証中...' }
    }));

    try {
      const result = await SlackApiService.testBotToken(botToken);
      
      if (result.success) {
        setTokenVerificationStatus(prev => ({
          ...prev,
          [workspaceId]: { 
            status: 'success', 
            message: `✓ 接続成功: ${result.workspaceInfo?.name}`,
            workspaceInfo: result.workspaceInfo
          }
        }));

        // ワークスペース情報を更新（既存の名前がある場合は保持）
        if (result.workspaceInfo) {
          const currentWorkspace = settings.workspaces.find(ws => ws.id === workspaceId);
          const currentName = currentWorkspace?.name;
          
          // 既存の名前が空またはデフォルト値の場合のみSlackワークスペース名で更新
          if (!currentName || currentName.trim() === '' || currentName.startsWith('workspace_')) {
            updateWorkspace(workspaceId, {
              name: result.workspaceInfo.name || currentName
            });
          }
        }

        // 絵文字情報を更新
        if (result.emojis && result.emojis.length > 0) {
          updateWorkspace(workspaceId, {
            availableEmojis: result.emojis
          });
        }
      } else {
        setTokenVerificationStatus(prev => ({
          ...prev,
          [workspaceId]: { 
            status: 'error', 
            message: `✗ ${result.error}` 
          }
        }));
      }
    } catch (error) {
      setTokenVerificationStatus(prev => ({
        ...prev,
        [workspaceId]: { 
          status: 'error', 
          message: `✗ 接続エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
        }
      }));
    }
  };

  const removeWorkspace = (id: string) => {
    onUpdate({
      ...settings,
      workspaces: settings.workspaces.filter(ws => ws.id !== id),
      channels: settings.channels.filter(ch => ch.workspaceId !== id)
    });
  };

  const addChannel = () => {
    if (settings.workspaces.length === 0) {
      alert("まずワークスペースを追加してください");
      return;
    }

    const newChannel: SlackChannel = {
      id: `channel_${Date.now()}`,
      workspaceId: settings.workspaces[0].id,
      channelId: "",
      channelName: "",
      webhookUrl: "",
      isEnabled: true,
      priority: 'medium',
      channelType: 'production',
      healthStatus: 'unknown'
    };
    
    onUpdate({
      ...settings,
      channels: [...settings.channels, newChannel]
    });
  };

  const updateChannel = (id: string, updates: Partial<SlackChannel>) => {
    onUpdate({
      ...settings,
      channels: settings.channels.map(ch => 
        ch.id === id ? { ...ch, ...updates } : ch
      )
    });
  };

  const removeChannel = (id: string) => {
    onUpdate({
      ...settings,
      channels: settings.channels.filter(ch => ch.id !== id)
    });
  };

  const getWorkspaceName = (workspaceId: string): string => {
    const workspace = settings.workspaces.find(ws => ws.id === workspaceId);
    return workspace?.name || "不明なワークスペース";
  };

  const getPriorityBadge = (priority: SlackChannel['priority']) => {
    const styles = {
      high: "bg-red-900 text-red-300 border-red-500",
      medium: "bg-yellow-900 text-yellow-300 border-yellow-500", 
      low: "bg-gray-700 text-gray-300 border-gray-500"
    };
    
    const labels = {
      high: "高",
      medium: "中",
      low: "低"
    };

    return (
      <span className={cn("px-2 py-1 text-xs border rounded", styles[priority])}>
        {labels[priority]}
      </span>
    );
  };

  const getHealthStatusBadge = (status: SlackChannel['healthStatus']) => {
    const styles = {
      healthy: "bg-green-900 text-green-300 border-green-500",
      error: "bg-red-900 text-red-300 border-red-500",
      unknown: "bg-gray-700 text-gray-300 border-gray-500"
    };
    
    const labels = {
      healthy: "正常",
      error: "エラー",
      unknown: "不明"
    };
    
    return (
      <span className={cn("px-2 py-1 text-xs border rounded", styles[status || 'unknown'])}>
        {labels[status || 'unknown']}
      </span>
    );
  };

  const performHealthCheck = async (channel: SlackChannel) => {
    // ヘルステータスを「不明」に設定
    updateChannel(channel.id, { healthStatus: 'unknown' });
    
    try {
      // TODO: 実際のSlack APIを使ったヘルスチェック実装
      // とりあえずモック実装
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // チャンネルIDとWebhook URLが設定されているかチェック
      if (channel.channelId && channel.webhookUrl) {
        updateChannel(channel.id, { healthStatus: 'healthy' });
      } else {
        updateChannel(channel.id, { healthStatus: 'error' });
      }
    } catch (error) {
      updateChannel(channel.id, { healthStatus: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* タブナビゲーション */}
      <div className="flex border-b border-gray-600">
        <button
          onClick={() => setActiveTab('workspaces')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === 'workspaces'
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-white"
          )}
        >
          ワークスペース設定 ({settings.workspaces.length})
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === 'channels'
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-white"
          )}
        >
          チャンネル設定 ({settings.channels.length})
        </button>
      </div>

      {/* ワークスペース設定タブ */}
      {activeTab === 'workspaces' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">Slackワークスペース</h3>
            <button
              onClick={addWorkspace}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
            >
              + ワークスペースを追加
            </button>
          </div>

          <div className="space-y-4">
            {settings.workspaces.map(workspace => (
              <div key={workspace.id} className="bg-gray-700 p-4 rounded border border-gray-600">
                <div className="space-y-4">
                  {/* 基本情報 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        ワークスペース名（任意）
                        <span className="text-xs text-gray-400 block mt-1">
                          識別用の名前を自由に入力してください
                        </span>
                      </label>
                      <input
                        type="text"
                        value={workspace.name}
                        onChange={(e) => updateWorkspace(workspace.id, { name: e.target.value })}
                        placeholder="本社、開発チーム、営業部など"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Bot Token
                        <span className="text-xs text-gray-400 block mt-1">
                          OAuth & Permissions → Bot User OAuth Token
                        </span>
                      </label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={workspace.botToken}
                            onChange={(e) => updateWorkspace(workspace.id, { botToken: e.target.value })}
                            placeholder="xoxb-YOUR-TEAM-ID-YOUR-USER-ID-YOUR-BOT-TOKEN"
                            className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                          />
                          <button
                            onClick={() => verifyBotToken(workspace.id, workspace.botToken)}
                            disabled={!workspace.botToken || tokenVerificationStatus[workspace.id]?.status === 'verifying'}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                          >
                            {tokenVerificationStatus[workspace.id]?.status === 'verifying' ? '検証中...' : '接続確認'}
                          </button>
                        </div>
                        
                        {/* 検証結果表示 */}
                        {tokenVerificationStatus[workspace.id] && (
                          <div className={cn(
                            "text-xs px-3 py-2 rounded flex items-center gap-2",
                            tokenVerificationStatus[workspace.id].status === 'success' 
                              ? "bg-green-900 text-green-300 border border-green-500"
                              : tokenVerificationStatus[workspace.id].status === 'error'
                              ? "bg-red-900 text-red-300 border border-red-500"
                              : "bg-blue-900 text-blue-300 border border-blue-500"
                          )}>
                            {tokenVerificationStatus[workspace.id].status === 'verifying' && (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            )}
                            <span>{tokenVerificationStatus[workspace.id].message}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* コントロール */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workspace.isEnabled}
                        onChange={(e) => updateWorkspace(workspace.id, { isEnabled: e.target.checked })}
                        className="mr-2 w-4 h-4"
                      />
                      <span className="text-gray-300">有効</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedWorkspaceId(workspace.id)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                      >
                        通知設定
                      </button>

                      <button
                        onClick={() => removeWorkspace(workspace.id)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {settings.workspaces.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                ワークスペースが設定されていません。<br />
                「+ ワークスペースを追加」ボタンから追加してください。
              </div>
            )}
          </div>
        </div>
      )}

      {/* チャンネル設定タブ */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">通知チャンネル</h3>
            <button
              onClick={addChannel}
              disabled={settings.workspaces.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            >
              + チャンネルを追加
            </button>
          </div>

          <div className="space-y-4">
            {settings.channels.map(channel => (
              <div key={channel.id} className="bg-gray-700 p-4 rounded border border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      ワークスペース
                    </label>
                    <select
                      value={channel.workspaceId}
                      onChange={(e) => updateChannel(channel.id, { workspaceId: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    >
                      {settings.workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      チャンネル名
                    </label>
                    <input
                      type="text"
                      value={channel.channelName}
                      onChange={(e) => updateChannel(channel.id, { channelName: e.target.value })}
                      placeholder="#emergency-notifications"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      チャンネルID
                      <span className="text-xs text-gray-400 block mt-1">
                        チャンネル右クリック → リンクをコピー → 末尾のID部分 (C0123456789)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={channel.channelId}
                      onChange={(e) => updateChannel(channel.id, { channelId: e.target.value })}
                      placeholder="C0123456789"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Webhook URL
                      <span className="text-xs text-gray-400 block mt-1">
                        Incoming Webhooks → Add New Webhook to Workspace → URLをコピー
                      </span>
                    </label>
                    <input
                      type="url"
                      value={channel.webhookUrl}
                      onChange={(e) => updateChannel(channel.id, { webhookUrl: e.target.value })}
                      placeholder="https://hooks.slack.com/services/YOUR-TEAM-ID/YOUR-WEBHOOK-ID/YOUR-TOKEN"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      チャンネル種別
                    </label>
                    <select
                      value={channel.channelType}
                      onChange={(e) => updateChannel(channel.id, { channelType: e.target.value as 'production' | 'training' })}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    >
                      <option value="production">本番用</option>
                      <option value="training">訓練用</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      優先度
                    </label>
                    <select
                      value={channel.priority}
                      onChange={(e) => updateChannel(channel.id, { priority: e.target.value as SlackChannel['priority'] })}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    >
                      <option value="high">高優先度</option>
                      <option value="medium">中優先度</option>
                      <option value="low">低優先度</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      ヘルスステータス
                    </label>
                    <div className="flex items-center gap-2">
                      {getHealthStatusBadge(channel.healthStatus)}
                      <button
                        onClick={() => performHealthCheck(channel)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                      >
                        テスト
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(channel.priority)}
                      <span className={cn(
                        "px-2 py-1 text-xs rounded border",
                        channel.channelType === 'production' 
                          ? "bg-green-900 text-green-300 border-green-500"
                          : "bg-yellow-900 text-yellow-300 border-yellow-500"
                      )}>
                        {channel.channelType === 'production' ? '本番用' : '訓練用'}
                      </span>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={channel.isEnabled}
                          onChange={(e) => updateChannel(channel.id, { isEnabled: e.target.checked })}
                          className="mr-2 w-4 h-4"
                        />
                        <span className="text-gray-300">有効</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={() => removeChannel(channel.id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                  >
                    削除
                  </button>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  ワークスペース: {getWorkspaceName(channel.workspaceId)}
                </div>
              </div>
            ))}

            {settings.channels.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                通知チャンネルが設定されていません。<br />
                「+ チャンネルを追加」ボタンから追加してください。
              </div>
            )}
          </div>
        </div>
      )}

      {/* 設定手順ガイド */}
      <div className="bg-blue-900 bg-opacity-30 border border-blue-600 p-4 rounded">
        <h4 className="text-blue-300 font-medium mb-3">📋 Slack設定手順ガイド</h4>
        <div className="space-y-3 text-sm text-blue-200">
          <div>
            <strong>1. Slackアプリの作成</strong>
            <ul className="ml-4 mt-1 space-y-1 text-blue-300">
              <li>• <a href="https://api.slack.com/apps" target="_blank" className="underline">api.slack.com/apps</a> でアプリを作成</li>
              <li>• 「Create New App」→「From scratch」</li>
              <li>• アプリ名と対象ワークスペースを選択</li>
              <li>• ワークスペース名は識別用（本社、開発チームなど任意）</li>
            </ul>
          </div>
          <div>
            <strong>2. Bot Tokenの取得</strong>
            <ul className="ml-4 mt-1 space-y-1 text-blue-300">
              <li>• 「OAuth & Permissions」タブ</li>
              <li>• Scopes → Bot Token Scopes で「chat:write」を追加</li>
              <li>• 「Install to Workspace」をクリック</li>
              <li>• 「Bot User OAuth Token」をコピー (xoxb-で始まる)</li>
            </ul>
          </div>
          <div>
            <strong>3. Webhook URLの取得</strong>
            <ul className="ml-4 mt-1 space-y-1 text-blue-300">
              <li>• 「Incoming Webhooks」タブ → 「Activate Incoming Webhooks」をON</li>
              <li>• 「Add New Webhook to Workspace」</li>
              <li>• 通知したいチャンネルを選択</li>
              <li>• Webhook URLをコピー</li>
            </ul>
          </div>
          <div>
            <strong>4. チャンネルIDの取得</strong>
            <ul className="ml-4 mt-1 space-y-1 text-blue-300">
              <li>• Slackでチャンネルを右クリック → 「リンクをコピー」</li>
              <li>• URLの末尾がチャンネルID (C0123456789)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 設定概要 */}
      <div className="bg-gray-700 p-4 rounded">
        <h4 className="text-white font-medium mb-2">設定概要</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-300">
              有効なワークスペース: <span className="text-white">{settings.workspaces.filter(ws => ws.isEnabled).length}</span>
            </div>
            <div className="text-gray-300">
              有効なチャンネル: <span className="text-white">{settings.channels.filter(ch => ch.isEnabled).length}</span>
            </div>
          </div>
          <div>
            <div className="text-gray-300">
              高優先度チャンネル: <span className="text-white">{settings.channels.filter(ch => ch.priority === 'high' && ch.isEnabled).length}</span>
            </div>
            <div className="text-gray-300">
              中優先度チャンネル: <span className="text-white">{settings.channels.filter(ch => ch.priority === 'medium' && ch.isEnabled).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ワークスペース詳細設定モーダル */}
      {selectedWorkspaceId && (
        <WorkspaceDetailSettings
          workspace={settings.workspaces.find(ws => ws.id === selectedWorkspaceId)!}
          onUpdate={(updates) => updateWorkspace(selectedWorkspaceId, updates)}
          onClose={() => setSelectedWorkspaceId(null)}
        />
      )}
    </div>
  );
}