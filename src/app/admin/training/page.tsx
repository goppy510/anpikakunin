"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

type Department = {
  id: string;
  name: string;
  slackEmoji: string;
  buttonColor: string;
  displayOrder: number;
};

type MessageTemplate = {
  id: string;
  type: "PRODUCTION" | "TRAINING";
  title: string;
  body: string;
};

type Workspace = {
  id: string;
  name: string;
  workspaceId: string;
};

type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
};

export default function TrainingModePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [channelSearch, setChannelSearch] = useState<string>("");
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [sendType, setSendType] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ title: "", body: "" });

  // 地震情報入力フォーム
  const [earthquakeInfo, setEarthquakeInfo] = useState({
    epicenter: "訓練震源地",
    maxIntensity: "震度5強",
    magnitude: "M6.5",
    depth: "10km",
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadDepartments();
      loadTemplate();
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const response = await axios.get("/api/workspaces");
      setWorkspaces(response.data.workspaces || []);
      if (response.data.workspaces?.length > 0) {
        setSelectedWorkspaceId(response.data.workspaces[0].workspaceId);
      }
    } catch (error) {
      console.error("ワークスペース取得エラー:", error);
      toast.error("ワークスペース取得に失敗しました");
    }
  };

  const loadChannels = async () => {
    if (channelsLoading || !selectedWorkspaceId) return;

    try {
      setChannelsLoading(true);
      // 保存済みのnotification_channelsから取得（高速）
      const response = await axios.get(`/api/notification-channels?workspaceId=${selectedWorkspaceId}`);
      setChannels(response.data.channels || []);
    } catch (error) {
      console.error("チャンネル取得エラー:", error);
      toast.error("チャンネルの取得に失敗しました");
    } finally {
      setChannelsLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await axios.get(`/api/departments?workspaceId=${selectedWorkspaceId}`);
      // APIは配列を直接返す
      setDepartments(response.data || []);
    } catch (error) {
      console.error("部署取得エラー:", error);
      toast.error("部署の取得に失敗しました");
    }
  };

  const loadTemplate = async () => {
    try {
      const response = await axios.get(`/api/message-templates?workspaceId=${selectedWorkspaceId}`);
      const templates = response.data || [];
      const trainingTemplate = templates.find((t: MessageTemplate) => t.type === "TRAINING");
      setTemplate(trainingTemplate || null);
      if (trainingTemplate) {
        setTemplateForm({
          title: trainingTemplate.title,
          body: trainingTemplate.body,
        });
      }
    } catch (error) {
      console.error("テンプレート取得エラー:", error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedWorkspaceId) {
      toast.error("ワークスペースを選択してください");
      return;
    }

    if (!templateForm.title || !templateForm.body) {
      toast.error("タイトルと本文を入力してください");
      return;
    }

    try {
      await axios.post("/api/message-templates", {
        workspaceId: selectedWorkspaceId,
        training: {
          title: templateForm.title,
          body: templateForm.body,
        },
      });

      toast.success("テンプレートを保存しました");
      setEditingTemplate(false);
      await loadTemplate();
    } catch (error: any) {
      console.error("テンプレート保存エラー:", error);
      const errorMsg = error.response?.data?.error || "テンプレート保存に失敗しました";
      toast.error(errorMsg);
    }
  };

  const handleSendTraining = async () => {
    if (!selectedWorkspaceId) {
      toast.error("ワークスペースを選択してください");
      return;
    }

    if (!selectedChannel) {
      toast.error("チャンネルを選択してください");
      return;
    }

    if (departments.length === 0) {
      toast.error("部署が設定されていません");
      return;
    }

    if (sendType === "scheduled" && !scheduledTime) {
      toast.error("送信時刻を指定してください");
      return;
    }

    try {
      setSending(true);

      // 内部IDを取得
      const workspace = workspaces.find(w => w.workspaceId === selectedWorkspaceId);
      if (!workspace) {
        toast.error("ワークスペースが見つかりません");
        return;
      }

      const response = await axios.post("/api/training/send", {
        workspaceId: workspace.id,
        channelId: selectedChannel,
        scheduledAt: sendType === "scheduled" ? new Date(scheduledTime).toISOString() : null,
        earthquakeInfo,
      });

      if (sendType === "immediate") {
        toast.success("訓練通知を送信しました");
      } else {
        toast.success(`訓練通知を ${scheduledTime} にスケジュールしました`);
      }

      // フォームをリセット
      setSendType("immediate");
      setScheduledTime("");
    } catch (error: any) {
      console.error("訓練通知送信エラー:", error);
      const errorMsg = error.response?.data?.error || "訓練通知送信に失敗しました";
      toast.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-white mb-6">訓練モード</h1>

        {/* 説明カード */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-info-circle text-blue-400 text-xl mt-1"></i>
            <div>
              <h3 className="text-blue-300 font-bold mb-2">訓練モードについて</h3>
              <p className="text-blue-200 text-sm mb-2">
                訓練モードでは、実際の地震とは関係なく、安否確認通知を送信できます。
              </p>
              <ul className="text-blue-200 text-sm space-y-1 list-disc list-inside">
                <li>訓練用のメッセージテンプレートを使用します</li>
                <li>部署ボタンは本番と同じものを使用します</li>
                <li>手動送信または時刻指定での送信が可能です</li>
                <li>押した人のデータは訓練応答履歴で確認できます</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 設定カード */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">送信設定</h2>

          <div className="space-y-4">
            {/* ワークスペース選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ワークスペース
              </label>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">選択してください</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.workspaceId}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>

            {/* チャンネル選択 */}
            {selectedWorkspaceId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  送信先チャンネル
                </label>
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  onFocus={loadChannels}
                  placeholder="チャンネル名で検索..."
                  className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-2"
                />
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none max-h-60 overflow-y-auto"
                  size={10}
                >
                  <option value="">選択してください</option>
                  {channels
                    .filter((ch) => ch.name.toLowerCase().includes(channelSearch.toLowerCase()))
                    .map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name} {ch.isPrivate ? "🔒" : ""}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  表示中: {channels.filter((ch) => ch.name.toLowerCase().includes(channelSearch.toLowerCase())).length}件 / 全{channels.length}件
                </p>
              </div>
            )}

            {/* 送信タイプ選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                送信タイプ
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="immediate"
                    checked={sendType === "immediate"}
                    onChange={(e) => setSendType(e.target.value as "immediate" | "scheduled")}
                    className="mr-2"
                  />
                  <span className="text-gray-300">即座に送信</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="scheduled"
                    checked={sendType === "scheduled"}
                    onChange={(e) => setSendType(e.target.value as "immediate" | "scheduled")}
                    className="mr-2"
                  />
                  <span className="text-gray-300">時刻指定</span>
                </label>
              </div>
            </div>

            {/* スケジュール時刻選択 */}
            {sendType === "scheduled" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  送信時刻
                </label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* 地震情報入力 */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-md font-semibold text-gray-200 mb-3">訓練地震情報設定</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    震源地
                  </label>
                  <input
                    type="text"
                    value={earthquakeInfo.epicenter}
                    onChange={(e) => setEarthquakeInfo({ ...earthquakeInfo, epicenter: e.target.value })}
                    className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="例: 東京都23区"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    最大震度
                  </label>
                  <select
                    value={earthquakeInfo.maxIntensity}
                    onChange={(e) => setEarthquakeInfo({ ...earthquakeInfo, maxIntensity: e.target.value })}
                    className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="震度1">震度1</option>
                    <option value="震度2">震度2</option>
                    <option value="震度3">震度3</option>
                    <option value="震度4">震度4</option>
                    <option value="震度5弱">震度5弱</option>
                    <option value="震度5強">震度5強</option>
                    <option value="震度6弱">震度6弱</option>
                    <option value="震度6強">震度6強</option>
                    <option value="震度7">震度7</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    マグニチュード
                  </label>
                  <input
                    type="text"
                    value={earthquakeInfo.magnitude}
                    onChange={(e) => setEarthquakeInfo({ ...earthquakeInfo, magnitude: e.target.value })}
                    className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="例: M6.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    震源の深さ
                  </label>
                  <input
                    type="text"
                    value={earthquakeInfo.depth}
                    onChange={(e) => setEarthquakeInfo({ ...earthquakeInfo, depth: e.target.value })}
                    className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="例: 10km"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* テンプレート編集カード */}
        {selectedWorkspaceId && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">訓練用メッセージテンプレート</h2>
              {!editingTemplate && (
                <button
                  onClick={() => setEditingTemplate(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  {template ? "編集" : "作成"}
                </button>
              )}
            </div>

            {editingTemplate ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    タイトル
                  </label>
                  <input
                    type="text"
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                    className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="例: 【訓練】安否確認"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    本文
                  </label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                    className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    rows={6}
                    placeholder="例: これは訓練です。&#10;&#10;発生時刻: {{occurrenceTime}}&#10;震源地: {{epicenter}}&#10;最大震度: {{maxIntensity}}&#10;マグニチュード: {{magnitude}}&#10;深さ: {{depth}}"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    利用可能な変数: {"{"}{"{"} epicenter {"}"}{"}"}, {"{"}{"{"} maxIntensity {"}"}{"}"}, {"{"}{"{"} occurrenceTime {"}"}{"}"}, {"{"}{"{"} magnitude {"}"}{"}"}, {"{"}{"{"} depth {"}"}{"}"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditingTemplate(false);
                      if (template) {
                        setTemplateForm({
                          title: template.title,
                          body: template.body,
                        });
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : template ? (
              <div className="bg-gray-900 rounded-lg p-4">
                <h3 className="text-white font-bold mb-2">{template.title}</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{template.body}</p>
              </div>
            ) : (
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-gray-400">テンプレートが設定されていません</p>
                <p className="text-gray-500 text-sm mt-1">「作成」ボタンから設定してください</p>
              </div>
            )}
          </div>
        )}

        {/* プレビューカード */}
        {selectedWorkspaceId && template && !editingTemplate && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">送信内容プレビュー</h2>

            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <h3 className="text-white font-bold mb-2">{template.title}</h3>
              <p className="text-gray-300 whitespace-pre-wrap mb-4">{template.body}</p>

              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    className="px-4 py-2 rounded text-white"
                    style={{ backgroundColor: dept.buttonColor }}
                    disabled
                  >
                    {dept.slackEmoji}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-gray-400">
              ※ 実際にはSlack Block Kit形式で送信されます
            </p>
          </div>
        )}

        {/* 送信ボタン */}
        <div className="flex justify-end gap-4">
          <button
            onClick={handleSendTraining}
            disabled={sending || !selectedWorkspaceId || !selectedChannel}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>{sendType === "immediate" ? "送信中..." : "スケジュール中..."}</span>
              </>
            ) : (
              <>
                <i className={sendType === "immediate" ? "fa-solid fa-paper-plane" : "fa-solid fa-clock"}></i>
                <span>{sendType === "immediate" ? "今すぐ送信" : "スケジュール"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
