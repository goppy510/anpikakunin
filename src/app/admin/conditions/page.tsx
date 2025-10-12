"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";

interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
}

interface Prefecture {
  id: number;
  code: string;
  name: string;
  region: string;
}

interface IntensityScale {
  id: number;
  value: string;
  displayName: string;
  shortName: string;
}

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface NotificationCondition {
  id: string;
  minIntensity: string;
  targetPrefectures: string[];
  channelId: string;
  isEnabled: boolean;
}

export default function ConditionsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);
  const [intensityScales, setIntensityScales] = useState<IntensityScale[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [condition, setCondition] = useState<NotificationCondition | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");

  const [formData, setFormData] = useState({
    minIntensity: "",
    targetPrefectures: [] as string[],
    channelId: "",
  });

  useEffect(() => {
    loadWorkspaces();
    loadPrefectures();
    loadIntensityScales();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      loadCondition();
      loadChannels();
    }
  }, [selectedWorkspace]);

  const loadWorkspaces = async () => {
    try {
      const response = await fetch("/api/slack/workspaces");
      if (response.ok) {
        const data = await response.json();
        const workspaceList = data.workspaces || [];
        setWorkspaces(workspaceList);
        if (workspaceList.length > 0) {
          setSelectedWorkspace(workspaceList[0].workspaceId);
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadPrefectures = async () => {
    try {
      const response = await fetch("/api/prefectures");
      if (response.ok) {
        const data = await response.json();
        setPrefectures(data);
      }
    } catch (error) {
    }
  };

  const loadIntensityScales = async () => {
    try {
      const response = await fetch("/api/intensity-scales");
      if (response.ok) {
        const data = await response.json();
        setIntensityScales(data);
      }
    } catch (error) {
    }
  };

  const loadChannels = async () => {
    try {
      const response = await fetch(`/api/slack/channels?workspaceId=${selectedWorkspace}`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      } else {
        const text = await response.text();
        let errorMessage = "チャンネルの取得に失敗しました";
        try {
          const error = JSON.parse(text);
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // JSON parse failed, use text as is
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("チャンネルの取得に失敗しました");
    }
  };

  const loadCondition = async () => {
    try {
      const response = await fetch(`/api/notification-conditions?workspaceId=${selectedWorkspace}`);
      if (response.ok) {
        const data = await response.json();
        setCondition(data);
        if (data) {
          setFormData({
            minIntensity: data.minIntensity,
            targetPrefectures: data.targetPrefectures,
            channelId: data.channelId,
          });
        }
      }
    } catch (error) {
    }
  };

  const handleSave = async () => {
    if (!formData.minIntensity || !formData.channelId) {
      toast.error("最小震度と通知チャンネルを選択してください");
      return;
    }

    try {
      const response = await fetch("/api/notification-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: selectedWorkspace,
          ...formData,
        }),
      });

      if (response.ok) {
        toast.success("通知条件を保存しました");
        setIsEditing(false);
        await loadCondition();
      } else {
        const error = await response.json();
        toast.error(error.error || "保存に失敗しました");
      }
    } catch (error) {
      toast.error("保存に失敗しました");
    }
  };

  const togglePrefecture = (prefCode: string) => {
    setFormData((prev) => ({
      ...prev,
      targetPrefectures: prev.targetPrefectures.includes(prefCode)
        ? prev.targetPrefectures.filter((p) => p !== prefCode)
        : [...prev.targetPrefectures, prefCode],
    }));
  };

  const selectAllPrefectures = () => {
    setFormData((prev) => ({
      ...prev,
      targetPrefectures: prefectures.map((p) => p.code),
    }));
  };

  const clearAllPrefectures = () => {
    setFormData((prev) => ({
      ...prev,
      targetPrefectures: [],
    }));
  };

  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

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
        <h2 className="text-2xl font-bold">通知条件</h2>
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

      {/* ワークスペース選択 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <label className="block mb-2 text-sm font-semibold">ワークスペース</label>
        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="w-full bg-gray-700 p-2 rounded"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.workspaceId}>
              {ws.name}
            </option>
          ))}
        </select>
      </div>

      {/* 通知条件設定 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">通知条件設定</h3>
          {!isEditing && condition && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              編集
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* 最小震度 */}
          <div>
            <label className="block mb-2 text-sm font-semibold">最小震度</label>
            <select
              value={formData.minIntensity}
              onChange={(e) => setFormData({ ...formData, minIntensity: e.target.value })}
              className="w-full bg-gray-700 p-2 rounded"
              disabled={!isEditing && condition !== null}
            >
              <option value="">選択してください</option>
              {intensityScales.map((scale) => (
                <option key={scale.id} value={scale.value}>
                  {scale.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* 通知チャンネル */}
          <div>
            <label className="block mb-2 text-sm font-semibold">通知チャンネル</label>
            {isEditing || !condition ? (
              <>
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="チャンネル名で検索..."
                  className="w-full bg-gray-700 p-2 rounded mb-2"
                />
                <select
                  value={formData.channelId || ""}
                  onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded max-h-60 overflow-y-auto"
                  size={10}
                >
                  <option value="">選択してください</option>
                  {filteredChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name} {channel.isPrivate ? "🔒" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  表示中: {filteredChannels.length}件 / 全{channels.length}件
                </p>
              </>
            ) : (
              <div className="w-full bg-gray-700 p-3 rounded">
                {formData.channelId ? (
                  <span>
                    #{channels.find((ch) => ch.id === formData.channelId)?.name || formData.channelId}
                  </span>
                ) : (
                  <span className="text-gray-400">未設定</span>
                )}
              </div>
            )}
          </div>

          {/* 対象都道府県 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">対象都道府県</label>
              {(isEditing || !condition) && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAllPrefectures}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    すべて選択
                  </button>
                  <button
                    onClick={clearAllPrefectures}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    クリア
                  </button>
                </div>
              )}
            </div>
            <div className="bg-gray-700 p-4 rounded max-h-64 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2">
                {prefectures.map((pref) => (
                  <label
                    key={pref.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      formData.targetPrefectures.includes(pref.code)
                        ? "bg-blue-600"
                        : "bg-gray-800 hover:bg-gray-750"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.targetPrefectures.includes(pref.code)}
                      onChange={() => togglePrefecture(pref.code)}
                      disabled={!isEditing && condition !== null}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{pref.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              選択: {formData.targetPrefectures.length}件 / 全{prefectures.length}件
            </p>
          </div>

          {/* 保存ボタン */}
          {(isEditing || !condition) && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
              >
                保存
              </button>
              {isEditing && condition && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      minIntensity: condition.minIntensity,
                      targetPrefectures: condition.targetPrefectures,
                      channelId: condition.channelId,
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  キャンセル
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
