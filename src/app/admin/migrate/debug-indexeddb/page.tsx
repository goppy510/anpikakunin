"use client";

import { useState } from "react";
import { getDb } from "@/app/lib/db/indexed-db";

export default function DebugIndexedDBPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      if (!db) {
        alert("IndexedDBにアクセスできません");
        return;
      }

      // すべてのストアのデータを取得
      const settings = await db.getAll("settings");
      const safetySettings = await db.getAll("safetySettings");
      const earthquakeEvents = await db.getAll("earthquakeEvents");
      const safetyResponses = await db.getAll("safetyResponses");

      const result = {
        settings,
        safetySettings,
        earthquakeEvents: earthquakeEvents.slice(0, 3), // 最新3件
        safetyResponses: safetyResponses.slice(0, 3), // 最新3件
      };

      setData(result);
      console.log("IndexedDB全データ:", result);
    } catch (error) {
      console.error("読み込みエラー:", error);
      alert("エラー: " + (error instanceof Error ? error.message : "不明"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">IndexedDB データデバッグ</h1>

        <button
          onClick={loadAllData}
          disabled={loading}
          className="bg-blue-600 px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50 mb-6"
        >
          {loading ? "読み込み中..." : "📊 IndexedDB全データを取得"}
        </button>

        {data && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">settings</h2>
              <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-96 text-sm">
                {JSON.stringify(data.settings, null, 2)}
              </pre>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">safetySettings</h2>
              <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-96 text-sm">
                {JSON.stringify(data.safetySettings, null, 2)}
              </pre>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">earthquakeEvents（最新3件）</h2>
              <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-96 text-sm">
                {JSON.stringify(data.earthquakeEvents, null, 2)}
              </pre>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">safetyResponses（最新3件）</h2>
              <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-96 text-sm">
                {JSON.stringify(data.safetyResponses, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {data && (
          <div className="mt-8">
            <a
              href="/admin/migrate"
              className="bg-green-600 px-6 py-3 rounded hover:bg-green-700 inline-block"
            >
              → 移行画面に戻る
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
