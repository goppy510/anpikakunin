"use client";

import { useState } from "react";
import cn from "classnames";
import { SlackWorkspace, DepartmentStamp, NotificationTemplate, NotificationConditions, JAPANESE_PREFECTURES } from "../types/SafetyConfirmationTypes";

interface WorkspaceDetailSettingsProps {
  workspace: SlackWorkspace;
  onUpdate: (updates: Partial<SlackWorkspace>) => void;
  onClose: () => void;
}

export function WorkspaceDetailSettings({ workspace, onUpdate, onClose }: WorkspaceDetailSettingsProps) {
  const [activeTab, setActiveTab] = useState<'conditions' | 'template' | 'departments'>('conditions');

  const updateTemplate = (updates: Partial<NotificationTemplate>) => {
    onUpdate({
      template: { ...workspace.template, ...updates }
    });
  };

  const updateConditions = (updates: Partial<NotificationConditions>) => {
    onUpdate({
      conditions: { ...workspace.conditions, ...updates }
    });
  };

  const addDepartment = () => {
    const newDept: DepartmentStamp = {
      id: `dept_${Date.now()}`,
      name: "新しい部署",
      emoji: "🏢",
      color: "#3B82F6"
    };
    onUpdate({
      departments: [...workspace.departments, newDept]
    });
  };

  const updateDepartment = (id: string, updates: Partial<DepartmentStamp>) => {
    onUpdate({
      departments: workspace.departments.map(dept => 
        dept.id === id ? { ...dept, ...updates } : dept
      )
    });
  };

  const removeDepartment = (id: string) => {
    onUpdate({
      departments: workspace.departments.filter(dept => dept.id !== id)
    });
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

        {/* タブナビゲーション */}
        <div className="flex border-b border-gray-700">
          {[
            { key: 'conditions', label: '通知条件' },
            { key: 'template', label: 'メッセージテンプレート' },
            { key: 'departments', label: '部署スタンプ設定' }
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
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'conditions' && (
            <ConditionsTab 
              conditions={workspace.conditions}
              onUpdate={updateConditions}
            />
          )}
          {activeTab === 'template' && (
            <TemplateTab 
              template={workspace.template}
              onUpdate={updateTemplate}
            />
          )}
          {activeTab === 'departments' && (
            <DepartmentsTab 
              departments={workspace.departments}
              onAdd={addDepartment}
              onUpdate={updateDepartment}
              onRemove={removeDepartment}
            />
          )}
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
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          対象都道府県（{conditions.targetPrefectures.length}件選択中）
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto bg-gray-700 p-4 rounded">
          {JAPANESE_PREFECTURES.map(pref => (
            <label key={pref.code} className="flex items-center cursor-pointer hover:bg-gray-600 p-1 rounded">
              <input
                type="checkbox"
                checked={conditions.targetPrefectures.includes(pref.code)}
                onChange={() => handlePrefectureToggle(pref.code)}
                className="mr-2 w-3 h-3"
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

// メッセージテンプレートタブ
function TemplateTab({ 
  template, 
  onUpdate 
}: { 
  template: NotificationTemplate; 
  onUpdate: (updates: Partial<NotificationTemplate>) => void; 
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-white">通知メッセージ設定</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          通知タイトル
        </label>
        <input
          type="text"
          value={template.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          メッセージ本文
        </label>
        <textarea
          value={template.message}
          onChange={(e) => onUpdate({ message: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={template.includeEventDetails}
            onChange={(e) => onUpdate({ includeEventDetails: e.target.checked })}
            className="mr-2 w-4 h-4"
          />
          <span className="text-gray-300">地震詳細情報を含める</span>
        </label>

        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={template.includeMapLink}
            onChange={(e) => onUpdate({ includeMapLink: e.target.checked })}
            className="mr-2 w-4 h-4"
          />
          <span className="text-gray-300">地図リンクを含める</span>
        </label>
      </div>
    </div>
  );
}

// 部署スタンプタブ
function DepartmentsTab({ 
  departments, 
  onAdd, 
  onUpdate, 
  onRemove 
}: {
  departments: DepartmentStamp[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<DepartmentStamp>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">部署スタンプ設定</h3>
        <button
          onClick={onAdd}
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
                  onChange={(e) => onUpdate(dept.id, { name: e.target.value })}
                  className="bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm flex-1"
                />
              </div>
              <button
                onClick={() => onRemove(dept.id)}
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
                  onChange={(e) => onUpdate(dept.id, { emoji: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1">カラー</label>
                <input
                  type="color"
                  value={dept.color}
                  onChange={(e) => onUpdate(dept.id, { color: e.target.value })}
                  className="w-full h-8 bg-gray-600 border border-gray-500 rounded"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}