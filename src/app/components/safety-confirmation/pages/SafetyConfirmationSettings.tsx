"use client";

import { useState, useEffect } from "react";
import cn from "classnames";
import { 
  SafetyConfirmationConfig, 
  SlackNotificationSettings,
  TrainingMode
} from "../types/SafetyConfirmationTypes";
import { SlackMultiChannelSettings } from "../components/SlackMultiChannelSettings";
import { TrainingScheduler } from "../components/TrainingScheduler";
import { SetupTab } from "../components/SetupTab";
import { Settings } from "../../../lib/db/settings";
import { TrainingScheduleExecutor } from "../utils/trainingScheduler";
import { SafetySettingsDatabase } from "../utils/settingsDatabase";

interface SafetyConfirmationSettingsProps {
  onClose: () => void;
}

export function SafetyConfirmationSettings({ onClose }: SafetyConfirmationSettingsProps) {
  const [config, setConfig] = useState<SafetyConfirmationConfig>({
    slack: {
      workspaces: [],
      channels: []
    },
    training: {
      isEnabled: true,
      testMessage: "これは地震対応訓練です。実際の地震ではありません。",
      enableMentions: false,
      mentionTargets: [],
      scheduledTrainings: []
    },
    isActive: false
  });

  // 設定読み込み
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // まずIndexedDBから読み込み
        const dbConfig = await SafetySettingsDatabase.loadSettings();
        if (dbConfig) {
          console.log("IndexedDBから安否確認設定を読み込みました");
          setConfig(dbConfig);
          return;
        }

        // IndexedDBにない場合は従来のLocalStorageから読み込み
        const savedConfig = await Settings.get("safetyConfirmationConfig");
        if (savedConfig) {
          console.log("LocalStorageから安否確認設定を読み込みました");
          setConfig(savedConfig);
          
          // IndexedDBに移行保存
          await SafetySettingsDatabase.saveSettings(savedConfig);
          console.log("設定をIndexedDBに移行保存しました");
        }
      } catch (error) {
        console.error("設定の読み込みに失敗しました:", error);
      }
    };

    loadConfig();
  }, []);

  const [activeTab, setActiveTab] = useState<'slack' | 'message' | 'training' | 'setup'>('slack');

  const updateSlackSettings = async (newSettings: SlackNotificationSettings) => {
    const newConfig = {
      ...config,
      slack: newSettings
    };
    setConfig(newConfig);
    
    // 自動保存
    try {
      await SafetySettingsDatabase.saveSettings(newConfig);
      console.log('Slack設定を自動保存しました');
    } catch (error) {
      console.error('Slack設定の自動保存に失敗:', error);
    }
  };


  const updateTraining = (updates: Partial<TrainingMode>) => {
    setConfig(prev => ({
      ...prev,
      training: { ...prev.training, ...updates }
    }));
  };

  const handleSave = async () => {
    try {
      // IndexedDBに保存
      await SafetySettingsDatabase.saveSettings(config);
      
      // 下位互換性のためLocalStorageにも保存
      await Settings.set("safetyConfirmationConfig", config);
      
      alert("設定を保存しました");
      onClose();
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
      alert("設定の保存に失敗しました");
    }
  };

  const sendTestNotification = async () => {
    try {
      console.log('テスト通知送信を開始...');
      
      // 設定確認
      if (!config.slack.workspaces.some(ws => ws.isEnabled)) {
        alert('有効なワークスペースがありません。Slack設定を確認してください。');
        return;
      }
      
      if (!config.slack.channels.some(ch => ch.channelType === 'training')) {
        alert('訓練用チャンネルが設定されていません。チャンネル設定で訓練用チャンネルを追加してください。');
        return;
      }

      const scheduler = TrainingScheduleExecutor.getInstance();
      await scheduler.executeImmediateTraining(
        config.training.testMessage || "これはテスト通知です。"
      );
      alert("✅ テスト通知を訓練用チャンネルに送信しました！");
    } catch (error) {
      console.error("テスト通知送信エラー:", error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      
      let userMessage = `❌ テスト通知の送信に失敗しました: ${errorMessage}`;
      
      // エラーメッセージに応じて解決方法を追加
      if (errorMessage.includes('チャンネルが見つかりません')) {
        userMessage += '\n\n📝 解決方法:\n1. チャンネルIDが正しいか確認してください\n2. プライベートチャンネルの場合はボットをチャンネルに招待してください\n3. チャンネル設定でチャンネルIDを再確認してください';
      } else if (errorMessage.includes('ボットがチャンネルに招待されていません')) {
        userMessage += '\n\n📝 解決方法:\n1. Slackチャンネルで "/invite @ボット名" を実行\n2. チャンネルのメンバー一覧にボットが表示されることを確認';
      } else if (errorMessage.includes('必要な権限がありません')) {
        userMessage += '\n\n📝 解決方法:\n1. Slackアプリ設定で "chat:write" スコープを追加\n2. ワークスペースにアプリを再インストール\n3. 新しいBot Tokenで接続確認を実行';
      }
      
      alert(userMessage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">安否確認システム設定</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.isActive}
                onChange={(e) => setConfig(prev => ({ ...prev, isActive: e.target.checked }))}
                className="mr-2 w-4 h-4"
              />
              <span className="text-white text-sm">システム有効化</span>
            </label>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-gray-700">
          {[
            { key: 'slack', label: 'Slack設定' },
            { key: 'message', label: 'メッセージ設定' },
            { key: 'training', label: '訓練モード' },
            { key: 'setup', label: '集計設定' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "text-blue-400 border-b-2 border-blue-400 bg-gray-700"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'slack' && (
            <SlackSettingsTab 
              settings={config.slack} 
              onUpdate={updateSlackSettings}
              currentConfig={config}
            />
          )}
          {activeTab === 'message' && (
            <MessageTab 
              config={config}
              onUpdate={setConfig}
            />
          )}
          {activeTab === 'training' && (
            <TrainingTab 
              training={config.training}
              workspaces={config.slack.workspaces}
              onUpdate={updateTraining}
              onSendTest={sendTestNotification}
            />
          )}
          {activeTab === 'setup' && (
            <SetupTab />
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-4 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
          >
            閉じる
          </button>
          <div className="text-xs text-gray-400 flex items-center">
            設定は自動保存されます
          </div>
        </div>
      </div>
    </div>
  );
}

// Slack設定タブ
function SlackSettingsTab({ 
  settings, 
  onUpdate,
  currentConfig
}: { 
  settings: SlackNotificationSettings; 
  onUpdate: (newSettings: SlackNotificationSettings) => void;
  currentConfig: any;
}) {
  return (
    <div className="p-6">
      <SlackMultiChannelSettings 
        settings={settings}
        onUpdate={onUpdate}
        currentConfig={currentConfig}
      />
    </div>
  );
}


// メッセージ設定タブ
function TemplateTab({ 
  template, 
  departments, 
  onUpdateTemplate, 
  onAddDepartment, 
  onUpdateDepartment, 
  onRemoveDepartment 
}: {
  template: NotificationTemplate;
  departments: DepartmentStamp[];
  onUpdateTemplate: (updates: Partial<NotificationTemplate>) => void;
  onAddDepartment: () => void;
  onUpdateDepartment: (id: string, updates: Partial<DepartmentStamp>) => void;
  onRemoveDepartment: (id: string) => void;
}) {
  return (
    <div className="p-6 space-y-6">
      {/* メッセージテンプレート */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">通知メッセージ設定</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            通知タイトル
          </label>
          <input
            type="text"
            value={template.title}
            onChange={(e) => onUpdateTemplate({ title: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            メッセージ本文
          </label>
          <textarea
            value={template.message}
            onChange={(e) => onUpdateTemplate({ message: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={template.includeEventDetails}
              onChange={(e) => onUpdateTemplate({ includeEventDetails: e.target.checked })}
              className="mr-2 w-4 h-4"
            />
            <span className="text-gray-300">地震詳細情報を含める</span>
          </label>

          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={template.includeMapLink}
              onChange={(e) => onUpdateTemplate({ includeMapLink: e.target.checked })}
              className="mr-2 w-4 h-4"
            />
            <span className="text-gray-300">地図リンクを含める</span>
          </label>
        </div>
      </div>

      {/* 部署スタンプ設定 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">部署スタンプ設定</h3>
          <button
            onClick={onAddDepartment}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
          >
            + 部署を追加
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map(dept => (
            <div key={dept.id} className="bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{dept.emoji}</span>
                  <input
                    type="text"
                    value={dept.name}
                    onChange={(e) => onUpdateDepartment(dept.id, { name: e.target.value })}
                    className="bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm flex-1"
                  />
                </div>
                <button
                  onClick={() => onRemoveDepartment(dept.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  削除
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">絵文字</label>
                  <input
                    type="text"
                    value={dept.emoji}
                    onChange={(e) => onUpdateDepartment(dept.id, { emoji: e.target.value })}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">カラー</label>
                  <input
                    type="color"
                    value={dept.color}
                    onChange={(e) => onUpdateDepartment(dept.id, { color: e.target.value })}
                    className="w-full h-8 bg-gray-600 border border-gray-500 rounded"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// メッセージ設定タブ
function MessageTab({ 
  config, 
  onUpdate 
}: { 
  config: SafetyConfirmationConfig; 
  onUpdate: (config: SafetyConfirmationConfig) => void; 
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  
  const selectedWorkspace = config.slack.workspaces.find(ws => ws.id === selectedWorkspaceId) || config.slack.workspaces[0];
  
  const updateWorkspace = async (workspaceId: string, updates: Partial<any>) => {
    const newConfig = {
      ...config,
      slack: {
        ...config.slack,
        workspaces: config.slack.workspaces.map(ws => 
          ws.id === workspaceId ? { ...ws, ...updates } : ws
        )
      }
    };
    onUpdate(newConfig);
    
    // 自動保存
    try {
      const { SafetySettingsDatabase } = await import('../utils/settingsDatabase');
      await SafetySettingsDatabase.saveSettings(newConfig);
    } catch (error) {
      console.error('設定の自動保存に失敗:', error);
    }
  };

  const addDepartment = (workspaceId: string) => {
    const newDept = {
      id: `dept_${Date.now()}`,
      name: "新しい部署",
      emoji: "🏢",
      color: "#3B82F6"
    };
    
    const workspace = config.slack.workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      updateWorkspace(workspaceId, {
        departments: [...workspace.departments, newDept]
      });
    }
  };

  const updateDepartment = (workspaceId: string, deptId: string, updates: Partial<any>) => {
    const workspace = config.slack.workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      updateWorkspace(workspaceId, {
        departments: workspace.departments.map(dept => 
          dept.id === deptId ? { ...dept, ...updates } : dept
        )
      });
    }
  };

  const removeDepartment = (workspaceId: string, deptId: string) => {
    const workspace = config.slack.workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      updateWorkspace(workspaceId, {
        departments: workspace.departments.filter(dept => dept.id !== deptId)
      });
    }
  };

  const mockEarthquake = {
    eventId: "20240101123000",
    hypocenter: { name: "千葉県東方沖" },
    magnitude: { value: "5.2" },
    maxInt: "4",
    originTime: new Date().toISOString(),
    prefectures: ["千葉県", "茨城県", "東京都"]
  };

  if (!selectedWorkspace) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400">
          メッセージ設定を表示するには、まずワークスペースを追加してください。
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">メッセージ設定</h3>
        <select
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          {config.slack.workspaces.map(ws => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
      </div>
      
      {/* WorkspaceDetailSettingsの内容をここに統合 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: 設定フォーム */}
        <div className="space-y-6">
          <h4 className="text-lg font-medium text-white">通知メッセージ設定</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              通知タイトル
            </label>
            <input
              type="text"
              value={selectedWorkspace.template.title}
              onChange={(e) => updateWorkspace(selectedWorkspace.id, { 
                template: { ...selectedWorkspace.template, title: e.target.value }
              })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              メッセージ本文
              <span className="text-xs text-gray-400 block mt-1">
                *太字* _斜体_ ~取り消し線~ `コード` が使用できます
              </span>
            </label>
            <textarea
              value={selectedWorkspace.template.message}
              onChange={(e) => updateWorkspace(selectedWorkspace.id, { 
                template: { ...selectedWorkspace.template, message: e.target.value }
              })}
              rows={6}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="*重要* 地震が発生しました。安否確認のため、該当部署のスタンプを押してください。"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWorkspace.template.includeEventDetails}
                onChange={(e) => updateWorkspace(selectedWorkspace.id, { 
                  template: { ...selectedWorkspace.template, includeEventDetails: e.target.checked }
                })}
                className="mr-2 w-4 h-4"
              />
              <span className="text-gray-300">地震詳細情報を含める</span>
            </label>

            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWorkspace.template.includeMapLink}
                onChange={(e) => updateWorkspace(selectedWorkspace.id, { 
                  template: { ...selectedWorkspace.template, includeMapLink: e.target.checked }
                })}
                className="mr-2 w-4 h-4"
              />
              <span className="text-gray-300">地図リンクを含める</span>
            </label>
          </div>

          {/* 部署スタンプ設定 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-white">部署スタンプ設定</h4>
              <button
                onClick={() => addDepartment(selectedWorkspace.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                + 部署を追加
              </button>
            </div>

            <div className="space-y-3">
              {selectedWorkspace.departments.map(dept => (
                <div key={dept.id} className="bg-gray-700 p-4 rounded border border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-2xl">{dept.emoji}</span>
                      <input
                        type="text"
                        value={dept.name}
                        onChange={(e) => updateDepartment(selectedWorkspace.id, dept.id, { name: e.target.value })}
                        className="bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm flex-1"
                      />
                    </div>
                    <button
                      onClick={() => removeDepartment(selectedWorkspace.id, dept.id)}
                      className="text-red-400 hover:text-red-300 text-sm ml-2"
                    >
                      削除
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">絵文字</label>
                      <EmojiSelector
                        currentEmoji={dept.emoji}
                        workspace={selectedWorkspace}
                        onSelect={(emoji) => updateDepartment(selectedWorkspace.id, dept.id, { emoji })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">カラー</label>
                      <input
                        type="color"
                        value={dept.color}
                        onChange={(e) => updateDepartment(selectedWorkspace.id, dept.id, { color: e.target.value })}
                        className="w-full h-8 bg-gray-600 border border-gray-500 rounded"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 右側: プレビュー */}
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-medium text-white">Slack通知プレビュー</h4>
          </div>
          
          {/* Slackライクなプレビュー */}
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex items-start gap-3">
              {/* ボットアイコン */}
              <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                🚨
              </div>
              
              <div className="flex-1">
                {/* ヘッダー */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">地震通知システム</span>
                  <span className="text-xs text-gray-500">今すぐ</span>
                </div>
                
                {/* メッセージ */}
                <div className="space-y-2">
                  <div className="font-bold text-gray-900">
                    {selectedWorkspace.template.title}
                  </div>
                  <SlackMessagePreview 
                    content={selectedWorkspace.template.message}
                  />
                  
                  {selectedWorkspace.template.includeEventDetails && (
                    <div className="bg-gray-50 p-3 rounded border-l-4 border-orange-400">
                      <div className="text-sm space-y-1">
                        <div><strong>震源:</strong> {mockEarthquake.hypocenter.name}</div>
                        <div><strong>マグニチュード:</strong> {mockEarthquake.magnitude.value}</div>
                        <div><strong>最大震度:</strong> {mockEarthquake.maxInt}</div>
                        <div><strong>発生時刻:</strong> {new Date(mockEarthquake.originTime).toLocaleString('ja-JP')}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* 部署ボタン */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                      <strong>安否確認（該当部署のボタンを押してください）</strong>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <span>⚠️</span>
                      <span>一人一回のみ回答可能です</span>
                    </div>
                    
                    {/* ボタンプレビュー */}
                    <div className="grid grid-cols-2 gap-2">
                      {selectedWorkspace.departments.map((dept, index) => (
                        <button
                          key={dept.id}
                          className="px-3 py-2 rounded text-sm font-medium border-2 bg-white transition-colors"
                          style={{ 
                            borderColor: dept.color,
                            color: dept.color
                          }}
                          disabled
                        >
                          {dept.emoji} {dept.name} ({index % 3 === 0 ? 3 : index % 3 === 1 ? 1 : 0})
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {selectedWorkspace.template.includeMapLink && (
                    <div>
                      <a href="#" className="text-blue-600 hover:underline text-sm">
                        📍 地図で詳細を確認
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 p-4 rounded">
            <h4 className="text-white font-medium mb-2">プレビュー設定</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• 実際の通知では地震の詳細情報が自動で挿入されます</li>
              <li>• リアクションは一人一つまで、同じ絵文字は重複できません</li>
              <li>• リアクション数はSlackの標準機能で自動表示されます</li>
              <li>• 地図リンクは実際の地震位置にリンクされます</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// 訓練モードタブ
function TrainingTab({ 
  training, 
  workspaces,
  onUpdate, 
  onSendTest 
}: {
  training: TrainingMode;
  workspaces: any[];
  onUpdate: (updates: Partial<TrainingMode>) => void;
  onSendTest: () => void;
}) {

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white">訓練モード設定</h3>
        <p className="text-sm text-gray-400 mt-1">訓練モードは常時有効です。「即座にテスト送信」で訓練用チャンネルにメッセージを送信できます。</p>
      </div>

      {/* スケジュール機能 */}
      <TrainingScheduler
        scheduledTrainings={training.scheduledTrainings}
        workspaces={workspaces}
        onUpdate={(trainings) => onUpdate({ scheduledTrainings: trainings })}
        onSendTest={onSendTest}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側: 設定フォーム */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                訓練メッセージ
              </label>
              <textarea
                value={training.testMessage}
                onChange={(e) => onUpdate({ testMessage: e.target.value })}
                rows={6}
                placeholder="これは地震対応訓練です。実際の地震ではありません。"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={training.enableMentions}
                  onChange={(e) => onUpdate({ enableMentions: e.target.checked })}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-gray-300">訓練時にメンションを送信</span>
              </label>
            </div>

            <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 p-4 rounded">
              <div className="text-yellow-200 text-sm">
                <strong>⚠️ 注意:</strong> 訓練モードでは実際のSlackチャンネルに「訓練」と明記されたメッセージが送信されます。
                訓練が完了したら、送信されたメッセージを削除することをお勧めします。
              </div>
            </div>
          </div>
          
          {/* 右側: 訓練モードプレビュー */}
          <TrainingPreview 
            training={training}
            workspaces={workspaces}
          />
      </div>
    </div>
  );
}

// 訓練モードプレビューコンポーネント
function TrainingPreview({ 
  training, 
  workspaces 
}: { 
  training: TrainingMode; 
  workspaces: any[]; 
}) {
  // 最初の有効ワークスペースを取得
  const selectedWorkspace = workspaces.find(ws => ws.isEnabled) || workspaces[0];
  
  if (!selectedWorkspace) {
    return (
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-white">訓練モードプレビュー</h4>
        <div className="text-center py-8 text-gray-400">
          プレビューを表示するには、まずワークスペースを追加してください。
        </div>
      </div>
    );
  }

  const mockEarthquake = {
    eventId: "20240101123000",
    hypocenter: { name: "千葉県東方沖" },
    magnitude: { value: "5.2" },
    maxInt: "4",
    originTime: new Date().toISOString(),
    prefectures: ["千葉県", "茨城県", "東京都"]
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-white">訓練モードプレビュー</h4>
      
      {/* Slackライクなプレビュー */}
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <div className="flex items-start gap-3">
          {/* ボットアイコン */}
          <div className="w-9 h-9 bg-yellow-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            🚧
          </div>
          
          <div className="flex-1">
            {/* ヘッダー */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900">地震通知システム</span>
              <span className="text-xs text-gray-500">今すぐ</span>
            </div>
            
            {/* メッセージ */}
            <div className="space-y-2">
              <div className="font-bold text-gray-900">
                【訓練です】 {selectedWorkspace.template.title} 【訓練です】
              </div>
              <SlackMessagePreview 
                content={`【訓練です】\n\n${training.testMessage}\n\n【訓練です】`}
              />
              
              {selectedWorkspace.template.includeEventDetails && (
                <div className="bg-gray-50 p-3 rounded border-l-4 border-yellow-400">
                  <div className="text-sm space-y-1">
                    <div><strong>震源:</strong> {mockEarthquake.hypocenter.name}</div>
                    <div><strong>マグニチュード:</strong> {mockEarthquake.magnitude.value}</div>
                    <div><strong>最大震度:</strong> {mockEarthquake.maxInt}</div>
                    <div><strong>発生時刻:</strong> {new Date(mockEarthquake.originTime).toLocaleString('ja-JP')}</div>
                  </div>
                </div>
              )}
              
              {/* 部署ボタン */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">
                  <strong>安否確認（該当部署のボタンを押してください）</strong>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                  <span>⚠️</span>
                  <span>一人一回のみ回答可能です</span>
                </div>
                
                {/* ボタンプレビュー */}
                <div className="grid grid-cols-2 gap-2">
                  {selectedWorkspace.departments.map((dept, index) => (
                    <button
                      key={dept.id}
                      className="px-3 py-2 rounded text-sm font-medium border-2 bg-yellow-50 transition-colors"
                      style={{ 
                        borderColor: dept.color,
                        color: dept.color
                      }}
                      disabled
                    >
                      {dept.emoji} {dept.name} ({index % 2 === 0 ? 2 : 0})
                    </button>
                  ))}
                </div>
              </div>
              
              {selectedWorkspace.template.includeMapLink && (
                <div>
                  <a href="#" className="text-blue-600 hover:underline text-sm">
                    📍 地図で詳細を確認
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-700 p-4 rounded">
        <h5 className="text-white font-medium mb-2">訓練プレビュー説明</h5>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• 訓練モードではタイトルとメッセージに「【訓練です】」が付加されます</li>
          <li>• 訓練用チャンネルにのみ送信されます</li>
          <li>• 部署スタンプの数字は実際に押された人数が表示されます</li>
        </ul>
      </div>
    </div>
  );
}

// Slackメッセージプレビューコンポーネント
function SlackMessagePreview({ content }: { content: string }) {
  // Slackマークダウンを簡易的にHTMLに変換
  const renderSlackMarkdown = (text: string) => {
    if (!text) return <span className="text-gray-500 italic">メッセージが入力されていません</span>;
    
    // 行ごとに分割
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      // 各行内のマークダウンを処理
      const processLine = (lineText: string) => {
        const parts: React.ReactNode[] = [];
        let currentIndex = 0;
        
        // 正規表現でマークダウンパターンを検索
        const patterns = [
          { regex: /\*([^*]+)\*/g, wrapper: (text: string) => <strong key={`bold-${currentIndex}`} className="font-bold text-gray-900">{text}</strong> },
          { regex: /_([^_]+)_/g, wrapper: (text: string) => <em key={`italic-${currentIndex}`} className="italic text-gray-700">{text}</em> },
          { regex: /~([^~]+)~/g, wrapper: (text: string) => <span key={`strike-${currentIndex}`} className="line-through text-gray-600">{text}</span> },
          { regex: /`([^`]+)`/g, wrapper: (text: string) => <code key={`code-${currentIndex}`} className="bg-gray-200 px-1 rounded text-sm font-mono text-gray-800">{text}</code> },
        ];
        
        let workingText = lineText;
        const replacements: { start: number; end: number; element: React.ReactNode }[] = [];
        
        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.regex.exec(lineText)) !== null) {
            replacements.push({
              start: match.index,
              end: match.index + match[0].length,
              element: pattern.wrapper(match[1])
            });
          }
          pattern.regex.lastIndex = 0; // リセット
        });
        
        // 重複しない範囲でソート
        replacements.sort((a, b) => a.start - b.start);
        
        // 重複を除去
        const validReplacements = [];
        for (const replacement of replacements) {
          const hasOverlap = validReplacements.some(valid => 
            (replacement.start < valid.end && replacement.end > valid.start)
          );
          if (!hasOverlap) {
            validReplacements.push(replacement);
          }
        }
        
        // テキストを構築
        let lastIndex = 0;
        validReplacements.forEach((replacement, index) => {
          // 前のテキスト
          if (replacement.start > lastIndex) {
            parts.push(workingText.slice(lastIndex, replacement.start));
          }
          // 置換要素
          parts.push(replacement.element);
          lastIndex = replacement.end;
        });
        
        // 残りのテキスト
        if (lastIndex < workingText.length) {
          parts.push(workingText.slice(lastIndex));
        }
        
        return parts.length > 0 ? parts : [lineText];
      };
      
      return (
        <div key={lineIndex} className="text-gray-700 leading-relaxed text-sm">
          {processLine(line)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-1">
      {renderSlackMarkdown(content)}
    </div>
  );
}

// 絵文字選択コンポーネント
function EmojiSelector({
  currentEmoji,
  workspace,
  onSelect
}: {
  currentEmoji: string;
  workspace: any;
  onSelect: (emoji: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // デフォルト絵文字セット
  const defaultEmojis = [
    "🏢", "👥", "💰", "📊", "⚙️", "🔧", "📋", "📞", 
    "🎯", "🚀", "💡", "📝", "🎨", "📈", "🛡️", "🌟",
    "🔥", "⭐", "✅", "❌", "⚠️", "🔔", "📢", "💬",
    "📦", "💼", "📊", "📋", "📅", "📏", "📐", "📑",
    "📘", "📙", "📚", "📜", "📝", "📞", "📟", "📠"
  ];

  // 検索フィルタリング
  const filteredEmojis = defaultEmojis.filter(emoji => 
    searchTerm === "" || emoji.includes(searchTerm)
  );

  // Slack絵文字も含める
  const slackEmojis = workspace?.availableEmojis || [];
  
  // Slackカスタム絵文字の検索フィルタリング
  const filteredSlackEmojis = slackEmojis.filter((emoji: any) => 
    searchTerm === "" || emoji.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="flex">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-gray-600 border border-gray-500 rounded-l px-2 py-1 text-white text-sm hover:bg-gray-500 transition-colors flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <span className="text-lg">{currentEmoji}</span>
            <span className="text-xs text-gray-300">選択</span>
          </span>
          <span className="text-gray-400">▼</span>
        </button>
        <input
          type="text"
          value={currentEmoji}
          onChange={(e) => onSelect(e.target.value)}
          className="w-16 bg-gray-600 border border-l-0 border-gray-500 rounded-r px-2 py-1 text-white text-sm"
          placeholder="😊"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 border-b border-gray-600">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="絵文字を検索..."
              className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm"
            />
          </div>
          
          {/* デフォルト絵文字 */}
          <div className="border-b border-gray-600">
            <div className="px-2 py-1 text-xs text-gray-400 bg-gray-800">
              標準絵文字
            </div>
            <div className="grid grid-cols-8 gap-1 p-2 overflow-y-auto max-h-32">
              {filteredEmojis.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    setIsOpen(false);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-600 rounded transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Slackカスタム絵文字 */}
          {filteredSlackEmojis.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs text-gray-400 bg-gray-800">
                Slackカスタム絵文字 ({filteredSlackEmojis.length}個)
              </div>
              <div className="grid grid-cols-6 gap-1 p-2 overflow-y-auto max-h-40">
                {filteredSlackEmojis.map((emoji: any) => (
                  <button
                    key={emoji.name}
                    type="button"
                    onClick={() => {
                      onSelect(`:${emoji.name}:`);
                      setIsOpen(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-600 rounded transition-colors border border-transparent hover:border-blue-500"
                    title={emoji.name}
                  >
                    <img 
                      src={emoji.url} 
                      alt={emoji.name} 
                      className="w-6 h-6 object-contain" 
                      onError={(e) => {
                        // 画像読み込みエラー時は絵文字名を表示
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          target.parentElement.textContent = `:${emoji.name}:`;
                        }
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Slackカスタム絵文字がない場合の案内 */}
          {slackEmojis.length === 0 && (
            <div className="px-2 py-3 text-xs text-gray-500 text-center border-t border-gray-600">
              カスタム絵文字を使用するには、<br />
              ワークスペースのBot Token接続確認を行ってください
            </div>
          )}

          <div className="p-2 border-t border-gray-600">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}