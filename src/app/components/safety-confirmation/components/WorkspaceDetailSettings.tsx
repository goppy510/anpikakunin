"use client";

import { useState } from "react";
import cn from "classnames";
import { SlackWorkspace, NotificationConditions, JAPANESE_PREFECTURES } from "../types/SafetyConfirmationTypes";

interface WorkspaceDetailSettingsProps {
  workspace: SlackWorkspace;
  onUpdate: (updates: Partial<SlackWorkspace>) => void;
  onClose: () => void;
}

export function WorkspaceDetailSettings({ workspace, onUpdate, onClose }: WorkspaceDetailSettingsProps) {
  const [activeTab, setActiveTab] = useState<'conditions'>('conditions');

  const updateConditions = async (updates: Partial<NotificationConditions>) => {
    const updatedWorkspace = {
      conditions: { ...workspace.conditions, ...updates }
    };
    onUpdate(updatedWorkspace);
    
    // 自動保存
    await autoSaveSettings();
  };

  const autoSaveSettings = async () => {
    try {
      const { SafetySettingsDatabase } = await import('../utils/settingsDatabase');
      const currentConfig = await SafetySettingsDatabase.loadSettings();
      if (currentConfig) {
        await SafetySettingsDatabase.saveSettings(currentConfig);
      }
    } catch (error) {
      console.error('設定の自動保存に失敗:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {workspace.name} - 詳細設定
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ヘッダー - タブは削除して通知条件のみに */}
        <div className="border-b border-gray-700 px-6 py-3">
          <h3 className="text-lg font-medium text-white">通知条件設定</h3>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-6">
          <ConditionsTab 
            conditions={workspace.conditions}
            onUpdate={updateConditions}
          />
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-4 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// 通知条件タブ
function ConditionsTab({ 
  conditions, 
  onUpdate 
}: { 
  conditions: NotificationConditions; 
  onUpdate: (updates: Partial<NotificationConditions>) => void; 
}) {
  const handlePrefectureToggle = (prefCode: string) => {
    const isSelected = conditions.targetPrefectures.includes(prefCode);
    const newPrefectures = isSelected
      ? conditions.targetPrefectures.filter(code => code !== prefCode)
      : [...conditions.targetPrefectures, prefCode];
    
    onUpdate({ targetPrefectures: newPrefectures });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-white">通知条件設定</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            最小震度
          </label>
          <select
            value={conditions.minIntensity}
            onChange={(e) => onUpdate({ minIntensity: Number(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
          >
            <option value={1}>震度1以上</option>
            <option value={2}>震度2以上</option>
            <option value={3}>震度3以上</option>
            <option value={4}>震度4以上</option>
            <option value={5}>震度5弱以上</option>
            <option value={5.5}>震度5強以上</option>
            <option value={6}>震度6弱以上</option>
            <option value={6.5}>震度6強以上</option>
            <option value={7}>震度7のみ</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            通知種別
          </label>
          <select
            value={conditions.notificationType}
            onChange={(e) => onUpdate({ notificationType: e.target.value as 'intensity' | 'comprehensive' })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
          >
            <option value="intensity">震度速報</option>
            <option value="comprehensive">震源・震度に関する情報</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            震度速報：速報性重視、震源・震度：詳細情報込み
          </p>
        </div>
      </div>

      <div>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={conditions.enableMentions}
            onChange={(e) => onUpdate({ enableMentions: e.target.checked })}
            className="mr-2 w-4 h-4"
          />
          <span className="text-gray-300">メンション機能を有効にする</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          対象都道府県（{conditions.targetPrefectures.length}件選択中）
        </label>
        <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto bg-gray-700 p-4 rounded">
          {JAPANESE_PREFECTURES.map(pref => (
            <label key={pref.code} className="flex items-center cursor-pointer hover:bg-gray-600 p-2 rounded">
              <input
                type="checkbox"
                checked={conditions.targetPrefectures.includes(pref.code)}
                onChange={() => handlePrefectureToggle(pref.code)}
                className="mr-3 w-4 h-4"
              />
              <span className="text-sm text-gray-300">{pref.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onUpdate({ targetPrefectures: JAPANESE_PREFECTURES.map(p => p.code) })}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
          >
            全選択
          </button>
          <button
            onClick={() => onUpdate({ targetPrefectures: [] })}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
          >
            全解除
          </button>
        </div>
      </div>
    </div>
  );
}




