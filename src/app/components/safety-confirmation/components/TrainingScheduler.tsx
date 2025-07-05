"use client";

import { useState } from "react";
import cn from "classnames";
import { TrainingMode, ScheduledTraining } from "../types/SafetyConfirmationTypes";

interface TrainingSchedulerProps {
  config: TrainingMode;
  onUpdate: (updates: Partial<TrainingMode>) => void;
  currentConfig: any; // 部署情報を取得するため
  onTestSend?: () => void; // テスト送信機能
}

export function TrainingScheduler({ 
  config, 
  onUpdate,
  currentConfig,
  onTestSend
}: TrainingSchedulerProps) {
  // 安全性チェック
  if (!config) {
    return <div className="text-gray-400">設定を読み込み中...</div>;
  }

  // デフォルト値を設定
  const safeConfig = {
    scheduledTrainings: [],
    ...config
  };
  const [showAddForm, setShowAddForm] = useState(false);

  // 現在のワークスペースから部署情報を取得
  const getCurrentWorkspace = () => {
    const workspace = currentConfig?.slack?.workspaces?.[0] || {
      departments: []
    };
    console.log('TrainingScheduler - currentConfig:', currentConfig);
    console.log('TrainingScheduler - workspace:', workspace);
    console.log('TrainingScheduler - departments:', workspace.departments);
    return workspace;
  };

  const addScheduledTraining = () => {
    const newTraining: ScheduledTraining = {
      id: `training_${Date.now()}`,
      workspaceId: undefined, // 全体向け
      scheduledTime: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
      message: "これは定期訓練です。安否確認の練習を行ってください。",
      enableMentions: false,
      mentionTargets: [],
      isRecurring: false,
      isActive: true
    };

    onUpdate({
      scheduledTrainings: [...safeConfig.scheduledTrainings, newTraining]
    });
    setShowAddForm(false);
  };

  const updateTraining = (id: string, updates: Partial<ScheduledTraining>) => {
    onUpdate({
      scheduledTrainings: safeConfig.scheduledTrainings.map(training => 
        training.id === id ? { ...training, ...updates } : training
      )
    });
  };

  const removeTraining = (id: string) => {
    onUpdate({
      scheduledTrainings: safeConfig.scheduledTrainings.filter(training => training.id !== id)
    });
  };

  const getWorkspaceName = (workspaceId?: string): string => {
    if (!workspaceId) return "全ワークスペース";
    return `ワークスペース ${workspaceId}`;
  };

  const formatDateTime = (date: Date): string => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const isTrainingPast = (scheduledTime: Date): boolean => {
    return scheduledTime < new Date();
  };

  const getNextExecutionTime = (training: ScheduledTraining): Date | null => {
    if (!training.isRecurring || !training.recurringPattern) {
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
      }
    }

    return nextTime;
  };

  // Slackの一般的な絵文字マッピング
  const slackEmojiMap: { [key: string]: string } = {
    ':sos:': '🆘',
    ':warning:': '⚠️',
    ':exclamation:': '❗',
    ':bangbang:': '‼️',
    ':fire:': '🔥',
    ':rotating_light:': '🚨',
    ':ambulance:': '🚑',
    ':hospital:': '🏥',
    ':office:': '🏢',
    ':building_construction:': '🏗️',
    ':house:': '🏠',
    ':family:': '👪',
    ':point_right:': '👉',
    ':point_left:': '👈',
    ':point_up:': '👆',
    ':point_down:': '👇',
    ':ok:': '🆗',
    ':ng:': '🆖',
    ':red_circle:': '🔴',
    ':green_heart:': '💚',
    ':blue_heart:': '💙',
    ':yellow_heart:': '💛',
    ':heart:': '❤️',
    ':white_check_mark:': '✅',
    ':x:': '❌',
    ':heavy_check_mark:': '✔️',
    ':clock1:': '🕐',
    ':clock2:': '🕑',
    ':clock3:': '🕒',
    ':clock4:': '🕓',
    ':clock5:': '🕔',
    ':clock6:': '🕕',
    ':telephone_receiver:': '📞',
    ':mobile_phone:': '📱',
    ':email:': '📧',
    ':mailbox:': '📫',
    ':loudspeaker:': '📢',
    ':mega:': '📣',
    ':speaker:': '🔊',
    ':earth_asia:': '🌏',
    ':earth_americas:': '🌎',
    ':earth_africa:': '🌍',
    ':zap:': '⚡',
    ':boom:': '💥',
    ':dizzy:': '💫',
    ':sweat_drops:': '💦',
    ':droplet:': '💧',
    ':umbrella:': '☂️',
    ':sunny:': '☀️',
    ':cloud:': '☁️',
    ':thunder_cloud_and_rain:': '⛈️',
    ':snowflake:': '❄️',
    ':information_source:': 'ℹ️',
    ':question:': '❓',
    ':grey_question:': '❔',
    ':grey_exclamation:': '❕',
    ':heavy_plus_sign:': '➕',
    ':heavy_minus_sign:': '➖',
    ':heavy_multiplication_x:': '✖️',
    ':heavy_division_sign:': '➗'
  };

  // Slackのマークダウンを簡易的にHTMLに変換
  const formatSlackMarkdown = (text: string) => {
    let result = text;
    
    // Slackの絵文字記法を実際の絵文字に変換
    result = result.replace(/:([a-zA-Z0-9_+-]+):/g, (match, emojiName) => {
      return slackEmojiMap[match] || match;
    });
    
    // Slackの実際の記法に合わせる
    result = result.replace(/\*(.*?)\*/g, '<strong>$1</strong>');      // *bold* (Slack標準)
    result = result.replace(/_([^_]+?)_/g, '<em>$1</em>');             // _italic_
    result = result.replace(/`(.*?)`/g, '<code>$1</code>');            // `code`
    result = result.replace(/~(.*?)~/g, '<del>$1</del>');              // ~strikethrough~
    result = result.replace(/\n/g, '<br>');                           // 改行
    
    return result;
  };

  return (
    <div className="space-y-6">
      {/* 訓練メッセージ設定 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">訓練メッセージ設定</h3>
          <button
            onClick={onTestSend}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
          >
            🎓 即座にテスト送信
          </button>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            訓練用メッセージ
          </label>
          <textarea
            value={safeConfig.testMessage}
            onChange={(e) => onUpdate({ testMessage: e.target.value })}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
            rows={3}
            placeholder="これは地震対応訓練です。実際の地震ではありません。"
          />
          <p className="text-gray-400 text-sm mt-1">
            地震訓練時に送信されるメッセージです
          </p>
        </div>

        {/* 訓練メッセージプレビュー */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-white">訓練メッセージプレビュー</h4>
          
          <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
            {/* Slackチャンネルヘッダー */}
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">#</span>
                <span className="font-semibold text-gray-900">訓練用-安否確認</span>
                <span className="text-gray-500 text-sm ml-auto">プレビュー</span>
              </div>
            </div>
            
            {/* Slackメッセージ */}
            <div className="p-4">
              <div className="flex gap-3">
                {/* ボットアバター */}
                <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">🎓</span>
                </div>
                
                <div className="flex-1">
                  {/* ボット名と時刻 */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-gray-900">訓練Bot</span>
                    <span className="text-xs text-gray-500">今</span>
                  </div>
                  
                  {/* メッセージ内容 */}
                  <div className="text-gray-900 mb-3">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-3">
                      <div className="font-semibold text-yellow-800 mb-1">🎓 【訓練です】</div>
                    </div>
                    
                    <div 
                      className="whitespace-pre-wrap prose prose-sm max-w-none [&_strong]:font-bold [&_strong]:text-gray-900 [&_em]:italic [&_em]:text-gray-900 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-red-600 [&_code]:text-sm [&_code]:font-mono [&_del]:line-through [&_del]:text-gray-500"
                      dangerouslySetInnerHTML={{ __html: formatSlackMarkdown(safeConfig.testMessage) }}
                    />
                    
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3">
                      <div className="font-semibold text-yellow-800">🎓 【訓練です】</div>
                    </div>
                  </div>
                  
                  {/* 部署選択ボタン */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700 mb-2">あなたの所属部署を選択してください:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {getCurrentWorkspace().departments.slice(0, 6).map(dept => {
                        const safeSlackEmoji = dept.slackEmoji || { name: 'dept', url: '' };
                        return (
                          <button
                            key={dept.id}
                            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                            disabled
                          >
                            <span className="text-gray-900">
                              {safeSlackEmoji.url ? (
                                <>
                                  <img src={safeSlackEmoji.url} alt={safeSlackEmoji.name} className="w-4 h-4 inline mr-1" />
                                  {dept.name}
                                </>
                              ) : (
                                <span>:{safeSlackEmoji.name}: {dept.name}</span>
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

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">訓練スケジュール管理</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
        >
          + 訓練をスケジュール
        </button>
      </div>

      {/* 新規追加フォーム */}
      {showAddForm && (
        <div className="bg-gray-700 p-4 rounded border border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-medium">新しい訓練スケジュール</h4>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <button
            onClick={addScheduledTraining}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            デフォルト設定で追加
          </button>
        </div>
      )}

      {/* スケジュール一覧 */}
      <div className="space-y-4">
        {safeConfig.scheduledTrainings.map(training => {
          const nextExecution = getNextExecutionTime(training);
          const isPast = !training.isRecurring && isTrainingPast(training.scheduledTime);
          
          return (
            <div 
              key={training.id} 
              className={cn(
                "bg-gray-700 p-4 rounded border",
                training.isActive ? "border-gray-600" : "border-gray-500 opacity-75",
                isPast && "border-red-500"
              )}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 基本設定 */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      対象ワークスペース
                    </label>
                    <select
                      value={training.workspaceId || ""}
                      onChange={(e) => updateTraining(training.id, { 
                        workspaceId: e.target.value || undefined 
                      })}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    >
                      <option value="">全ワークスペース</option>
                      {/* {workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))} */}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      実行日時
                    </label>
                    <input
                      type="datetime-local"
                      value={training.scheduledTime.toISOString().slice(0, 16)}
                      onChange={(e) => updateTraining(training.id, { 
                        scheduledTime: new Date(e.target.value) 
                      })}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={training.isRecurring}
                        onChange={(e) => updateTraining(training.id, { 
                          isRecurring: e.target.checked,
                          recurringPattern: e.target.checked ? 'weekly' : undefined
                        })}
                        className="mr-2 w-4 h-4"
                      />
                      <span className="text-gray-300 text-sm">繰り返し</span>
                    </label>

                    {training.isRecurring && (
                      <select
                        value={training.recurringPattern || 'weekly'}
                        onChange={(e) => updateTraining(training.id, { 
                          recurringPattern: e.target.value as any 
                        })}
                        className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                      >
                        <option value="daily">毎日</option>
                        <option value="weekly">毎週</option>
                        <option value="monthly">毎月</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* メッセージ設定 */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      訓練メッセージ
                    </label>
                    <textarea
                      value={training.message}
                      onChange={(e) => updateTraining(training.id, { message: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    />
                  </div>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={training.enableMentions}
                      onChange={(e) => updateTraining(training.id, { enableMentions: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <span className="text-gray-300 text-sm">メンション有効</span>
                  </label>
                </div>
              </div>

              {/* ステータスと操作 */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-600">
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-gray-400">対象:</span>
                    <span className="text-white ml-1">{getWorkspaceName(training.workspaceId)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">次回実行:</span>
                    <span className={cn(
                      "ml-1",
                      isPast ? "text-red-400" : "text-white"
                    )}>
                      {nextExecution ? formatDateTime(nextExecution) : "無効"}
                    </span>
                  </div>
                  {training.lastExecuted && (
                    <div className="text-sm">
                      <span className="text-gray-400">前回実行:</span>
                      <span className="text-green-400 ml-1">{formatDateTime(training.lastExecuted)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={training.isActive}
                      onChange={(e) => updateTraining(training.id, { isActive: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <span className="text-gray-300 text-sm">有効</span>
                  </label>

                  <button
                    onClick={() => removeTraining(training.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {safeConfig.scheduledTrainings.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            スケジュールされた訓練はありません。<br />
            「+ 訓練をスケジュール」ボタンから追加してください。
          </div>
        )}
      </div>
    </div>
  );
}