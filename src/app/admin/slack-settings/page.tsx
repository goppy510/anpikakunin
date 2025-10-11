"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
}

interface NotificationChannel {
  id: string;
  channelId: string;
  channelName: string;
  purpose: string;
  isActive: boolean;
}

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export default function SlackSettingsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState({
    channelId: "",
    purpose: "earthquake" as "earthquake" | "safety_confirmation" | "general",
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadChannels();
      loadSlackChannels();
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const response = await axios.get("/api/workspaces");
      const workspaceList = response.data.workspaces || [];
      setWorkspaces(workspaceList);
      if (workspaceList.length > 0) {
        setSelectedWorkspaceId(workspaceList[0].workspaceId);
      }
    } catch (error) {
      console.error("ワークスペース取得エラー:", error);
      toast.error("ワークスペースの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      const workspace = workspaces.find((w) => w.workspaceId === selectedWorkspaceId);
      if (!workspace) return;

      const response = await axios.get(`/api/notification-channels?workspaceId=${workspace.id}`);
      setChannels(response.data.channels || []);
    } catch (error) {
      console.error("チャンネル取得エラー:", error);
      toast.error("チャンネルの取得に失敗しました");
    }
  };

  const loadSlackChannels = async () => {
    try {
      const response = await axios.get(`/api/slack/channels?workspaceId=${selectedWorkspaceId}`);
      setSlackChannels(response.data.channels || []);
    } catch (error) {
      console.error("Slackチャンネル取得エラー:", error);
      toast.error("Slackチャンネルの取得に失敗しました");
    }
  };

  const handleAdd = async () => {
    if (!formData.channelId) {
      toast.error("チャンネルを選択してください");
      return;
    }

    try {
      const workspace = workspaces.find((w) => w.workspaceId === selectedWorkspaceId);
      if (!workspace) return;

      const selectedSlackChannel = slackChannels.find((ch) => ch.id === formData.channelId);
      if (!selectedSlackChannel) return;

      await axios.post("/api/notification-channels", {
        workspaceId: workspace.id,
        channelId: formData.channelId,
        channelName: selectedSlackChannel.name,
        purpose: formData.purpose,
      });

      toast.success("チャンネルを追加しました");
      setShowAddForm(false);
      setFormData({ channelId: "", purpose: "earthquake" });
      loadChannels();
    } catch (error: any) {
      console.error("チャンネル追加エラー:", error);
      toast.error(error.response?.data?.error || "チャンネルの追加に失敗しました");
    }
  };

  const handleToggle = async (channelId: string, currentStatus: boolean) => {
    try {
      await axios.patch(`/api/notification-channels/${channelId}`, {
        isActive: !currentStatus,
      });

      toast.success(currentStatus ? "チャンネルを無効化しました" : "チャンネルを有効化しました");
      loadChannels();
    } catch (error) {
      console.error("ステータス変更エラー:", error);
      toast.error("ステータスの変更に失敗しました");
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!confirm("このチャンネルを削除しますか？")) return;

    try {
      await axios.delete(`/api/notification-channels/${channelId}`);
      toast.success("チャンネルを削除しました");
      loadChannels();
    } catch (error) {
      console.error("チャンネル削除エラー:", error);
      toast.error("チャンネルの削除に失敗しました");
    }
  };

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case "earthquake":
        return "地震情報";
      case "safety_confirmation":
        return "安否確認";
      case "general":
        return "一般";
      default:
        return purpose;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Slack設定</h2>
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">ワークスペースが登録されていません</p>
          <a
            href="/admin/workspaces"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded inline-block"
          >
            ワークスペースを追加
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Slack設定</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            チャンネルを追加
          </button>
        )}
      </div>

      {/* ワークスペース選択 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <label className="block mb-2 text-sm font-semibold">ワークスペース</label>
        <select
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.workspaceId}>
              {ws.name}
            </option>
          ))}
        </select>
      </div>

      {/* チャンネル追加フォーム */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">チャンネルを追加</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">チャンネル</label>
              <select
                value={formData.channelId}
                onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">選択してください</option>
                {slackChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name} {ch.isPrivate ? "🔒" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">用途</label>
              <select
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purpose: e.target.value as "earthquake" | "safety_confirmation" | "general",
                  })
                }
                className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="earthquake">地震情報</option>
                <option value="safety_confirmation">安否確認</option>
                <option value="general">一般</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
              >
                追加
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ channelId: "", purpose: "earthquake" });
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* チャンネル一覧 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">登録済みチャンネル</h3>
        {channels.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            チャンネルが登録されていません
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between bg-gray-700 p-4 rounded"
              >
                <div className="flex-1">
                  <div className="font-semibold">#{channel.channelName}</div>
                  <div className="text-sm text-gray-400">
                    {getPurposeLabel(channel.purpose)} •{" "}
                    {channel.isActive ? (
                      <span className="text-green-400">有効</span>
                    ) : (
                      <span className="text-red-400">無効</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(channel.id, channel.isActive)}
                    className={`px-3 py-1 rounded text-sm ${
                      channel.isActive
                        ? "bg-yellow-600 hover:bg-yellow-700"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {channel.isActive ? "無効化" : "有効化"}
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
