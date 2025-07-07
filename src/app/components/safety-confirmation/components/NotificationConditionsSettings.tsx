"use client";

import { useState } from "react";
import cn from "classnames";
import {
  SafetyConfirmationConfig,
  NotificationConditions,
  DEFAULT_DEPARTMENT_STAMPS,
  DEFAULT_NOTIFICATION_TEMPLATE,
  JAPANESE_PREFECTURES,
} from "../types/SafetyConfirmationTypes";
import { SafetySettingsDatabase } from "../utils/settingsDatabase";
import { Settings } from "../../../lib/db/settings";

interface NotificationConditionsSettingsProps {
  config: SafetyConfirmationConfig;
  onUpdate: (config: SafetyConfirmationConfig) => void;
}

export function NotificationConditionsSettings({
  config,
  onUpdate,
}: NotificationConditionsSettingsProps) {
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
          targetPrefectures: ["13", "14", "12"], // 東京、神奈川、千葉
          enableMentions: false,
          mentionTargets: [],
          notificationType: "comprehensive",
        },
      }
    );
  };

  const updateConditions = async (updates: Partial<NotificationConditions>) => {
    const currentWs = getCurrentWorkspace();
    const updatedConditions = { ...currentWs.conditions, ...updates };
    const updatedWorkspaces =
      config.slack.workspaces.length > 0
        ? config.slack.workspaces.map((ws) =>
            ws.id === currentWs.id ? { ...ws, conditions: updatedConditions } : ws
          )
        : [{ ...currentWs, conditions: updatedConditions }];

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
      console.error("通知条件設定の自動保存に失敗:", error);
    }
  };

  const currentWorkspace = getCurrentWorkspace();

  const togglePrefecture = (prefCode: string) => {
    const currentPrefectures = currentWorkspace.conditions.targetPrefectures;
    const isSelected = currentPrefectures.includes(prefCode);
    
    if (isSelected) {
      updateConditions({
        targetPrefectures: currentPrefectures.filter(code => code !== prefCode)
      });
    } else {
      updateConditions({
        targetPrefectures: [...currentPrefectures, prefCode]
      });
    }
  };

  const selectAllPrefectures = () => {
    updateConditions({
      targetPrefectures: JAPANESE_PREFECTURES.map(pref => pref.code)
    });
  };

  const clearAllPrefectures = () => {
    updateConditions({
      targetPrefectures: []
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-400">
        地震情報を受信して通知を送信する条件を設定します
      </p>

      {/* 震度設定 */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-white">通知震度</h4>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            最小震度（この震度以上で通知）
          </label>
          <select
            value={currentWorkspace.conditions.minIntensity}
            onChange={(e) => updateConditions({ minIntensity: Number(e.target.value) })}
            className="w-full max-w-xs px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
          >
            <option value={1}>震度1以上</option>
            <option value={2}>震度2以上</option>
            <option value={3}>震度3以上</option>
            <option value={4}>震度4以上</option>
            <option value={5}>震度5弱以上</option>
            <option value={6}>震度5強以上</option>
            <option value={7}>震度6弱以上</option>
            <option value={8}>震度6強以上</option>
            <option value={9}>震度7</option>
          </select>
          <p className="text-gray-400 text-sm mt-1">
            選択した震度以上の地震が発生した場合に通知を送信します
          </p>
        </div>
      </div>

      {/* 都道府県設定 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-medium text-white">対象都道府県</h4>
          <div className="flex gap-2">
            <button
              onClick={selectAllPrefectures}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              全て選択
            </button>
            <button
              onClick={clearAllPrefectures}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
            >
              全て解除
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {JAPANESE_PREFECTURES.map((prefecture) => {
            const isSelected = currentWorkspace.conditions.targetPrefectures.includes(prefecture.code);
            return (
              <label
                key={prefecture.code}
                className={cn(
                  "flex items-center cursor-pointer p-2 rounded border transition-colors",
                  isSelected
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => togglePrefecture(prefecture.code)}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-sm">{prefecture.name}</span>
              </label>
            );
          })}
        </div>
        
        <p className="text-gray-400 text-sm">
          選択した都道府県で地震が発生した場合に通知を送信します（
          {currentWorkspace.conditions.targetPrefectures.length}県選択中）
        </p>
      </div>

      {/* 通知タイプ設定 */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-white">通知タイプ</h4>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="notificationType"
              value="intensity"
              checked={currentWorkspace.conditions.notificationType === "intensity"}
              onChange={(e) => updateConditions({ notificationType: "intensity" })}
              className="mr-3 w-4 h-4"
            />
            <div>
              <span className="text-white">震度速報</span>
              <p className="text-gray-400 text-sm ml-6">地震発生直後の速報（震度のみ）</p>
            </div>
          </label>
          
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="notificationType"
              value="comprehensive"
              checked={currentWorkspace.conditions.notificationType === "comprehensive"}
              onChange={(e) => updateConditions({ notificationType: "comprehensive" })}
              className="mr-3 w-4 h-4"
            />
            <div>
              <span className="text-white">震源・震度に関する情報</span>
              <p className="text-gray-400 text-sm ml-6">詳細な震源地・マグニチュード情報を含む</p>
            </div>
          </label>
        </div>
      </div>

      {/* メンション設定 */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-white">メンション設定</h4>
        
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={currentWorkspace.conditions.enableMentions}
            onChange={(e) => updateConditions({ enableMentions: e.target.checked })}
            className="mr-3 w-4 h-4"
          />
          <span className="text-white">メンション機能を有効にする</span>
        </label>

        {currentWorkspace.conditions.enableMentions && (
          <div className="ml-6 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                メンション対象
              </label>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentWorkspace.conditions.mentionTargets.includes("@channel")}
                    onChange={(e) => {
                      const targets = currentWorkspace.conditions.mentionTargets;
                      if (e.target.checked) {
                        updateConditions({
                          mentionTargets: [...targets.filter(t => t !== "@channel"), "@channel"]
                        });
                      } else {
                        updateConditions({
                          mentionTargets: targets.filter(t => t !== "@channel")
                        });
                      }
                    }}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-gray-300">@channel（全メンバー）</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentWorkspace.conditions.mentionTargets.includes("@here")}
                    onChange={(e) => {
                      const targets = currentWorkspace.conditions.mentionTargets;
                      if (e.target.checked) {
                        updateConditions({
                          mentionTargets: [...targets.filter(t => t !== "@here"), "@here"]
                        });
                      } else {
                        updateConditions({
                          mentionTargets: targets.filter(t => t !== "@here")
                        });
                      }
                    }}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-gray-300">@here（オンラインメンバー）</span>
                </label>
              </div>
            </div>
            
            <p className="text-gray-400 text-sm">
              緊急時のみメンションを使用することを推奨します
            </p>
          </div>
        )}
      </div>
    </div>
  );
}