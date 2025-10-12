/**
 * 初回アクセス時にIndexedDB設定の自動移行を促すコンポーネント
 */

"use client";

import { useEffect, useState } from "react";
import { SafetySettingsDatabase } from "../utils/settingsDatabase";

export function AutoMigrationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkForMigration = async () => {
      try {
        // LocalStorageで既に確認済みかチェック
        const migrationChecked = localStorage.getItem("migration_checked");
        if (migrationChecked === "true") {
          setIsChecking(false);
          return;
        }

        // IndexedDBに設定があるかチェック
        const config = await SafetySettingsDatabase.loadSettings();
        if (config && config.slack.workspaces.length > 0) {
          setWorkspaceCount(config.slack.workspaces.length);
          setShowPrompt(true);
        }

        setIsChecking(false);
      } catch (error) {
        console.error("Auto migration check failed:", error);
        setIsChecking(false);
      }
    };

    void checkForMigration();
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("migration_checked", "true");
    setShowPrompt(false);
  };

  const handleNavigateToSetup = () => {
    localStorage.setItem("migration_checked", "true");
    // SetupTabに遷移する処理（実装はアプリの構造に依存）
    window.location.hash = "#setup";
    setShowPrompt(false);
  };

  if (isChecking || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black p-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-lg">
            📦 既存の設定データが見つかりました
          </h3>
          <p className="text-sm mt-1">
            IndexedDBに{workspaceCount}個のワークスペース設定があります。
            PostgreSQLに移行することをお勧めします。
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={handleNavigateToSetup}
            className="px-4 py-2 bg-black text-yellow-500 rounded hover:bg-gray-800 font-semibold"
          >
            移行する
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            後で
          </button>
        </div>
      </div>
    </div>
  );
}
