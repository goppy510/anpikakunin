"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SCOPE_DESCRIPTIONS } from "@/app/lib/slack/requiredScopes";

interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BotInfo {
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
}

interface BotData {
  botToken: string;
  botInfo: BotInfo;
  permissions: PermissionInfo;
}

interface PermissionInfo {
  granted: string[];
  required: string[];
  hasAllRequired: boolean;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [botInfoMap, setBotInfoMap] = useState<Record<string, BotData>>({});

  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const response = await fetch("/api/slack/workspaces");
        if (response.ok) {
          const data = await response.json();
          const workspaceList = data.workspaces || [];
          setWorkspaces(workspaceList);

          // 全ワークスペースのBot情報を取得
          for (const ws of workspaceList) {
            void loadBotInfo(ws.workspaceId);
          }
        }
      } catch (error) {
        console.error("Failed to load workspaces:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadWorkspaces();
  }, []);

  const loadBotInfo = async (workspaceId: string) => {
    if (botInfoMap[workspaceId]) return;

    try {
      const response = await fetch(`/api/slack/bot-info?workspaceId=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setBotInfoMap((prev) => ({
          ...prev,
          [workspaceId]: {
            botToken: data.botToken,
            botInfo: data.botInfo,
            permissions: data.permissions,
          },
        }));
      }
    } catch (error) {
      console.error("Failed to load bot info:", error);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ワークスペース管理</h2>
        <button
          onClick={() => router.push("/admin/slack-setup")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
        >
          + 新規追加
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">
            まだワークスペースが登録されていません
          </p>
          <button
            onClick={() => router.push("/admin/slack-setup")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded"
          >
            最初のワークスペースを追加
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {workspaces.map((workspace) => {
            const info = botInfoMap[workspace.workspaceId];

            return (
              <div
                key={workspace.id}
                className="bg-gray-800 rounded-lg p-6 border border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{workspace.name}</h3>
                      {workspace.isEnabled ? (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                          有効
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">
                          無効
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-400">
                      <p>ID: {workspace.workspaceId}</p>
                      <p>
                        登録日:{" "}
                        {new Date(workspace.createdAt).toLocaleDateString(
                          "ja-JP",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/admin/slack-setup?edit=${workspace.workspaceId}`)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      編集
                    </button>
                    <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm">
                      削除
                    </button>
                  </div>
                </div>

                {/* Bot情報と権限 - 常に表示 */}
                {info ? (
                  <div className="border-t border-gray-700 pt-4 space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Bot情報</h4>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>Bot名: {info.botInfo.userName}</p>
                        <p>Bot ID: {info.botInfo.userId}</p>
                        <p>チーム名: {info.botInfo.teamName}</p>
                        <p>Bot Token: <code className="bg-gray-700 px-2 py-1 rounded text-xs">{info.botToken}</code></p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">権限</h4>
                        {info.permissions.hasAllRequired ? (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                            ✓ 必要な権限あり
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
                            ⚠ 権限不足
                          </span>
                        )}
                      </div>
                      <div className="text-sm space-y-2">
                        <div>
                          <p className="text-gray-400 mb-1">必要な権限:</p>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {info.permissions.required.map((scope) => (
                              <span
                                key={scope}
                                className={`px-2 py-1 rounded text-xs ${
                                  info.permissions.granted.includes(scope)
                                    ? "bg-green-600 text-white"
                                    : "bg-red-600 text-white"
                                }`}
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            {info.permissions.required.map((scope) => (
                              SCOPE_DESCRIPTIONS[scope as keyof typeof SCOPE_DESCRIPTIONS] && (
                                <div key={`desc-${scope}`}>
                                  <span className="text-gray-400">{scope}:</span>{" "}
                                  {SCOPE_DESCRIPTIONS[scope as keyof typeof SCOPE_DESCRIPTIONS]}
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                        {info.permissions.granted.length > 0 && (
                          <div>
                            <p className="text-gray-400 mb-1">付与されている権限:</p>
                            <div className="flex flex-wrap gap-2">
                              {info.permissions.granted.map((scope) => (
                                <span
                                  key={scope}
                                  className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                                >
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-700 pt-4 text-center text-gray-400 text-sm">
                    Bot情報を読み込み中...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
