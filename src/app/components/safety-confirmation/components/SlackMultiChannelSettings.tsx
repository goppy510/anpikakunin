"use client";

import { useState } from "react";
import cn from "classnames";
import { SlackNotificationSettings, SlackWorkspace, SlackChannel } from "../types/SafetyConfirmationTypes";

interface SlackMultiChannelSettingsProps {
  settings: SlackNotificationSettings;
  onUpdate: (settings: SlackNotificationSettings) => void;
}

export function SlackMultiChannelSettings({ settings, onUpdate }: SlackMultiChannelSettingsProps) {
  const [activeTab, setActiveTab] = useState<'workspaces' | 'channels'>('workspaces');

  const addWorkspace = () => {
    const newWorkspace: SlackWorkspace = {
      id: `workspace_${Date.now()}`,
      name: "新しいワークスペース",
      botToken: "",
      isEnabled: true
    };
    
    onUpdate({
      ...settings,
      workspaces: [...settings.workspaces, newWorkspace]
    });
  };

  const updateWorkspace = (id: string, updates: Partial<SlackWorkspace>) => {
    onUpdate({
      ...settings,
      workspaces: settings.workspaces.map(ws => 
        ws.id === id ? { ...ws, ...updates } : ws
      )
    });
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
      channelName: "#新しいチャンネル",
      webhookUrl: "",
      isEnabled: true,
      priority: 'medium'
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      ワークスペース名
                    </label>
                    <input
                      type="text"
                      value={workspace.name}
                      onChange={(e) => updateWorkspace(workspace.id, { name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Bot Token
                    </label>
                    <input
                      type="password"
                      value={workspace.botToken}
                      onChange={(e) => updateWorkspace(workspace.id, { botToken: e.target.value })}
                      placeholder="xoxb-..."
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workspace.isEnabled}
                        onChange={(e) => updateWorkspace(workspace.id, { isEnabled: e.target.checked })}
                        className="mr-2 w-4 h-4"
                      />
                      <span className="text-gray-300">有効</span>
                    </label>

                    <button
                      onClick={() => removeWorkspace(workspace.id)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      削除
                    </button>
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
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      チャンネルID
                    </label>
                    <input
                      type="text"
                      value={channel.channelId}
                      onChange={(e) => updateChannel(channel.id, { channelId: e.target.value })}
                      placeholder="C1234567890"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={channel.webhookUrl}
                      onChange={(e) => updateChannel(channel.id, { webhookUrl: e.target.value })}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        優先度
                      </label>
                      <select
                        value={channel.priority}
                        onChange={(e) => updateChannel(channel.id, { priority: e.target.value as SlackChannel['priority'] })}
                        className="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                      >
                        <option value="high">高優先度</option>
                        <option value="medium">中優先度</option>
                        <option value="low">低優先度</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      {getPriorityBadge(channel.priority)}
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
    </div>
  );
}