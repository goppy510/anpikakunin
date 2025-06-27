"use client";

import { useState, useEffect } from "react";
import cn from "classnames";
import { SafetyConfirmationConfig, DepartmentStamp, DEFAULT_DEPARTMENT_STAMPS } from "../types/SafetyConfirmationTypes";
import { SafetyConfirmationSettings } from "./SafetyConfirmationSettings";
import { Settings } from "../../../lib/db/settings";

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
            conditions: {
              minIntensity: 3,
              targetPrefectures: ["13", "14", "12"], // 東京、神奈川、千葉
              enableMentions: false,
              mentionTargets: []
            },
            departments: DEFAULT_DEPARTMENT_STAMPS,
            template: {
              title: "🚨 地震発生通知",
              message: "地震が発生しました。安否確認のため、該当部署のスタンプを押してください。",
              includeEventDetails: true,
              includeMapLink: true,
              customFields: {}
            },
            training: {
              isEnabled: false,
              testMessage: "これは訓練メッセージです。",
              enableMentions: false,
              mentionTargets: []
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
          conditions: { minIntensity: 3, targetPrefectures: [], enableMentions: false, mentionTargets: [] },
          departments: DEFAULT_DEPARTMENT_STAMPS,
          template: { title: "🚨 地震発生通知", message: "地震が発生しました。", includeEventDetails: true, includeMapLink: true, customFields: {} },
          training: { isEnabled: false, testMessage: "これは訓練メッセージです。", enableMentions: false, mentionTargets: [] },
          isActive: false
        };
        setConfig(defaultConfig);
        setIsSystemActive(false);
      }
    };

    loadConfig();
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
            <div className="text-2xl font-bold text-blue-400">{config.departments.length}</div>
            <div className="text-sm text-gray-400">登録部署数</div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="text-2xl font-bold text-purple-400">{config.conditions.targetPrefectures.length}</div>
            <div className="text-sm text-gray-400">監視対象都道府県</div>
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
                  {config.departments.map(dept => {
                    const responses = alert.responses[dept.id] || [];
                    return (
                      <div key={dept.id} className="bg-gray-700 p-4 rounded border border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{dept.emoji}</span>
                          <span className="font-medium text-white">{dept.name}</span>
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
                  })}
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
              <h3 className="font-medium text-gray-300 mb-2">通知条件</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>最小震度: 震度{config.conditions.minIntensity}以上</li>
                <li>対象地域: {config.conditions.targetPrefectures.length}都道府県</li>
                <li>メンション: {config.conditions.enableMentions ? "有効" : "無効"}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-300 mb-2">Slack設定</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>ワークスペース: {config.slack.workspaces.filter(ws => ws.isEnabled).length}件</li>
                <li>チャンネル: {config.slack.channels.filter(ch => ch.isEnabled).length}件</li>
                <li>訓練モード: {config.training.isEnabled ? "有効" : "無効"}</li>
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