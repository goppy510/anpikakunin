"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "../components/auth/AuthGuard";

function SettingsDashboardContent() {
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

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">安否確認システム - 設定</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.email}</span>
            <span
              className={`px-2 py-1 text-white text-xs rounded ${
                isAdmin ? "bg-red-600" : "bg-blue-600"
              }`}
            >
              {user?.role}
            </span>
            {isAdmin && (
              <button
                onClick={() => router.push("/admin")}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                管理画面
              </button>
            )}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 地震通知設定 */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-lg font-bold mb-4">地震通知設定</h2>

            <div className="space-y-4">
              {/* 最小震度 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  最小震度
                </label>
                <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white">
                  <option value="">すべて</option>
                  <option value="3">震度3以上</option>
                  <option value="4">震度4以上</option>
                  <option value="5弱">震度5弱以上</option>
                  <option value="5強">震度5強以上</option>
                  <option value="6弱">震度6弱以上</option>
                  <option value="6強">震度6強以上</option>
                  <option value="7">震度7のみ</option>
                </select>
              </div>

              {/* 対象都道府県 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  対象都道府県
                </label>
                <div className="bg-gray-700 border border-gray-600 rounded p-3 max-h-60 overflow-y-auto">
                  <div className="space-y-2">
                    {[
                      "北海道",
                      "青森県",
                      "岩手県",
                      "宮城県",
                      "秋田県",
                      "山形県",
                      "福島県",
                      "茨城県",
                      "栃木県",
                      "群馬県",
                      "埼玉県",
                      "千葉県",
                      "東京都",
                      "神奈川県",
                    ].map((pref) => (
                      <label key={pref} className="flex items-center">
                        <input
                          type="checkbox"
                          className="mr-2"
                          defaultChecked={pref === "東京都"}
                        />
                        <span className="text-sm">{pref}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <button className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
                設定を保存
              </button>
            </div>
          </div>

          {/* メッセージテンプレート */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-lg font-bold mb-4">Slackメッセージテンプレート</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  メッセージ内容
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows={8}
                  defaultValue={`地震速報

震度: {intensity}
震源: {hypocenter}
マグニチュード: {magnitude}
発生時刻: {time}

詳細は気象庁の発表をご確認ください。`}
                />
              </div>

              <div className="bg-blue-900 bg-opacity-30 border border-blue-600 p-3 rounded">
                <div className="text-blue-300 text-sm font-medium mb-2">
                  使用可能な変数
                </div>
                <div className="text-blue-200 text-xs space-y-1">
                  <div>
                    <code className="bg-blue-800 px-1 rounded">
                      {"{intensity}"}
                    </code>{" "}
                    - 震度
                  </div>
                  <div>
                    <code className="bg-blue-800 px-1 rounded">
                      {"{hypocenter}"}
                    </code>{" "}
                    - 震源地
                  </div>
                  <div>
                    <code className="bg-blue-800 px-1 rounded">
                      {"{magnitude}"}
                    </code>{" "}
                    - マグニチュード
                  </div>
                  <div>
                    <code className="bg-blue-800 px-1 rounded">{"{time}"}</code>{" "}
                    - 発生時刻
                  </div>
                </div>
              </div>

              <button className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
                テンプレートを保存
              </button>
            </div>
          </div>
        </div>

        {/* プレビュー */}
        <div className="mt-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-lg font-bold mb-4">メッセージプレビュー</h2>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-sm text-gray-300">
              プレビュー機能は今後実装予定です。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsDashboard() {
  return (
    <AuthGuard requiredRole="EDITOR">
      <SettingsDashboardContent />
    </AuthGuard>
  );
}
