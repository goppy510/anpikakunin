"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";

interface ApiKey {
  id: string;
  description: string | null;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CronJobSettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKey, setNewApiKey] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/admin/cronjob-api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    }
  };

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKey.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/cronjob-api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: newApiKey,
          description: newDescription || "cron-job.org APIキー",
        }),
      });

      if (response.ok) {
        setNewApiKey("");
        setNewDescription("");
        await fetchApiKeys();
        toast.success("APIキーを登録しました");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "APIキーの登録に失敗しました");
      }
    } catch (error) {
      console.error("Failed to add API key:", error);
      toast.error("APIキーの登録に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("このAPIキーを削除しますか？")) return;

    try {
      const response = await fetch(`/api/admin/cronjob-api-keys/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchApiKeys();
        toast.success("APIキーを削除しました");
      } else {
        toast.error("APIキーの削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete API key:", error);
      toast.error("APIキーの削除に失敗しました");
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/admin/cronjob-api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentState }),
      });

      if (response.ok) {
        await fetchApiKeys();
        toast.success(
          !currentState ? "APIキーを有効化しました" : "APIキーを無効化しました"
        );
      } else {
        toast.error("APIキーの更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to toggle API key:", error);
      toast.error("APIキーの更新に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <Toaster position="top-right" />

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">cron-job.org API 設定</h1>
          <p className="text-gray-400">
            訓練モードの時刻指定通知に使用する cron-job.org API キーを管理します
          </p>
        </div>

        {/* APIキー登録フォーム */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">APIキー登録</h2>
          <form onSubmit={handleAddApiKey} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                cron-job.org APIキー
              </label>
              <input
                type="text"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="APIキーを入力"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-sm text-gray-400 mt-1">
                <a
                  href="https://console.cron-job.org/account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  cron-job.org Console
                </a>{" "}
                の API タブから取得できます
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                説明（オプション）
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="例: 本番環境用APIキー"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? "登録中..." : "APIキーを登録"}
            </button>
          </form>
        </div>

        {/* 登録済みAPIキー一覧 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">登録済みAPIキー</h2>

          {apiKeys.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              登録されているAPIキーがありません
            </p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm bg-gray-600 px-3 py-1 rounded">
                        {key.maskedKey}
                      </span>
                      {key.isActive && (
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                          有効
                        </span>
                      )}
                    </div>
                    {key.description && (
                      <p className="text-sm text-gray-400">{key.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      登録日:{" "}
                      {new Date(key.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(key.id, key.isActive)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        key.isActive
                          ? "bg-yellow-600 hover:bg-yellow-700"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {key.isActive ? "無効化" : "有効化"}
                    </button>
                    <button
                      onClick={() => handleDeleteApiKey(key.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 使い方ガイド */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">セットアップガイド</h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-medium text-white mb-2">1. cron-job.org アカウント作成</h3>
              <p className="text-sm">
                <a
                  href="https://cron-job.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  https://cron-job.org/
                </a>{" "}
                でアカウントを作成してください（無料）
              </p>
            </div>

            <div>
              <h3 className="font-medium text-white mb-2">2. APIキーを取得</h3>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>
                  <a
                    href="https://console.cron-job.org/account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Console
                  </a>{" "}
                  にログイン
                </li>
                <li>「API」タブをクリック</li>
                <li>「Create API key」をクリック</li>
                <li>生成されたAPIキーをコピー</li>
              </ol>
            </div>

            <div>
              <h3 className="font-medium text-white mb-2">3. APIキーを登録</h3>
              <p className="text-sm">
                上記のフォームにAPIキーを貼り付けて「APIキーを登録」をクリックしてください
              </p>
            </div>

            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-4">
              <p className="text-sm">
                <strong className="text-blue-400">ℹ️ 注意:</strong>{" "}
                訓練モードで時刻指定通知を使用するには、このAPIキーの登録が必須です。
                APIキーが登録されていない場合、時刻指定通知は動作しません。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
