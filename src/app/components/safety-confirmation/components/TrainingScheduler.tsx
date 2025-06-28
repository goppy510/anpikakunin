"use client";

import { useState } from "react";
import cn from "classnames";
import { ScheduledTraining, SlackWorkspace } from "../types/SafetyConfirmationTypes";

interface TrainingSchedulerProps {
  scheduledTrainings: ScheduledTraining[];
  workspaces: SlackWorkspace[];
  onUpdate: (trainings: ScheduledTraining[]) => void;
  onSendTest: () => void;
}

export function TrainingScheduler({ 
  scheduledTrainings, 
  workspaces, 
  onUpdate, 
  onSendTest 
}: TrainingSchedulerProps) {
  const [showAddForm, setShowAddForm] = useState(false);

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

    onUpdate([...scheduledTrainings, newTraining]);
    setShowAddForm(false);
  };

  const updateTraining = (id: string, updates: Partial<ScheduledTraining>) => {
    onUpdate(
      scheduledTrainings.map(training => 
        training.id === id ? { ...training, ...updates } : training
      )
    );
  };

  const removeTraining = (id: string) => {
    onUpdate(scheduledTrainings.filter(training => training.id !== id));
  };

  const getWorkspaceName = (workspaceId?: string): string => {
    if (!workspaceId) return "全ワークスペース";
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    return workspace?.name || "不明なワークスペース";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">訓練スケジュール管理</h3>
        <div className="flex gap-2">
          <button
            onClick={onSendTest}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
          >
            即座にテスト送信
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
          >
            + 訓練をスケジュール
          </button>
        </div>
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
        {scheduledTrainings.map(training => {
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
                      {workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))}
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

        {scheduledTrainings.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            スケジュールされた訓練はありません。<br />
            「+ 訓練をスケジュール」ボタンから追加してください。
          </div>
        )}
      </div>
    </div>
  );
}