"use client";

import { useState } from "react";
import cn from "classnames";
import { SlackWorkspace, DepartmentStamp, NotificationTemplate, NotificationConditions, JAPANESE_PREFECTURES, SlackEmoji, formatTrainingMessage } from "../types/SafetyConfirmationTypes";

interface WorkspaceDetailSettingsProps {
  workspace: SlackWorkspace;
  onUpdate: (updates: Partial<SlackWorkspace>) => void;
  onClose: () => void;
}

export function WorkspaceDetailSettings({ workspace, onUpdate, onClose }: WorkspaceDetailSettingsProps) {
  const [activeTab, setActiveTab] = useState<'conditions' | 'template' | 'departments'>('conditions');

  const updateTemplate = async (updates: Partial<NotificationTemplate>) => {
    const updatedWorkspace = {
      template: { ...workspace.template, ...updates }
    };
    onUpdate(updatedWorkspace);
    
    // 自動保存
    await autoSaveSettings();
  };

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
              workspace={workspace}
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

// メッセージテンプレートタブ
function TemplateTab({ 
  template, 
  onUpdate 
}: { 
  template: NotificationTemplate; 
  onUpdate: (updates: Partial<NotificationTemplate>) => void; 
}) {
  const [previewTrainingMode, setPreviewTrainingMode] = useState(false);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            メッセージ本文
            <span className="text-xs text-gray-400 block mt-1">
              *太字* _斜体_ ~取り消し線~ `コード` が使用できます
            </span>
          </label>
          <textarea
            value={template.message}
            onChange={(e) => onUpdate({ message: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="*重要* 地震が発生しました。安否確認のため、該当部署のスタンプを押してください。"
          />
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              プレビュー
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={previewTrainingMode}
                onChange={(e) => setPreviewTrainingMode(e.target.checked)}
                className="mr-2 w-3 h-3"
              />
              <span className="text-xs text-gray-400">訓練モード</span>
            </label>
          </div>
          <div className="bg-gray-800 border border-gray-600 rounded p-3 min-h-[144px]">
            {(() => {
              const previewTemplate = formatTrainingMessage(template, previewTrainingMode);
              return (
                <div className="space-y-3">
                  <div className="text-yellow-300 font-bold text-sm border-b border-gray-600 pb-1">
                    {previewTemplate.title}
                  </div>
                  <SlackMessagePreview content={previewTemplate.message} />
                  
                  {/* 地震詳細情報のプレビュー */}
                  {template.includeEventDetails && (
                    <div className="border-t border-gray-600 pt-2 mt-2">
                      <div className="text-xs text-gray-400 mb-1">地震詳細情報:</div>
                      <div className="bg-gray-700 p-2 rounded text-sm">
                        <div className="grid grid-cols-2 gap-2 text-gray-300">
                          <div>🕐 発生時刻: 2024/01/01 12:34</div>
                          <div>📍 震源地: 茨城県南部</div>
                          <div>📏 マグニチュード: M5.2</div>
                          <div>📊 最大震度: 震度4</div>
                          <div>🏔️ 深さ: 約50km</div>
                          <div>🔍 状況: 確定</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 地図リンクのプレビュー */}
                  {template.includeMapLink && (
                    <div className="border-t border-gray-600 pt-2">
                      <div className="text-xs text-gray-400 mb-1">地図リンク:</div>
                      <div className="text-blue-400 text-sm underline cursor-pointer">
                        🗺️ 震源地の詳細マップを確認する
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
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
          { regex: /\*([^*]+)\*/g, wrapper: (text: string) => <strong key={`bold-${currentIndex}`} className="font-bold">{text}</strong> },
          { regex: /_([^_]+)_/g, wrapper: (text: string) => <em key={`italic-${currentIndex}`} className="italic">{text}</em> },
          { regex: /~([^~]+)~/g, wrapper: (text: string) => <span key={`strike-${currentIndex}`} className="line-through">{text}</span> },
          { regex: /`([^`]+)`/g, wrapper: (text: string) => <code key={`code-${currentIndex}`} className="bg-gray-700 px-1 rounded text-sm font-mono">{text}</code> },
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
        <div key={lineIndex} className="text-gray-200 leading-relaxed">
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

// 部署スタンプタブ
function DepartmentsTab({ 
  departments, 
  workspace,
  onAdd, 
  onUpdate, 
  onRemove 
}: {
  departments: DepartmentStamp[];
  workspace: SlackWorkspace;
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
                <EmojiSelector
                  currentEmoji={dept.emoji}
                  workspace={workspace}
                  onSelect={(emoji) => onUpdate(dept.id, { emoji })}
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

// 絵文字選択コンポーネント
function EmojiSelector({
  currentEmoji,
  workspace,
  onSelect
}: {
  currentEmoji: string;
  workspace: SlackWorkspace;
  onSelect: (emoji: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // デフォルト絵文字セット
  const defaultEmojis = [
    "🏢", "👥", "💰", "📊", "⚙️", "🔧", "📋", "📞", 
    "🎯", "🚀", "💡", "📝", "🎨", "📈", "🛡️", "🌟",
    "🔥", "⭐", "✅", "❌", "⚠️", "🔔", "📢", "💬"
  ];

  // 検索フィルタリング
  const filteredEmojis = defaultEmojis.filter(emoji => 
    searchTerm === "" || emoji.includes(searchTerm)
  );

  // Slack絵文字も含める
  const slackEmojis = workspace.availableEmojis || [];
  
  // Slackカスタム絵文字の検索フィルタリング
  const filteredSlackEmojis = slackEmojis.filter(emoji => 
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
                {filteredSlackEmojis.map((emoji) => (
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
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.textContent = `:${emoji.name}:`;
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