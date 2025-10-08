"use client";

import { useState } from "react";

type MigrationStep = "workspace" | "departments" | "conditions" | "messages" | "complete";

export default function MigratePage() {
  const [currentStep, setCurrentStep] = useState<MigrationStep>("workspace");
  const [workspaceData, setWorkspaceData] = useState({
    workspaceId: "",
    name: "",
    botToken: "",
  });
  const [departments, setDepartments] = useState<
    Array<{ name: string; slackEmoji: string; buttonColor: string }>
  >([]);
  const [conditions, setConditions] = useState({
    minIntensity: "5-",
    targetPrefectures: [] as string[],
    notificationChannel: "",
  });
  const [messages, setMessages] = useState({
    productionTitle: "",
    productionBody: "",
    trainingTitle: "",
    trainingBody: "",
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newDept, setNewDept] = useState({ name: "", slackEmoji: "", buttonColor: "#5B8FF9" });

  const addDepartment = () => {
    if (newDept.name && newDept.slackEmoji) {
      setDepartments([...departments, newDept]);
      setNewDept({ name: "", slackEmoji: "", buttonColor: "#5B8FF9" });
    }
  };

  const removeDepartment = (index: number) => {
    setDepartments(departments.filter((_, i) => i !== index));
  };

  const togglePrefecture = (pref: string) => {
    setConditions((prev) => ({
      ...prev,
      targetPrefectures: prev.targetPrefectures.includes(pref)
        ? prev.targetPrefectures.filter((p) => p !== pref)
        : [...prev.targetPrefectures, pref],
    }));
  };

  const PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
  ];

  const INTENSITY_SCALES = [
    { value: "1", label: "震度1以上" },
    { value: "2", label: "震度2以上" },
    { value: "3", label: "震度3以上" },
    { value: "4", label: "震度4以上" },
    { value: "5-", label: "震度5弱以上" },
    { value: "5+", label: "震度5強以上" },
    { value: "6-", label: "震度6弱以上" },
    { value: "6+", label: "震度6強以上" },
    { value: "7", label: "震度7" },
  ];

  const handleMigrate = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. ワークスペース登録
      const workspaceRes = await fetch("/api/slack/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspaceData),
      });
      if (!workspaceRes.ok) {
        const errorData = await workspaceRes.json();
        throw new Error(errorData.error || "ワークスペース登録失敗");
      }
      const workspace = await workspaceRes.json();

      // 2. 部署登録
      for (const dept of departments) {
        await fetch("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...dept, workspaceId: workspace.workspaceId }),
        });
      }

      // 3. 通知条件登録
      await fetch("/api/earthquake-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...conditions, workspaceId: workspace.workspaceId }),
      });

      // 4. メッセージテンプレート登録
      await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.workspaceId,
          production: { title: messages.productionTitle, body: messages.productionBody },
          training: { title: messages.trainingTitle, body: messages.trainingBody },
        }),
      });

      // 5. スプレッドシートURL登録
      if (spreadsheetUrl) {
        await fetch("/api/spreadsheet-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: workspace.workspaceId, spreadsheetUrl }),
        });
      }

      setCurrentStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "移行に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">データ登録（手動入力）</h1>

        {/* ステップインジケーター */}
        <div className="flex gap-4 mb-8">
          {["workspace", "departments", "conditions", "messages", "complete"].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded ${
                currentStep === step ? "bg-blue-500" : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 p-4 rounded mb-6">
            ❌ {error}
          </div>
        )}

        {/* ワークスペース情報 */}
        {currentStep === "workspace" && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">1. Slackワークスペース情報</h2>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">ワークスペースID</label>
                <input
                  type="text"
                  value={workspaceData.workspaceId}
                  onChange={(e) =>
                    setWorkspaceData({ ...workspaceData, workspaceId: e.target.value })
                  }
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="workspace_1234567890"
                />
              </div>
              <div>
                <label className="block mb-2">ワークスペース名</label>
                <input
                  type="text"
                  value={workspaceData.name}
                  onChange={(e) => setWorkspaceData({ ...workspaceData, name: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="eviry"
                />
              </div>
              <div>
                <label className="block mb-2">Bot Token</label>
                <input
                  type="password"
                  value={workspaceData.botToken}
                  onChange={(e) =>
                    setWorkspaceData({ ...workspaceData, botToken: e.target.value })
                  }
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="xoxb-..."
                />
              </div>
              <button
                onClick={() => setCurrentStep("departments")}
                disabled={!workspaceData.workspaceId || !workspaceData.name || !workspaceData.botToken}
                className="bg-blue-600 px-6 py-2 rounded disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* 部署スタンプ設定 */}
        {currentStep === "departments" && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">2. 部署スタンプ設定</h2>
            <div className="space-y-4 mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="部署名（例: 開発）"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="flex-1 bg-gray-700 p-2 rounded"
                />
                <input
                  type="text"
                  placeholder="絵文字（例: :dev:）"
                  value={newDept.slackEmoji}
                  onChange={(e) => setNewDept({ ...newDept, slackEmoji: e.target.value })}
                  className="flex-1 bg-gray-700 p-2 rounded"
                />
                <input
                  type="color"
                  value={newDept.buttonColor}
                  onChange={(e) => setNewDept({ ...newDept, buttonColor: e.target.value })}
                  className="w-20 bg-gray-700 rounded"
                />
                <button onClick={addDepartment} className="bg-green-600 px-4 py-2 rounded">
                  追加
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {departments.map((dept, i) => (
                <div key={i} className="flex items-center gap-4 bg-gray-700 p-3 rounded">
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: dept.buttonColor }}
                  />
                  <span className="flex-1">{dept.name}</span>
                  <span className="text-gray-400">{dept.slackEmoji}</span>
                  <button
                    onClick={() => removeDepartment(i)}
                    className="text-red-400 hover:text-red-300"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCurrentStep("workspace")} className="bg-gray-600 px-6 py-2 rounded">
                戻る
              </button>
              <button onClick={() => setCurrentStep("conditions")} className="bg-blue-600 px-6 py-2 rounded">
                次へ
              </button>
            </div>
          </div>
        )}

        {/* 通知条件設定 */}
        {currentStep === "conditions" && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">3. 通知条件設定</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block mb-2">最小震度</label>
                <select
                  value={conditions.minIntensity}
                  onChange={(e) => setConditions({ ...conditions, minIntensity: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded"
                >
                  {INTENSITY_SCALES.map((scale) => (
                    <option key={scale.value} value={scale.value}>
                      {scale.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2">対象都道府県</label>
                <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                  {PREFECTURES.map((pref) => (
                    <button
                      key={pref}
                      onClick={() => togglePrefecture(pref)}
                      className={`p-2 rounded text-sm ${
                        conditions.targetPrefectures.includes(pref)
                          ? "bg-blue-600"
                          : "bg-gray-700"
                      }`}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2">通知先チャンネルID</label>
                <input
                  type="text"
                  value={conditions.notificationChannel}
                  onChange={(e) =>
                    setConditions({ ...conditions, notificationChannel: e.target.value })
                  }
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="C01234567"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCurrentStep("departments")} className="bg-gray-600 px-6 py-2 rounded">
                戻る
              </button>
              <button onClick={() => setCurrentStep("messages")} className="bg-blue-600 px-6 py-2 rounded">
                次へ
              </button>
            </div>
          </div>
        )}

        {/* メッセージ設定 */}
        {currentStep === "messages" && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">4. メッセージテンプレート</h2>
            <div className="space-y-6 mb-6">
              <div>
                <h3 className="font-bold mb-2">本番用メッセージ</h3>
                <input
                  type="text"
                  placeholder="タイトル"
                  value={messages.productionTitle}
                  onChange={(e) => setMessages({ ...messages, productionTitle: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded mb-2"
                />
                <textarea
                  placeholder="本文"
                  value={messages.productionBody}
                  onChange={(e) => setMessages({ ...messages, productionBody: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded h-32"
                />
              </div>

              <div>
                <h3 className="font-bold mb-2">訓練用メッセージ</h3>
                <input
                  type="text"
                  placeholder="タイトル"
                  value={messages.trainingTitle}
                  onChange={(e) => setMessages({ ...messages, trainingTitle: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded mb-2"
                />
                <textarea
                  placeholder="本文"
                  value={messages.trainingBody}
                  onChange={(e) => setMessages({ ...messages, trainingBody: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded h-32"
                />
              </div>

              <div>
                <label className="block mb-2">スプレッドシートURL（オプション）</label>
                <input
                  type="url"
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCurrentStep("conditions")} className="bg-gray-600 px-6 py-2 rounded">
                戻る
              </button>
              <button
                onClick={handleMigrate}
                disabled={loading}
                className="bg-green-600 px-6 py-2 rounded disabled:opacity-50"
              >
                {loading ? "移行中..." : "データ移行実行"}
              </button>
            </div>
          </div>
        )}

        {/* 完了 */}
        {currentStep === "complete" && (
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-4">✅ データ移行完了</h2>
            <p className="mb-6">すべてのデータがPostgreSQLに移行されました。</p>
            <a href="/admin" className="bg-blue-600 px-6 py-2 rounded inline-block">
              管理画面に戻る
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
