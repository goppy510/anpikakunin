"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "../components/auth/AuthGuard";

function AdminDashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const response = await fetch("/api/auth/session");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    }
    void loadUser();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">安否確認システム - 管理者</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.email}</span>
            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
              ADMIN
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Slackワークスペース管理 */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-lg font-bold mb-4">Slackワークスペース管理</h2>
            <p className="text-gray-400 text-sm mb-4">
              Slack連携の設定とBot Token管理
            </p>
            <button className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
              管理画面を開く
            </button>
          </div>

          {/* メンバー管理 */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-lg font-bold mb-4">メンバー管理</h2>
            <p className="text-gray-400 text-sm mb-4">
              ユーザーの招待と権限管理
            </p>
            <button className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
              メンバーを招待
            </button>
          </div>

          {/* データ移行 */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-lg font-bold mb-4">データ移行</h2>
            <p className="text-gray-400 text-sm mb-4">
              IndexedDBからPostgreSQLへ移行
            </p>
            <button className="w-full bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded">
              移行ツールを開く
            </button>
          </div>

          {/* 地震通知設定 */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-lg font-bold mb-4">地震通知設定</h2>
            <p className="text-gray-400 text-sm mb-4">
              震度・エリアの通知条件設定
            </p>
            <button
              onClick={() => router.push("/settings")}
              className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
            >
              設定画面を開く
            </button>
          </div>

          {/* システム情報 */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-lg font-bold mb-4">システム情報</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">バージョン:</span>
                <span>v1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">環境:</span>
                <span>{process.env.NODE_ENV}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 最近のアクティビティ */}
        <div className="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-lg font-bold mb-4">最近のアクティビティ</h2>
          <div className="text-gray-400 text-sm">
            <p>アクティビティログは今後実装予定です。</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AuthGuard requiredRole="ADMIN">
      <AdminDashboardContent />
    </AuthGuard>
  );
}
