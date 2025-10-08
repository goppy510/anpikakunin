"use client";

import { useState } from "react";

type SetupStep = "connect" | "departments" | "notification" | "messages" | "complete";

type Emoji = {
  name: string;
  url: string;
};

type Channel = {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
};

export default function SlackSetupPage() {
  const [currentStep, setCurrentStep] = useState<SetupStep>("connect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ステップ1: 接続
  const [botToken, setBotToken] = useState("");
  const [workspace, setWorkspace] = useState<any>(null);

  // ステップ2: 部署設定
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [departments, setDepartments] = useState<
    Array<{ name: string; emojiName: string; color: string }>
  >([]);
  const [newDept, setNewDept] = useState({ name: "", emojiName: "", color: "#5B8FF9" });
  const [emojiSearch, setEmojiSearch] = useState("");

  // ステップ3: 通知設定
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [minIntensity, setMinIntensity] = useState("5-");
  const [targetPrefectures, setTargetPrefectures] = useState<string[]>([]);

  // ステップ4: メッセージ設定
  const [messages, setMessages] = useState({
    productionTitle: "🚨 地震発生通知",
    productionBody: "",
    trainingTitle: "【訓練です】🚨 地震発生通知【訓練です】",
    trainingBody: "",
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");

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

  // ステップ1: Slack接続テスト
  const handleTestConnection = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/slack/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "接続に失敗しました");
        return;
      }

      setWorkspace(data.workspace);

      // 絵文字とチャンネルを取得
      await Promise.all([fetchEmojis(), fetchChannels()]);

      setCurrentStep("departments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "接続エラー");
    } finally {
      setLoading(false);
    }
  };

  // 絵文字一覧取得
  const fetchEmojis = async () => {
    const res = await fetch(`/api/slack/emoji?botToken=${encodeURIComponent(botToken)}`);
    const data = await res.json();
    if (data.emojis) {
      setEmojis(data.emojis);
    }
  };

  // チャンネル一覧取得
  const fetchChannels = async () => {
    const res = await fetch(`/api/slack/channels?botToken=${encodeURIComponent(botToken)}`);
    const data = await res.json();
    if (data.channels) {
      setChannels(data.channels);
    }
  };

  // 部署追加
  const addDepartment = () => {
    if (newDept.name && newDept.emojiName) {
      setDepartments([...departments, newDept]);
      setNewDept({ name: "", emojiName: "", color: "#5B8FF9" });
      setEmojiSearch("");
    }
  };

  // 都道府県トグル
  const togglePrefecture = (pref: string) => {
    setTargetPrefectures((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  // 最終保存
  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. ワークスペース登録
      const workspaceRes = await fetch("/api/slack/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: {
            workspaceId: workspace.id,
            name: workspace.name,
            botToken,
          },
        }),
      });

      if (!workspaceRes.ok) {
        const errorData = await workspaceRes.json();
        throw new Error(errorData.error || "ワークスペース登録失敗");
      }

      const savedWorkspace = await workspaceRes.json();

      // 2. 部署登録
      for (const dept of departments) {
        await fetch("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: savedWorkspace.workspaceId,
            name: dept.name,
            slackEmoji: `:${dept.emojiName}:`,
            buttonColor: dept.color,
          }),
        });
      }

      // 3. 通知条件登録
      await fetch("/api/earthquake-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: savedWorkspace.workspaceId,
          minIntensity,
          targetPrefectures,
          notificationChannel: selectedChannel,
        }),
      });

      // 4. メッセージテンプレート登録
      await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: savedWorkspace.workspaceId,
          production: {
            title: messages.productionTitle,
            body: messages.productionBody,
          },
          training: {
            title: messages.trainingTitle,
            body: messages.trainingBody,
          },
        }),
      });

      // 5. スプレッドシートURL登録
      if (spreadsheetUrl) {
        await fetch("/api/spreadsheet-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: savedWorkspace.workspaceId,
            spreadsheetUrl,
          }),
        });
      }

      setCurrentStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const filteredEmojis = emojis.filter((emoji) =>
    emoji.name.toLowerCase().includes(emojiSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Slackワークスペース設定</h1>

        {/* ステップインジケーター */}
        <div className="flex gap-4 mb-8">
          {["connect", "departments", "notification", "messages", "complete"].map((step) => (
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

        {/* ステップ1: Slack接続 */}
        {currentStep === "connect" && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">1. Slackワークスペースに接続</h2>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Bot Token</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="xoxb-..."
                />
                <p className="text-sm text-gray-400 mt-2">
                  必要な権限: emoji:read, channels:read, chat:write
                </p>
              </div>
              <button
                onClick={handleTestConnection}
                disabled={!botToken || loading}
                className="bg-blue-600 px-6 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
              >
                {loading ? "接続中..." : "接続テスト"}
              </button>
            </div>
          </div>
        )}

        {/* ステップ2: 部署設定 */}
        {currentStep === "departments" && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">
              2. 部署スタンプ設定 - {workspace?.name}
            </h2>

            {/* 絵文字検索 */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="絵文字を検索..."
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                className="w-full bg-gray-700 p-2 rounded"
              />
            </div>

            {/* 絵文字一覧 */}
            <div className="bg-gray-900 p-4 rounded max-h-64 overflow-y-auto mb-6">
              <div className="grid grid-cols-8 gap-2">
                {filteredEmojis.slice(0, 48).map((emoji) => (
                  <button
                    key={emoji.name}
                    onClick={() => setNewDept({ ...newDept, emojiName: emoji.name })}
                    className={`p-2 rounded hover:bg-gray-700 ${
                      newDept.emojiName === emoji.name ? "bg-blue-600" : ""
                    }`}
                    title={emoji.name}
                  >
                    <img src={emoji.url} alt={emoji.name} className="w-8 h-8" />
                  </button>
                ))}
              </div>
            </div>

            {/* 部署追加フォーム */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="部署名"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="flex-1 bg-gray-700 p-2 rounded"
                />
                <input
                  type="text"
                  placeholder="絵文字名"
                  value={newDept.emojiName}
                  onChange={(e) => setNewDept({ ...newDept, emojiName: e.target.value })}
                  className="flex-1 bg-gray-700 p-2 rounded"
                />
                <input
                  type="color"
                  value={newDept.color}
                  onChange={(e) => setNewDept({ ...newDept, color: e.target.value })}
                  className="w-20 bg-gray-700 rounded"
                />
                <button
                  onClick={addDepartment}
                  className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
                >
                  追加
                </button>
              </div>
            </div>

            {/* 登録済み部署一覧 */}
            <div className="space-y-2 mb-6">
              {departments.map((dept, i) => (
                <div key={i} className="flex items-center gap-4 bg-gray-700 p-3 rounded">
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="flex-1">{dept.name}</span>
                  <span className="text-gray-400">:{dept.emojiName}:</span>
                  <button
                    onClick={() => setDepartments(departments.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-300"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentStep("connect")}
                className="bg-gray-600 px-6 py-2 rounded hover:bg-gray-700"
              >
                戻る
              </button>
              <button
                onClick={() => setCurrentStep("notification")}
                disabled={departments.length === 0}
                className="bg-blue-600 px-6 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* ステップ3: 通知設定 */}
        {currentStep === "notification" && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">3. 地震通知設定</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block mb-2">通知先チャンネル</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded"
                >
                  <option value="">選択してください</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name} {channel.isPrivate ? "🔒" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2">最小震度</label>
                <select
                  value={minIntensity}
                  onChange={(e) => setMinIntensity(e.target.value)}
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
                        targetPrefectures.includes(pref) ? "bg-blue-600" : "bg-gray-700"
                      }`}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentStep("departments")}
                className="bg-gray-600 px-6 py-2 rounded hover:bg-gray-700"
              >
                戻る
              </button>
              <button
                onClick={() => setCurrentStep("messages")}
                disabled={!selectedChannel}
                className="bg-blue-600 px-6 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* ステップ4: メッセージ設定 */}
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
                  onChange={(e) =>
                    setMessages({ ...messages, productionTitle: e.target.value })
                  }
                  className="w-full bg-gray-700 p-2 rounded mb-2"
                />
                <textarea
                  placeholder="本文"
                  value={messages.productionBody}
                  onChange={(e) =>
                    setMessages({ ...messages, productionBody: e.target.value })
                  }
                  className="w-full bg-gray-700 p-2 rounded h-32"
                />
              </div>

              <div>
                <h3 className="font-bold mb-2">訓練用メッセージ</h3>
                <input
                  type="text"
                  placeholder="タイトル"
                  value={messages.trainingTitle}
                  onChange={(e) =>
                    setMessages({ ...messages, trainingTitle: e.target.value })
                  }
                  className="w-full bg-gray-700 p-2 rounded mb-2"
                />
                <textarea
                  placeholder="本文"
                  value={messages.trainingBody}
                  onChange={(e) =>
                    setMessages({ ...messages, trainingBody: e.target.value })
                  }
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
              <button
                onClick={() => setCurrentStep("notification")}
                className="bg-gray-600 px-6 py-2 rounded hover:bg-gray-700"
              >
                戻る
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-green-600 px-6 py-2 rounded disabled:opacity-50 hover:bg-green-700"
              >
                {loading ? "保存中..." : "保存して完了"}
              </button>
            </div>
          </div>
        )}

        {/* 完了 */}
        {currentStep === "complete" && (
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-4">✅ 設定完了</h2>
            <p className="mb-6">Slackワークスペースの設定が完了しました。</p>
            <a href="/admin" className="bg-blue-600 px-6 py-2 rounded inline-block hover:bg-blue-700">
              管理画面に戻る
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
