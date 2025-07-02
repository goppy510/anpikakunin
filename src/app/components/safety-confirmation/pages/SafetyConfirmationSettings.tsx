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
      isEnabled: false,
      testMessage: "これは訓練メッセージです。",
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

  const [activeTab, setActiveTab] = useState<'slack' | 'preview' | 'training'>('slack');

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
      const scheduler = TrainingScheduleExecutor.getInstance();
      await scheduler.executeImmediateTraining(
        config.training.testMessage || "これはテスト通知です。"
      );
      alert("テスト通知を送信しました");
    } catch (error) {
      console.error("テスト通知送信エラー:", error);
      alert("テスト通知の送信に失敗しました");
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
            { key: 'preview', label: 'プレビュー' },
            { key: 'training', label: '訓練モード' }
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
          {activeTab === 'preview' && (
            <PreviewTab 
              config={config} 
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

// プレビュータブ
function PreviewTab({ config }: { config: SafetyConfirmationConfig }) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  
  const selectedWorkspace = config.slack.workspaces.find(ws => ws.id === selectedWorkspaceId) || config.slack.workspaces[0];
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
          プレビューを表示するには、まずワークスペースを追加してください。
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Slack通知プレビュー</h3>
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
      
      {/* Slackライクなプレビュー */}
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-md">
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
              <div className="font-bold text-gray-900">{selectedWorkspace.template.title}</div>
              <div className="text-gray-700 text-sm">{selectedWorkspace.template.message}</div>
              
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
              
              {/* 部署スタンプ */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">安否確認（該当部署のスタンプを押してください）:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedWorkspace.departments.map(dept => (
                    <button
                      key={dept.id}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-xs"
                      style={{ borderColor: dept.color }}
                    >
                      <span>{dept.emoji}</span>
                      <span>{dept.name}</span>
                      <span className="text-gray-500">(0)</span>
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
          <li>• スタンプの数字は実際に押された人数が表示されます</li>
          <li>• 地図リンクは実際の地震位置にリンクされます</li>
        </ul>
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
  const [testMessages, setTestMessages] = useState<Array<{
    id: string;
    message: string;
    sentAt: Date;
    mentions: boolean;
  }>>([]);

  const sendTrainingMessage = () => {
    const newMessage = {
      id: `test_${Date.now()}`,
      message: training.testMessage,
      sentAt: new Date(),
      mentions: training.enableMentions
    };
    setTestMessages(prev => [newMessage, ...prev]);
    onSendTest();
  };

  const deleteTestMessage = (id: string) => {
    setTestMessages(prev => prev.filter(msg => msg.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">訓練モード設定</h3>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={training.isEnabled}
            onChange={(e) => onUpdate({ isEnabled: e.target.checked })}
            className="mr-2 w-4 h-4"
          />
          <span className="text-gray-300">訓練モードを有効にする</span>
        </label>
      </div>

      {/* スケジュール機能 */}
      <TrainingScheduler
        scheduledTrainings={training.scheduledTrainings}
        workspaces={workspaces}
        onUpdate={(trainings) => onUpdate({ scheduledTrainings: trainings })}
        onSendTest={onSendTest}
      />

      {training.isEnabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              訓練メッセージ
            </label>
            <textarea
              value={training.testMessage}
              onChange={(e) => onUpdate({ testMessage: e.target.value })}
              rows={3}
              placeholder="これは地震対応訓練です。実際の地震ではありません。"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={training.enableMentions}
                onChange={(e) => onUpdate({ enableMentions: e.target.checked })}
                className="mr-2 w-4 h-4"
              />
              <span className="text-gray-300">訓練時にメンションを送信</span>
            </label>

            <button
              onClick={sendTrainingMessage}
              disabled={!training.testMessage.trim()}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              訓練メッセージを送信
            </button>
          </div>

          {/* 送信済み訓練メッセージ一覧 */}
          {testMessages.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-white font-medium">送信済み訓練メッセージ</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {testMessages.map(msg => (
                  <div key={msg.id} className="bg-gray-700 p-3 rounded border border-gray-600">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-yellow-300 text-sm font-medium">
                          🚧 訓練メッセージ {msg.mentions && "(@メンション付き)"}
                        </div>
                        <div className="text-gray-300 text-sm mt-1">{msg.message}</div>
                        <div className="text-gray-500 text-xs mt-1">
                          送信日時: {msg.sentAt.toLocaleString('ja-JP')}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTestMessage(msg.id)}
                        className="text-red-400 hover:text-red-300 text-sm ml-2"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 p-4 rounded">
            <div className="text-yellow-200 text-sm">
              <strong>⚠️ 注意:</strong> 訓練モードでは実際のSlackチャンネルに「訓練」と明記されたメッセージが送信されます。
              訓練が完了したら、送信されたメッセージを削除することをお勧めします。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}