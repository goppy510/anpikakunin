"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { usePermissions } from "@/app/lib/hooks/usePermissions";

interface SnoozeStatus {
  snoozed: boolean;
  snooze?: {
    id: string;
    snoozedBy: string;
    snoozedAt: string;
    expiresAt: string;
  };
}

interface Workspace {
  id: string;
  name: string;
}

export function SnoozeButton() {
  const { hasPermission } = usePermissions();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [snoozeStatus, setSnoozeStatus] = useState<SnoozeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  const canSnooze = hasPermission("notification:snooze");

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      loadSnoozeStatus();
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (snoozeStatus?.snoozed && snoozeStatus.snooze) {
      const interval = setInterval(() => {
        const now = new Date();
        const expiresAt = new Date(snoozeStatus.snooze!.expiresAt);
        const diff = expiresAt.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining("期限切れ");
          loadSnoozeStatus(); // 再取得してステータス更新
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeRemaining(`${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [snoozeStatus]);

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
    }
  };

  const loadSnoozeStatus = async () => {
    if (!selectedWorkspace) return;

    try {
      const response = await fetch(
        `/api/admin/notification-snooze?workspaceRef=${selectedWorkspace}`
      );
      if (response.ok) {
        const data = await response.json();
        setSnoozeStatus(data);
      }
    } catch (error) {
      console.error("スヌーズ状態取得エラー:", error);
    }
  };

  const handleToggleSnooze = async () => {
    if (!selectedWorkspace) {
      toast.error("ワークスペースを選択してください");
      return;
    }

    setLoading(true);
    try {
      if (snoozeStatus?.snoozed) {
        // スヌーズ解除
        const response = await fetch(
          `/api/admin/notification-snooze?workspaceRef=${selectedWorkspace}`,
          { method: "DELETE" }
        );

        if (response.ok) {
          toast.success("通知を再開しました");
          setSnoozeStatus({ snoozed: false });
        } else {
          const data = await response.json();
          toast.error(data.error || "解除に失敗しました");
        }
      } else {
        // スヌーズ実行
        const response = await fetch("/api/admin/notification-snooze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceRef: selectedWorkspace }),
        });

        if (response.ok) {
          const data = await response.json();
          toast.success("通知をスヌーズしました");
          setSnoozeStatus({
            snoozed: true,
            snooze: data.snooze,
          });
        } else {
          const data = await response.json();
          toast.error(data.error || "スヌーズに失敗しました");
        }
      }
    } catch (error) {
      console.error("スヌーズ操作エラー:", error);
      toast.error("操作に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (!canSnooze || workspaces.length === 0) {
    return null;
  }

  const isSnoozed = snoozeStatus?.snoozed;

  return (
    <div className="flex items-center gap-3">
      {workspaces.length > 1 && (
        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={handleToggleSnooze}
        disabled={loading}
        className={`px-4 py-2 rounded font-medium transition-colors ${
          isSnoozed
            ? "bg-yellow-600 hover:bg-yellow-700 text-white"
            : "bg-red-600 hover:bg-red-700 text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
        title={isSnoozed ? "通知を再開" : "通知を一時停止"}
      >
        <i className={`fa-solid ${isSnoozed ? "fa-bell" : "fa-bell-slash"}`}></i>
        {loading ? (
          "処理中..."
        ) : isSnoozed ? (
          <span>
            スヌーズ中 {timeRemaining && `(${timeRemaining})`}
          </span>
        ) : (
          "通知スヌーズ"
        )}
      </button>
    </div>
  );
}
