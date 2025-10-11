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

interface OAuth2Status {
  isAuthenticated: boolean;
  tokenExists: boolean;
  expiresAt: string | null;
  createdAt: string | null;
}

export default function DmdataSettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [oauth2Status, setOauth2Status] = useState<OAuth2Status | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchApiKeys();
    fetchOAuth2Status();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/admin/dmdata-api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    }
  };

  const fetchOAuth2Status = async () => {
    try {
      const response = await fetch("/api/admin/dmdata-oauth/status");
      if (response.ok) {
        const data = await response.json();
        setOauth2Status(data);
      }
    } catch (error) {
      console.error("Failed to fetch OAuth2 status:", error);
    }
  };

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKey.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/dmdata-api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: newApiKey,
          description: newDescription || null,
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
      const response = await fetch(`/api/admin/dmdata-api-keys/${id}`, {
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

  const handleToggleApiKey = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/dmdata-api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        await fetchApiKeys();
      } else {
        toast.error("APIキーの状態変更に失敗しました");
      }
    } catch (error) {
      console.error("Failed to toggle API key:", error);
      toast.error("APIキーの状態変更に失敗しました");
    }
  };

  const handleOAuth2Connect = async () => {
    try {
      const response = await fetch("/api/admin/dmdata-oauth/auth-url");
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        toast.error("認証URLの取得に失敗しました");
      }
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      toast.error("認証URLの取得に失敗しました");
    }
  };

  const handleOAuth2Disconnect = async () => {
    if (!confirm("OAuth2トークンを削除しますか？")) return;

    try {
      const response = await fetch("/api/admin/dmdata-oauth/status", {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchOAuth2Status();
        toast.success("OAuth2トークンを削除しました");
      } else {
        toast.error("OAuth2トークンの削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to disconnect OAuth2:", error);
      toast.error("OAuth2トークンの削除に失敗しました");
    }
  };

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      <h1 className="text-2xl font-bold mb-6">DMData.jp 認証設定</h1>

      {/* OAuth2 認証状態 */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">OAuth2 認証（WebSocket用）</h2>
        <p className="text-sm text-gray-600 mb-4">
          リアルタイムのWebSocket接続で地震情報を受信する場合に使用します
        </p>
        {oauth2Status ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded text-sm font-semibold ${
                  oauth2Status.isAuthenticated
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {oauth2Status.isAuthenticated ? "✓ 認証済み" : "未認証"}
              </span>
            </div>

            {oauth2Status.tokenExists && (
              <div className="text-sm text-gray-600">
                <p>
                  作成日時:{" "}
                  {oauth2Status.createdAt
                    ? new Date(oauth2Status.createdAt).toLocaleString("ja-JP")
                    : "-"}
                </p>
                {oauth2Status.expiresAt && (
                  <p>
                    有効期限:{" "}
                    {new Date(oauth2Status.expiresAt).toLocaleString("ja-JP")}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              {oauth2Status.isAuthenticated ? (
                <button
                  onClick={handleOAuth2Disconnect}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  OAuth2 トークンを削除
                </button>
              ) : (
                <button
                  onClick={handleOAuth2Connect}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  OAuth2 認証を開始
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">読み込み中...</p>
        )}
      </div>

      {/* API Key 管理 */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">API Key 管理（REST API用）</h2>
        <p className="text-sm text-gray-600 mb-4">
          定期的なポーリングやバッチ処理で地震情報を取得する場合に使用します
        </p>

        <form onSubmit={handleAddApiKey} className="mb-6 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="text"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="DMData.jp API Key"
              className="w-full px-3 py-2 border rounded text-gray-900 bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              説明（任意）
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="例: 本番用APIキー"
              className="w-full px-3 py-2 border rounded text-gray-900 bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "登録中..." : "API Keyを登録"}
          </button>
        </form>

        {apiKeys.length > 0 ? (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border rounded bg-white"
              >
                <div className="flex-1">
                  <p className="font-mono text-sm text-gray-900">{key.maskedKey}</p>
                  {key.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {key.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    登録日時:{" "}
                    {new Date(key.createdAt).toLocaleString("ja-JP")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={key.isActive}
                      onChange={(e) =>
                        handleToggleApiKey(key.id, e.target.checked)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-900">有効</span>
                  </label>

                  <button
                    onClick={() => handleDeleteApiKey(key.id)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            登録されたAPI Keyはありません
          </p>
        )}
      </div>

      {/* 説明 */}
      <div className="p-6 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">認証方法について</h3>
        <ul className="text-sm space-y-2 text-gray-700">
          <li>
            <strong>OAuth2 認証:</strong>{" "}
            WebSocketによるリアルタイム地震情報取得に使用
          </li>
          <li>
            <strong>API Key:</strong> REST
            APIによる地震情報の定期取得・バッチ処理に使用
          </li>
          <li>両方を設定することで、より確実な地震情報の取得が可能です</li>
        </ul>
      </div>
    </div>
  );
}
