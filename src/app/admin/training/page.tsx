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

type NotificationChannel = {
  id: string;
  channelId: string;
  channelName: string;
  purpose: string;
};

export default function TrainingModePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [sendType, setSendType] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadChannels();
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
    try {
      // 内部IDを取得
      const workspace = workspaces.find(w => w.workspaceId === selectedWorkspaceId);
      if (!workspace) return;

      const response = await axios.get(`/api/notification-channels?workspaceId=${workspace.id}`);
      setChannels(response.data.channels || []);
      const defaultChannel = response.data.channels?.find((c: NotificationChannel) =>
        c.purpose === "earthquake" || c.purpose === "safety_confirmation"
      );
      if (defaultChannel) {
        setSelectedChannel(defaultChannel.channelId);
      }
    } catch (error) {
      console.error("チャンネル取得エラー:", error);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await axios.get(`/api/departments?workspaceId=${selectedWorkspaceId}`);
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error("部署取得エラー:", error);
    }
  };

  const loadTemplate = async () => {
    try {
      const response = await axios.get(`/api/message-templates?workspaceId=${selectedWorkspaceId}`);
      const templates = response.data || [];
      const trainingTemplate = templates.find((t: MessageTemplate) => t.type === "TRAINING");
      setTemplate(trainingTemplate || null);
    } catch (error) {
      console.error("テンプレート取得エラー:", error);
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
            {selectedWorkspace && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  送信先チャンネル
                </label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">選択してください</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.channelId}>
                      #{ch.channelName}
                    </option>
                  ))}
                </select>
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
          </div>
        </div>

        {/* プレビューカード */}
        {selectedWorkspaceId && template && (
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
                    {dept.slackEmoji} {dept.name}
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
