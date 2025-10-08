"use client";

import { useState, useEffect } from "react";
import cn from "classnames";
import {
  SafetyConfirmationConfig,
  SlackNotificationSettings,
  TrainingMode,
  DepartmentStamp,
  NotificationTemplate,
  NotificationConditions,
  DEFAULT_DEPARTMENT_STAMPS,
  DEFAULT_NOTIFICATION_TEMPLATE,
  JAPANESE_PREFECTURES,
} from "../types/SafetyConfirmationTypes";
import { SlackMultiChannelSettings } from "../components/SlackMultiChannelSettings";
import { TrainingScheduler } from "../components/TrainingScheduler";
import { SetupTab } from "../components/SetupTab";
import { NotificationConditionsSettings } from "../components/NotificationConditionsSettings";
import { Settings } from "../../../lib/db/settings";
import { TrainingScheduleExecutor } from "../utils/trainingScheduler";
import { SafetySettingsDatabase } from "../utils/settingsDatabase";
// EarthquakeNotificationService は動的インポートで読み込み

export function SafetyConfirmationDashboard() {
  const [config, setConfig] = useState<SafetyConfirmationConfig>({
    slack: {
      workspaces: [],
      channels: [],
    },
    training: {
      isEnabled: true,
      testMessage: "これは地震対応訓練です。実際の地震ではありません。",
      enableMentions: false,
      mentionTargets: [],
      scheduledTrainings: [],
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "slack" | "departments" | "conditions" | "message" | "training" | "setup"
  >("slack");

  // 設定読み込み
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);

        // まずIndexedDBから読み込み
        const dbConfig = await SafetySettingsDatabase.loadSettings();
        if (dbConfig) {
          setConfig(dbConfig);
          return;
        }

        // IndexedDBにない場合は従来のLocalStorageから読み込み
        const savedConfig = await Settings.get("safetyConfirmationConfig");
        if (savedConfig) {
          setConfig(savedConfig);
        } else {
        }
      } catch (error) {
        console.error("設定の読み込みに失敗しました:", error);
      } finally {
        setIsLoading(false);
        
        // 地震通知サービスの設定を更新（動的インポート）
        import("../utils/earthquakeNotificationService").then(({ EarthquakeNotificationService }) => {
          const notificationService = EarthquakeNotificationService.getInstance();
          notificationService.loadConfig().catch(error => {
            console.error("地震通知サービスの初期化に失敗:", error);
          });
        }).catch(error => {
          console.error("地震通知サービスの動的読み込みに失敗:", error);
        });
      }
    };

    loadConfig();
  }, []);

  const updateSlack = (updates: Partial<SlackNotificationSettings>) => {
    setConfig((prev) => ({
      ...prev,
      slack: { ...prev.slack, ...updates },
    }));
  };

  // Slack設定の自動保存（初期読み込み完了後のみ）
  useEffect(() => {
    if (isLoading) return; // 初期読み込み中は保存しない

    const saveSlackConfig = async () => {
      try {
        await SafetySettingsDatabase.saveSettings(config);
        await Settings.set("safetyConfirmationConfig", config);
        
        // 地震通知サービスの設定を更新（動的インポート）
        import("../utils/earthquakeNotificationService").then(({ EarthquakeNotificationService }) => {
          const notificationService = EarthquakeNotificationService.getInstance();
          notificationService.loadConfig().catch(error => {
            console.error("地震通知サービスの設定更新に失敗:", error);
          });
        }).catch(error => {
          console.error("地震通知サービスの動的読み込みに失敗:", error);
        });
      } catch (error) {
        console.error("Slack設定の自動保存に失敗:", error);
      }
    };

    saveSlackConfig();
  }, [config.slack, isLoading]);

  const updateTraining = (updates: Partial<TrainingMode>) => {
    setConfig((prev) => ({
      ...prev,
      training: { ...prev.training, ...updates },
    }));
  };

  const handleSave = async () => {
    try {
      // IndexedDBに保存
      await SafetySettingsDatabase.saveSettings(config);

      // 下位互換性のためLocalStorageにも保存
      await Settings.set("safetyConfirmationConfig", config);

      alert("設定を保存しました");
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
      alert("設定の保存に失敗しました");
    }
  };

  // デバッグ用：設定状況を確認
  const debugSettings = async () => {
    try {
      console.log("=== デバッグ: 現在の設定状況 ===");
      console.log("React State:", config);

      const dbConfig = await SafetySettingsDatabase.loadSettings();
      console.log("IndexedDB:", dbConfig);

      const lsConfig = await Settings.get("safetyConfirmationConfig");
      console.log("LocalStorage:", lsConfig);

      const info = await SafetySettingsDatabase.getSettingsInfo();
      console.log("設定統計:", info);

      alert("デバッグ情報をコンソールに出力しました");
    } catch (error) {
      console.error("デバッグエラー:", error);
    }
  };

  const sendTestNotification = async () => {
    try {
      // 詳細な設定確認
      const enabledWorkspaces = config.slack.workspaces.filter(
        (ws) => ws.isEnabled
      );
      if (enabledWorkspaces.length === 0) {
        alert(
          "有効なワークスペースがありません。Slack設定タブでワークスペースを設定し、有効化してください。"
        );
        return;
      }

      // Bot Tokenの確認
      const workspacesWithToken = enabledWorkspaces.filter(
        (ws) => ws.botToken && ws.botToken.trim() !== ""
      );
      if (workspacesWithToken.length === 0) {
        alert(
          "Bot Tokenが設定されていません。Slack設定タブでBot Tokenを設定してください。"
        );
        return;
      }

      // 訓練用チャンネルの確認
      const trainingChannels = config.slack.channels.filter(
        (ch) => ch.channelType === "training"
      );
      if (trainingChannels.length === 0) {
        alert(
          "訓練用チャンネルが設定されていません。Slack設定タブで訓練用チャンネルを追加してください。"
        );
        return;
      }

      // チャンネルIDの確認
      const channelsWithId = trainingChannels.filter(
        (ch) => ch.channelId && ch.channelId.trim() !== ""
      );
      if (channelsWithId.length === 0) {
        alert(
          "訓練用チャンネルのチャンネルIDが設定されていません。Slack設定タブでチャンネルIDを設定してください。"
        );
        return;
      }

      // 訓練メッセージの確認
      if (
        !config.training.testMessage ||
        config.training.testMessage.trim() === ""
      ) {
        alert(
          "訓練メッセージが設定されていません。訓練モードタブで訓練メッセージを入力してください。"
        );
        return;
      }

      const scheduler = TrainingScheduleExecutor.getInstance();
      await scheduler.executeImmediateTraining(config.training.testMessage);
      alert("✅ テスト通知を訓練用チャンネルに送信しました！");
    } catch (error) {
      console.error("テスト通知送信エラー:", error);
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";

      let userMessage = `❌ テスト通知の送信に失敗しました: ${errorMessage}`;

      // エラーメッセージに応じて解決方法を追加
      if (errorMessage.includes("botToken、channelId、messageは必須です")) {
        userMessage +=
          "\n\n📝 解決方法:\n1. Slack設定タブでBot Tokenが正しく設定されているか確認\n2. 訓練用チャンネルのチャンネルIDが正しく設定されているか確認\n3. 訓練モードタブで訓練メッセージが入力されているか確認";
      } else if (errorMessage.includes("チャンネルが見つかりません")) {
        userMessage +=
          "\n\n📝 解決方法:\n1. チャンネルIDが正しいか確認してください\n2. プライベートチャンネルの場合はボットをチャンネルに招待してください\n3. チャンネル設定でチャンネルIDを再確認してください";
      } else if (
        errorMessage.includes("ボットがチャンネルに招待されていません")
      ) {
        userMessage +=
          '\n\n📝 解決方法:\n1. Slackチャンネルで "/invite @ボット名" を実行\n2. チャンネルのメンバー一覧にボットが表示されることを確認';
      } else if (errorMessage.includes("必要な権限がありません")) {
        userMessage +=
          '\n\n📝 解決方法:\n1. Slackアプリ設定で "chat:write" スコープを追加\n2. ワークスペースにアプリを再インストール\n3. 新しいBot Tokenで接続確認を実行';
      }

      alert(userMessage);
    }
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">設定を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">
              安否確認システム設定
            </h1>
            <p className="text-gray-400 mt-2">
              Slack連携による安否確認システムの設定と管理
            </p>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-gray-700 mb-8">
          {[
            { key: "slack", label: "Slack設定" },
            { key: "departments", label: "部署設定" },
            { key: "conditions", label: "通知条件" },
            { key: "message", label: "メッセージ設定" },
            { key: "training", label: "訓練モード" },
            { key: "setup", label: "集計設定" },
          ].map((tab) => {
            // Slack設定が完了しているかチェック
            const hasSlackConfig =
              config?.slack?.workspaces &&
              config.slack.workspaces.length > 0 &&
              config.slack.workspaces[0]?.botToken;
            const isDisabled = tab.key !== "slack" && !hasSlackConfig;

            return (
              <button
                key={tab.key}
                onClick={() => !isDisabled && setActiveTab(tab.key as typeof activeTab)}
                disabled={isDisabled}
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-colors border-b-2",
                  activeTab === tab.key
                    ? "text-blue-400 border-blue-400"
                    : isDisabled
                    ? "text-gray-600 border-transparent cursor-not-allowed"
                    : "text-gray-400 border-transparent hover:text-white hover:border-gray-600"
                )}
                title={isDisabled ? "まずSlack設定を完了してください" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* タブコンテンツ */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {activeTab === "slack" && (
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">
                Slack ワークスペース・チャンネル設定
              </h3>
              {config?.slack ? (
                <SlackMultiChannelSettings
                  settings={config.slack}
                  onUpdate={updateSlack}
                  currentConfig={config}
                />
              ) : (
                <div className="text-gray-400">設定を読み込み中...</div>
              )}
            </div>
          )}

          {activeTab === "departments" && (
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">部署スタンプ設定</h3>
              <DepartmentSettings config={config} onUpdate={setConfig} />
            </div>
          )}

          {activeTab === "conditions" && (
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">通知条件設定</h3>
              <NotificationConditionsSettings config={config} onUpdate={setConfig} />
            </div>
          )}

          {activeTab === "message" && (
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">メッセージ設定</h3>
              <MessageTemplateSettings
                config={config}
                onUpdate={setConfig}
                onTestSend={sendTestNotification}
              />
            </div>
          )}

          {activeTab === "training" && (
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">訓練スケジュール</h3>
              {config?.training ? (
                <TrainingScheduler
                  config={config.training}
                  onUpdate={updateTraining}
                  currentConfig={config}
                  onTestSend={sendTestNotification}
                />
              ) : (
                <div className="text-gray-400">設定を読み込み中...</div>
              )}
            </div>
          )}

          {activeTab === "setup" && (
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">
                Google Apps Script設定
              </h3>
              <SetupTab />
            </div>
          )}
        </div>

        {/* デバッグボタン */}
        <div className="flex justify-end items-center mt-8">
          <button
            onClick={debugSettings}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            デバッグ
          </button>
        </div>
      </div>
    </div>
  );
}

// 部署設定コンポーネント
function DepartmentSettings({
  config,
  onUpdate,
}: {
  config: SafetyConfirmationConfig;
  onUpdate: (config: SafetyConfirmationConfig) => void;
}) {
  const [availableEmojis, setAvailableEmojis] = useState<{
    [key: string]: string;
  }>({});
  const [emojiSearchTerms, setEmojiSearchTerms] = useState<{
    [deptId: string]: string;
  }>({});

  // 初期読み込み時に保存されている絵文字情報を設定
  useEffect(() => {
    const currentWs = config.slack.workspaces[0];
    if (currentWs?.availableEmojis && currentWs.availableEmojis.length > 0) {
      const emojiMap: { [key: string]: string } = {};
      currentWs.availableEmojis.forEach((emoji) => {
        emojiMap[emoji.name] = emoji.url;
      });
      setAvailableEmojis(emojiMap);
    }
  }, [config.slack.workspaces]);

  const getCurrentWorkspace = () => {
    const workspace = config.slack.workspaces[0] || {
      id: "default",
      name: "デフォルト",
      botToken: "",
      isEnabled: true,
      departments: [...DEFAULT_DEPARTMENT_STAMPS],
      template: { ...DEFAULT_NOTIFICATION_TEMPLATE },
      conditions: {
        minIntensity: 3,
        targetPrefectures: [],
        enableMentions: false,
        mentionTargets: [],
        notificationType: "comprehensive",
      },
    };

    // 古いデータ形式（emoji）から新しい形式（slackEmoji）への変換
    if (workspace.departments) {
      workspace.departments = workspace.departments.map((dept) => {
        // 古い形式のemojiフィールドが存在し、slackEmojiがない場合は変換
        if ((dept as any).emoji && !dept.slackEmoji) {
          return {
            ...dept,
            slackEmoji: { name: (dept as any).emoji, url: "" },
          };
        }
        // slackEmojiフィールドが存在しない場合はデフォルトを設定
        if (!dept.slackEmoji) {
          return {
            ...dept,
            slackEmoji: { name: "dept", url: "" },
          };
        }
        return dept;
      });
    }

    return workspace;
  };

  const updateWorkspaceDepartments = (departments: DepartmentStamp[]) => {
    const currentWs = getCurrentWorkspace();
    const updatedWorkspaces =
      config.slack.workspaces.length > 0
        ? config.slack.workspaces.map((ws) =>
            ws.id === currentWs.id ? { ...ws, departments } : ws
          )
        : [{ ...currentWs, departments }];

    onUpdate({
      ...config,
      slack: {
        ...config.slack,
        workspaces: updatedWorkspaces,
      },
    });
  };

  const addDepartment = () => {
    const currentWs = getCurrentWorkspace();
    const newDept: DepartmentStamp = {
      id: `dept_${Date.now()}`,
      name: "新しい部署",
      slackEmoji: { name: "new_dept", url: "" },
      color: "#3B82F6",
    };
    updateWorkspaceDepartments([...currentWs.departments, newDept]);
  };

  const updateDepartment = (id: string, updates: Partial<DepartmentStamp>) => {
    const currentWs = getCurrentWorkspace();
    const updatedDepts = currentWs.departments.map((dept) =>
      dept.id === id ? { ...dept, ...updates } : dept
    );
    updateWorkspaceDepartments(updatedDepts);
  };

  const removeDepartment = (id: string) => {
    const currentWs = getCurrentWorkspace();
    const updatedDepts = currentWs.departments.filter((dept) => dept.id !== id);
    updateWorkspaceDepartments(updatedDepts);
  };

  // Slackの絵文字一覧を取得
  const fetchSlackEmojis = async () => {
    const currentWs = getCurrentWorkspace();
    if (!currentWs.botToken) {
      alert("Bot Tokenが設定されていません。Slack設定タブで設定してください。");
      return;
    }

    try {
      const response = await fetch("https://slack.com/api/emoji.list", {
        headers: {
          Authorization: `Bearer ${currentWs.botToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.ok) {
        setAvailableEmojis(data.emoji);

        // 現在のワークスペースのavailableEmojisも更新
        const updatedWorkspaces = config.slack.workspaces.map((ws) =>
          ws.id === currentWs.id
            ? {
                ...ws,
                availableEmojis: Object.entries(data.emoji).map(
                  ([name, url]) => ({ name, url })
                ),
              }
            : ws
        );

        onUpdate({
          ...config,
          slack: {
            ...config.slack,
            workspaces: updatedWorkspaces,
          },
        });

        alert(
          `${Object.keys(data.emoji).length}個のカスタム絵文字を取得しました`
        );
      } else {
        console.error("Slack API error:", data.error);
        alert(`絵文字取得に失敗: ${data.error}`);
      }
    } catch (error) {
      console.error("絵文字取得エラー:", error);
      alert("絵文字取得に失敗しました");
    }
  };

  const currentWorkspace = getCurrentWorkspace();

  // 特定の部署用の絵文字をフィルタリングする関数
  const getFilteredEmojis = (deptId: string) => {
    const searchTerm = emojiSearchTerms[deptId] || "";
    if (!searchTerm.trim()) {
      return Object.entries(availableEmojis);
    }
    return Object.entries(availableEmojis).filter(([name]) =>
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // 部署の検索テキストを更新
  const updateSearchTerm = (deptId: string, term: string) => {
    setEmojiSearchTerms((prev) => ({
      ...prev,
      [deptId]: term,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-400">
          安否確認時に表示される部署スタンプを設定します（Slackカスタムスタンプ使用）
        </p>
        <div className="flex gap-2">
          <button
            onClick={fetchSlackEmojis}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            絵文字取得
          </button>
          <button
            onClick={addDepartment}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + 部署を追加
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentWorkspace.departments.map((dept) => {
          // 安全性チェック: slackEmojiが存在しない場合はデフォルト値を設定
          const safeSlackEmoji = dept.slackEmoji || { name: "dept", url: "" };

          return (
            <div
              key={dept.id}
              className="bg-gray-700 p-4 rounded border border-gray-600"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                  {safeSlackEmoji.url ? (
                    <img
                      src={safeSlackEmoji.url}
                      alt={safeSlackEmoji.name}
                      className="w-6 h-6"
                    />
                  ) : (
                    <span className="text-sm">:{safeSlackEmoji.name}:</span>
                  )}
                </div>
                <input
                  type="text"
                  value={dept.name}
                  onChange={(e) =>
                    updateDepartment(dept.id, { name: e.target.value })
                  }
                  className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  placeholder="部署名"
                />
                <button
                  onClick={() => removeDepartment(dept.id)}
                  className="text-red-400 hover:text-red-300 px-2 py-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Slackカスタムスタンプ
                  </label>
                  {Object.keys(availableEmojis).length > 0 ? (
                    <div className="space-y-2">
                      {/* 検索ボックス */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="絵文字を検索... (例: soumu, eigyou)"
                          value={emojiSearchTerms[dept.id] || ""}
                          onChange={(e) =>
                            updateSearchTerm(dept.id, e.target.value)
                          }
                          className="w-full px-3 py-2 pl-8 bg-gray-600 border border-gray-500 rounded text-white text-sm placeholder-gray-400"
                        />
                        <div className="absolute left-2 top-2.5">
                          <span className="text-gray-400 text-sm">🔍</span>
                        </div>
                        {emojiSearchTerms[dept.id] && (
                          <button
                            type="button"
                            onClick={() => updateSearchTerm(dept.id, "")}
                            className="absolute right-2 top-2.5 text-gray-400 hover:text-white"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* 絵文字グリッド */}
                      <div className="grid grid-cols-8 gap-2 p-3 bg-gray-600 rounded max-h-40 overflow-y-auto border border-gray-500">
                        {getFilteredEmojis(dept.id).map(([name, url]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() =>
                              updateDepartment(dept.id, {
                                slackEmoji: { name, url },
                              })
                            }
                            className={`w-10 h-10 rounded hover:bg-gray-500 flex items-center justify-center transition-colors ${
                              safeSlackEmoji.name === name
                                ? "bg-blue-500 ring-2 ring-blue-300"
                                : ""
                            }`}
                            title={`:${name}:`}
                          >
                            <img src={url} alt={name} className="w-7 h-7" />
                          </button>
                        ))}
                      </div>

                      {/* 検索結果の件数表示 */}
                      <div className="text-xs text-gray-400 text-center">
                        {emojiSearchTerms[dept.id]
                          ? `${
                              getFilteredEmojis(dept.id).length
                            }件の絵文字が見つかりました`
                          : `${
                              Object.keys(availableEmojis).length
                            }個の絵文字が利用可能`}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 text-sm border border-gray-500 rounded bg-gray-600">
                      「絵文字取得」ボタンでSlackのカスタムスタンプを取得してください
                    </div>
                  )}
                  {safeSlackEmoji.name && (
                    <p className="text-xs text-gray-500 mt-1">
                      選択中: :{safeSlackEmoji.name}:
                      {safeSlackEmoji.url && (
                        <span className="text-green-400 ml-2">
                          ✓ URL取得済み
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    ボタンの色
                  </label>
                  <input
                    type="color"
                    value={dept.color}
                    onChange={(e) =>
                      updateDepartment(dept.id, { color: e.target.value })
                    }
                    className="w-full h-10 bg-gray-600 border border-gray-500 rounded"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {currentWorkspace.departments.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          部署スタンプが設定されていません。
          <br />
          「+ 部署を追加」ボタンから追加してください。
        </div>
      )}
    </div>
  );
}

// メッセージテンプレート設定コンポーネント
function MessageTemplateSettings({
  config,
  onUpdate,
  onTestSend,
}: {
  config: SafetyConfirmationConfig;
  onUpdate: (config: SafetyConfirmationConfig) => void;
  onTestSend: () => void;
}) {
  const getCurrentWorkspace = () => {
    return (
      config.slack.workspaces[0] || {
        id: "default",
        name: "デフォルト",
        botToken: "",
        isEnabled: true,
        departments: [...DEFAULT_DEPARTMENT_STAMPS],
        template: { ...DEFAULT_NOTIFICATION_TEMPLATE },
        conditions: {
          minIntensity: 3,
          targetPrefectures: [],
          enableMentions: false,
          mentionTargets: [],
          notificationType: "comprehensive",
        },
      }
    );
  };

  const updateTemplate = async (updates: Partial<NotificationTemplate>) => {
    const currentWs = getCurrentWorkspace();
    const updatedTemplate = { ...currentWs.template, ...updates };
    const updatedWorkspaces =
      config.slack.workspaces.length > 0
        ? config.slack.workspaces.map((ws) =>
            ws.id === currentWs.id ? { ...ws, template: updatedTemplate } : ws
          )
        : [{ ...currentWs, template: updatedTemplate }];

    const newConfig = {
      ...config,
      slack: {
        ...config.slack,
        workspaces: updatedWorkspaces,
      },
    };

    onUpdate(newConfig);

    // 自動保存
    try {
      await SafetySettingsDatabase.saveSettings(newConfig);
      await Settings.set("safetyConfirmationConfig", newConfig);
    } catch (error) {
      console.error("テンプレート設定の自動保存に失敗:", error);
    }
  };

  const updateTraining = async (updates: Partial<TrainingMode>) => {
    const newConfig = {
      ...config,
      training: { ...config.training, ...updates },
    };

    onUpdate(newConfig);

    // 自動保存
    try {
      await SafetySettingsDatabase.saveSettings(newConfig);
      await Settings.set("safetyConfirmationConfig", newConfig);
    } catch (error) {
      console.error("訓練設定の自動保存に失敗:", error);
    }
  };

  const currentWorkspace = getCurrentWorkspace();

  // Slackの一般的な絵文字マッピング
  const slackEmojiMap: { [key: string]: string } = {
    ":sos:": "🆘",
    ":warning:": "⚠️",
    ":exclamation:": "❗",
    ":bangbang:": "‼️",
    ":fire:": "🔥",
    ":rotating_light:": "🚨",
    ":ambulance:": "🚑",
    ":hospital:": "🏥",
    ":office:": "🏢",
    ":building_construction:": "🏗️",
    ":house:": "🏠",
    ":family:": "👪",
    ":point_right:": "👉",
    ":point_left:": "👈",
    ":point_up:": "👆",
    ":point_down:": "👇",
    ":ok:": "🆗",
    ":ng:": "🆖",
    ":red_circle:": "🔴",
    ":green_heart:": "💚",
    ":blue_heart:": "💙",
    ":yellow_heart:": "💛",
    ":heart:": "❤️",
    ":white_check_mark:": "✅",
    ":x:": "❌",
    ":heavy_check_mark:": "✔️",
    ":clock1:": "🕐",
    ":clock2:": "🕑",
    ":clock3:": "🕒",
    ":clock4:": "🕓",
    ":clock5:": "🕔",
    ":clock6:": "🕕",
    ":telephone_receiver:": "📞",
    ":mobile_phone:": "📱",
    ":email:": "📧",
    ":mailbox:": "📫",
    ":loudspeaker:": "📢",
    ":mega:": "📣",
    ":speaker:": "🔊",
    ":earth_asia:": "🌏",
    ":earth_americas:": "🌎",
    ":earth_africa:": "🌍",
    ":zap:": "⚡",
    ":boom:": "💥",
    ":dizzy:": "💫",
    ":sweat_drops:": "💦",
    ":droplet:": "💧",
    ":umbrella:": "☂️",
    ":sunny:": "☀️",
    ":cloud:": "☁️",
    ":thunder_cloud_and_rain:": "⛈️",
    ":snowflake:": "❄️",
    ":information_source:": "ℹ️",
    ":question:": "❓",
    ":grey_question:": "❔",
    ":grey_exclamation:": "❕",
    ":heavy_plus_sign:": "➕",
    ":heavy_minus_sign:": "➖",
    ":heavy_multiplication_x:": "✖️",
    ":heavy_division_sign:": "➗",
  };

  // Slackのマークダウンを簡易的にHTMLに変換
  const formatSlackMarkdown = (text: string) => {
    let result = text;

    // Slackの絵文字記法を実際の絵文字に変換
    result = result.replace(/:([a-zA-Z0-9_+-]+):/g, (match, emojiName) => {
      return slackEmojiMap[match] || match;
    });

    // Slackの実際の記法に合わせる
    result = result.replace(/\*(.*?)\*/g, "<strong>$1</strong>"); // *bold* (Slack標準)
    result = result.replace(/_([^_]+?)_/g, "<em>$1</em>"); // _italic_
    result = result.replace(/`(.*?)`/g, "<code>$1</code>"); // `code`
    result = result.replace(/~(.*?)~/g, "<del>$1</del>"); // ~strikethrough~
    result = result.replace(/\n/g, "<br>"); // 改行

    return result;
  };

  return (
    <div className="space-y-6">
      {/* 通知テンプレート設定 */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-white">通知テンプレート</h4>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            タイトル
          </label>
          <input
            type="text"
            value={currentWorkspace.template.title}
            onChange={(e) => updateTemplate({ title: e.target.value })}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
            placeholder="🚨 地震発生通知"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            メッセージ本文
          </label>
          <textarea
            value={currentWorkspace.template.message}
            onChange={(e) => updateTemplate({ message: e.target.value })}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
            rows={3}
            placeholder="地震が発生しました。安否確認のため、該当部署のスタンプを押してください。"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentWorkspace.template.includeEventDetails}
              onChange={(e) =>
                updateTemplate({ includeEventDetails: e.target.checked })
              }
              className="mr-2 w-4 h-4"
            />
            <span className="text-gray-300 text-sm">地震詳細情報を含める</span>
          </label>

          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentWorkspace.template.includeMapLink}
              onChange={(e) =>
                updateTemplate({ includeMapLink: e.target.checked })
              }
              className="mr-2 w-4 h-4"
            />
            <span className="text-gray-300 text-sm">
              震源地マップリンクを含める
            </span>
          </label>
        </div>
      </div>

      {/* 本番メッセージプレビュー */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-white">
          本番メッセージプレビュー
        </h4>

        <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
          {/* Slackチャンネルヘッダー */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">#</span>
              <span className="font-semibold text-gray-900">安否確認</span>
              <span className="text-gray-500 text-sm ml-auto">プレビュー</span>
            </div>
          </div>

          {/* Slackメッセージ */}
          <div className="p-4">
            <div className="flex gap-3">
              {/* ボットアバター */}
              <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">🤖</span>
              </div>

              <div className="flex-1">
                {/* ボット名と時刻 */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-gray-900">
                    安否確認Bot
                  </span>
                  <span className="text-xs text-gray-500">今</span>
                </div>

                {/* メッセージ内容 */}
                <div className="text-gray-900 mb-3">
                  <div
                    className="font-semibold mb-2 prose prose-sm max-w-none [&_strong]:font-bold [&_em]:italic [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-red-600 [&_code]:text-sm [&_del]:line-through [&_del]:text-gray-500"
                    dangerouslySetInnerHTML={{
                      __html: formatSlackMarkdown(
                        currentWorkspace.template.title
                      ),
                    }}
                  />
                  <div
                    className="whitespace-pre-wrap prose prose-sm max-w-none [&_strong]:font-bold [&_strong]:text-gray-900 [&_em]:italic [&_em]:text-gray-900 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-red-600 [&_code]:text-sm [&_code]:font-mono [&_del]:line-through [&_del]:text-gray-500"
                    dangerouslySetInnerHTML={{
                      __html: formatSlackMarkdown(
                        currentWorkspace.template.message
                      ),
                    }}
                  />

                  {currentWorkspace.template.includeEventDetails && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-orange-400">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          📍 震源地: 東京都23区
                        </div>
                        <div className="text-gray-700">📊 最大震度: 5弱</div>
                        <div className="text-gray-700">
                          🕒 発生時刻: 2024年1月1日 12:00
                        </div>
                      </div>
                    </div>
                  )}

                  {currentWorkspace.template.includeMapLink && (
                    <div className="mt-2">
                      <a href="#" className="text-blue-600 hover:underline">
                        🗺️ 震源地マップを見る
                      </a>
                    </div>
                  )}
                </div>

                {/* 部署選択ボタン */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    あなたの所属部署を選択してください:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {currentWorkspace.departments.slice(0, 6).map((dept) => {
                      const safeSlackEmoji = dept.slackEmoji || {
                        name: "dept",
                        url: "",
                      };
                      return (
                        <button
                          key={dept.id}
                          className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                          disabled
                        >
                          <span className="text-gray-900">
                            {safeSlackEmoji.url ? (
                              <>
                                <img
                                  src={safeSlackEmoji.url}
                                  alt={safeSlackEmoji.name}
                                  className="w-4 h-4 inline mr-1"
                                />
                                {dept.name}
                              </>
                            ) : (
                              <span>
                                :{safeSlackEmoji.name}: {dept.name}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
