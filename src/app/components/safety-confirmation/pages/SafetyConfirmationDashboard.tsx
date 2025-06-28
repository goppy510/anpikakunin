"use client";

import { useState, useEffect } from "react";
import cn from "classnames";
import { SafetyConfirmationConfig, DepartmentStamp, DEFAULT_DEPARTMENT_STAMPS } from "../types/SafetyConfirmationTypes";
import { SafetyConfirmationSettings } from "./SafetyConfirmationSettings";
import { Settings } from "../../../lib/db/settings";
import { TrainingScheduleExecutor } from "../utils/trainingScheduler";

interface ActiveAlert {
  id: string;
  earthquake: {
    eventId: string;
    hypocenter?: { name?: string };
    magnitude?: { value?: string };
    maxInt?: string;
    originTime?: string;
    prefectures: string[];
  };
  sentAt: Date;
  responses: Record<string, string[]>; // department.id -> user names
  isTraining?: boolean;
}

export function SafetyConfirmationDashboard() {
  const [config, setConfig] = useState<SafetyConfirmationConfig | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 設定読み込み
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await Settings.get("safetyConfirmationConfig");
        
        if (savedConfig) {
          setConfig(savedConfig);
          setIsSystemActive(savedConfig.isActive);
        } else {
          // デフォルト設定
          const defaultConfig: SafetyConfirmationConfig = {
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
          };
          setConfig(defaultConfig);
          setIsSystemActive(defaultConfig.isActive);
        }
      } catch (error) {
        console.error("設定の読み込みに失敗しました:", error);
        // エラー時はデフォルト設定を使用
        const defaultConfig: SafetyConfirmationConfig = {
          slack: { workspaces: [], channels: [] },
          training: { isEnabled: false, testMessage: "これは訓練メッセージです。", enableMentions: false, mentionTargets: [], scheduledTrainings: [] },
          isActive: false
        };
        setConfig(defaultConfig);
        setIsSystemActive(false);
      }
    };

    loadConfig();

    // 訓練スケジューラーを開始
    const scheduler = TrainingScheduleExecutor.getInstance();
    scheduler.start();

    return () => {
      scheduler.stop();
    };
  }, []);

  const handleSystemToggle = async (active: boolean) => {
    setIsSystemActive(active);
    if (config) {
      const updatedConfig = { ...config, isActive: active };
      setConfig(updatedConfig);
      
      try {
        await Settings.set("safetyConfirmationConfig", updatedConfig);
      } catch (error) {
        console.error("設定の保存に失敗しました:", error);
      }
    }
  };

  const getTotalResponses = (alert: ActiveAlert): number => {
    return Object.values(alert.responses).flat().length;
  };

  const getExpectedResponses = (): number => {
    // TODO: 実際の従業員数を取得
    return 50; // モック値
  };

  const getResponseRate = (alert: ActiveAlert): number => {
    const total = getTotalResponses(alert);
    const expected = getExpectedResponses();
    return Math.round((total / expected) * 100);
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">🚨 安否確認システム</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">システム状態:</span>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSystemActive}
                  onChange={(e) => handleSystemToggle(e.target.checked)}
                  className="mr-2 w-4 h-4"
                />
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  isSystemActive
                    ? "bg-green-900 text-green-300 border border-green-500"
                    : "bg-red-900 text-red-300 border border-red-500"
                )}>
                  {isSystemActive ? "稼働中" : "停止中"}
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              通知先: <span className="text-white">{config.slack.channels.filter(ch => ch.isEnabled).length}チャンネル</span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1 border border-orange-500 rounded bg-orange-900 hover:bg-orange-800 text-orange-300 transition-colors text-sm"
            >
              ⚙️ 安否確認設定
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-6">
        {/* ステータス概要 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-2xl font-bold text-white">{activeAlerts.length}</div>
            <div className="text-sm text-gray-400">進行中のアラート</div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-2xl font-bold text-green-400">
              {activeAlerts.length > 0 ? getResponseRate(activeAlerts[0]) : 0}%
            </div>
            <div className="text-sm text-gray-400">回答率（最新）</div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-2xl font-bold text-blue-400">
              {config.slack.workspaces.reduce((total, ws) => total + ws.departments.length, 0)}
            </div>
            <div className="text-sm text-gray-400">総部署数</div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-2xl font-bold text-purple-400">
              {config.slack.workspaces.reduce((total, ws) => total + ws.conditions.targetPrefectures.length, 0)}
            </div>
            <div className="text-sm text-gray-400">総監視対象都道府県</div>
          </div>
        </div>

        {/* アクティブなアラート */}
        {activeAlerts.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">進行中のアラート</h2>
            {activeAlerts.map(alert => (
              <div key={alert.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {alert.isTraining ? "🚧 訓練" : "🚨"} {alert.earthquake.hypocenter?.name}
                      </h3>
                      {alert.isTraining && (
                        <span className="px-2 py-1 bg-yellow-900 text-yellow-300 text-xs rounded">
                          訓練モード
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>マグニチュード: {alert.earthquake.magnitude?.value || "-"}</div>
                      <div>最大震度: {alert.earthquake.maxInt || "-"}</div>
                      <div>発生時刻: {alert.earthquake.originTime ? new Date(alert.earthquake.originTime).toLocaleString('ja-JP') : "-"}</div>
                      <div>送信日時: {alert.sentAt.toLocaleString('ja-JP')}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {getTotalResponses(alert)}/{getExpectedResponses()}
                    </div>
                    <div className="text-sm text-gray-400">回答済み</div>
                    <div className={cn(
                      "text-lg font-bold",
                      getResponseRate(alert) >= 80 ? "text-green-400" :
                      getResponseRate(alert) >= 50 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {getResponseRate(alert)}%
                    </div>
                  </div>
                </div>

                {/* 部署別回答状況 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {config.slack.workspaces.flatMap(workspace => 
                    workspace.departments.map(dept => {
                      const responses = alert.responses[dept.id] || [];
                      return (
                        <div key={`${workspace.id}-${dept.id}`} className="bg-gray-700 p-4 rounded border border-gray-600">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{dept.emoji}</span>
                            <span className="font-medium text-white">{dept.name}</span>
                            <span className="text-xs text-gray-500">({workspace.name})</span>
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-400">回答数: {responses.length}名</div>
                            {responses.length > 0 && (
                              <div className="mt-1 text-xs text-gray-500">
                                {responses.slice(0, 3).join(", ")}
                                {responses.length > 3 && ` 他${responses.length - 3}名`}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">現在アクティブなアラートはありません</h2>
            <p className="text-gray-400">
              システムは稼働中です。地震発生時に自動で通知が送信されます。
            </p>
          </div>
        )}

        {/* 設定概要 */}
        <div className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">現在の設定</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-300 mb-2">ワークスペース別設定</h3>
              <div className="space-y-2">
                {config.slack.workspaces.length > 0 ? (
                  config.slack.workspaces.map(ws => (
                    <div key={ws.id} className="text-sm text-gray-400">
                      <div className="font-medium text-gray-300">{ws.name || "未設定"}</div>
                      <ul className="ml-4 space-y-1">
                        <li>震度{ws.conditions.minIntensity}以上 / {ws.conditions.targetPrefectures.length}都道府県</li>
                        <li>部署数: {ws.departments.length}件</li>
                        <li>メンション: {ws.conditions.enableMentions ? "有効" : "無効"}</li>
                      </ul>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">ワークスペースが設定されていません</div>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-300 mb-2">システム設定</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>ワークスペース: {config.slack.workspaces.filter(ws => ws.isEnabled).length}件</li>
                <li>チャンネル: {config.slack.channels.filter(ch => ch.isEnabled).length}件</li>
                <li>訓練モード: {config.training.isEnabled ? "有効" : "無効"}</li>
                <li>スケジュール: {config.training.scheduledTrainings.filter(t => t.isActive).length}件</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* 設定モーダル */}
      {showSettings && (
        <SafetyConfirmationSettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}