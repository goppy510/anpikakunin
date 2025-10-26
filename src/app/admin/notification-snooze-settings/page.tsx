"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { usePermissions } from "@/app/lib/hooks/usePermissions";

interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
}

interface SnoozeConfig {
  id: string;
  workspaceRef: string;
  durationHours: number;
  workspace: {
    id: string;
    name: string;
  };
}

export default function NotificationSnoozeSettingsPage() {
  const { hasPermission } = usePermissions();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [durationHours, setDurationHours] = useState<number>(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      loadSnoozeConfig();
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
          setSelectedWorkspace(workspaceList[0].id);
        }
      }
    } catch (error) {
      console.error("ワークスペース取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSnoozeConfig = async () => {
    try {
      const response = await fetch("/api/admin/notification-snooze-config");
      if (response.ok) {
        const data = await response.json();
        const config = data.configs.find(
          (c: SnoozeConfig) => c.workspaceRef === selectedWorkspace
        );
        if (config) {
          setDurationHours(config.durationHours);
        } else {
          setDurationHours(24); // デフォルト値
        }
      }
    } catch (error) {
      console.error("スヌーズ設定取得エラー:", error);
    }
  };

  const handleSave = async () => {
    if (!selectedWorkspace) {
      toast.error("ワークスペースを選択してください");
      return;
    }

    if (durationHours <= 0 || durationHours > 168) {
      toast.error("スヌーズ時間は1〜168時間（7日間）の範囲で設定してください");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/notification-snooze-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceRef: selectedWorkspace,
          durationHours,
        }),
      });

      if (response.ok) {
        toast.success("スヌーズ設定を保存しました");
      } else {
        const data = await response.json();
        toast.error(data.error || "保存に失敗しました");
      }
    } catch (error) {
      console.error("保存エラー:", error);
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  const canConfigSnooze = hasPermission("notification:snooze:config");

  if (!canConfigSnooze) {
    return (
      <div className="p-6">
        <Toaster position="top-right" />
        <div className="bg-red-900 text-red-200 p-4 rounded">
          スヌーズ設定を編集する権限がありません
        </div>
      </div>
    );
  }

  const selectedWorkspaceName = workspaces.find(
    (w) => w.id === selectedWorkspace
  )?.name;

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">通知スヌーズ設定</h1>
        <p className="text-gray-400 mt-2">
          通知を一時停止する時間（スヌーズ）を設定します
        </p>
      </div>

      {workspaces.length === 0 ? (
        <div className="bg-yellow-900 text-yellow-200 p-4 rounded">
          Slackワークスペースが登録されていません
        </div>
      ) : (
        <div className="bg-gray-800 p-6 rounded-lg shadow">
          <div className="space-y-6">
            {/* ワークスペース選択 */}
            <div>
              <label
                htmlFor="workspace"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                ワークスペース
              </label>
              <select
                id="workspace"
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>

            {/* スヌーズ時間設定 */}
            <div>
              <label
                htmlFor="duration"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                スヌーズ時間（時間単位）
              </label>
              <input
                id="duration"
                type="number"
                min="1"
                max="168"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-400 text-sm mt-2">
                1〜168時間（7日間）の範囲で設定できます
              </p>
            </div>

            {/* 保存ボタン */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
