/**
 * IndexedDB設定をPostgreSQLに移行するボタンコンポーネント
 */

"use client";

import { useState } from "react";
import { SafetySettingsDatabase } from "../utils/settingsDatabase";
import { Button } from "react-aria-components";

export function MigrateSettingsButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "migrating" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [hasIndexedDBSettings, setHasIndexedDBSettings] = useState<boolean>(false);

  const checkSettings = async () => {
    setStatus("checking");
    try {
      const config = await SafetySettingsDatabase.loadSettings();
      if (config && config.slack.workspaces.length > 0) {
        setHasIndexedDBSettings(true);
        setMessage(`IndexedDBに${config.slack.workspaces.length}個のワークスペース設定が見つかりました`);
      } else {
        setHasIndexedDBSettings(false);
        setMessage("移行可能な設定が見つかりませんでした");
      }
      setStatus("idle");
    } catch (error) {
      console.error("Settings check failed:", error);
      setMessage(`設定の確認に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`);
      setStatus("error");
    }
  };

  const migrateSettings = async () => {
    setStatus("migrating");
    setMessage("設定を移行中...");

    try {
      // IndexedDBから設定を読み込み
      const config = await SafetySettingsDatabase.loadSettings();
      if (!config) {
        setMessage("移行する設定が見つかりませんでした");
        setStatus("error");
        return;
      }

      // マイグレーションAPIを呼び出し
      const response = await fetch("/api/migrate/indexeddb-to-postgres", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Migration failed");
      }

      const result = await response.json();

      setMessage(
        `移行完了: ${result.results.success}/${result.results.total} ワークスペース成功` +
        (result.results.failed > 0 ? `、${result.results.failed}件失敗` : "")
      );
      setStatus("success");

      // 成功した場合、詳細をコンソールに出力
      console.log("Migration result:", result);

      // 失敗したワークスペースがあれば警告
      if (result.details.failed.length > 0) {
        console.warn("Failed workspaces:", result.details.failed);
      }
    } catch (error) {
      console.error("Migration failed:", error);
      setMessage(`移行に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`);
      setStatus("error");
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-2">設定の移行</h3>
      <p className="text-sm text-gray-600 mb-4">
        IndexedDBに保存された既存の設定をPostgreSQLに移行します。
        <br />
        <strong>重要:</strong> Slack Bot Tokenは暗号化されて安全に保存されます。
      </p>

      <div className="flex gap-2 mb-4">
        <Button
          onPress={checkSettings}
          isDisabled={status === "checking" || status === "migrating"}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
        >
          {status === "checking" ? "確認中..." : "設定を確認"}
        </Button>

        {hasIndexedDBSettings && (
          <Button
            onPress={migrateSettings}
            isDisabled={status === "migrating"}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {status === "migrating" ? "移行中..." : "PostgreSQLに移行"}
          </Button>
        )}
      </div>

      {message && (
        <div
          className={`p-3 rounded ${
            status === "success"
              ? "bg-green-100 text-green-800"
              : status === "error"
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {message}
        </div>
      )}

      {status === "success" && (
        <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
          <p className="font-semibold">移行完了後の注意</p>
          <ul className="list-disc list-inside text-sm mt-2">
            <li>今後の設定変更はPostgreSQLに自動保存されます</li>
            <li>IndexedDBの旧設定は削除されません（バックアップとして保持）</li>
            <li>必要に応じてブラウザのIndexedDBを手動でクリアできます</li>
          </ul>
        </div>
      )}
    </div>
  );
}
