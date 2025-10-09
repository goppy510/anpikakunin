"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import { usePermissions } from "@/app/lib/hooks/usePermissions";

type Group = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  memberCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const { hasPermission } = usePermissions();

  // フォーム
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/groups");
      setGroups(res.data.groups || []);
    } catch (error) {
      console.error("グループ取得エラー:", error);
      toast.error("グループの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("グループ名を入力してください");
      return;
    }

    try {
      setCreating(true);
      await axios.post("/api/groups", {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast.success("グループを作成しました");
      setShowCreateModal(false);
      setName("");
      setDescription("");
      fetchGroups();
    } catch (error: any) {
      console.error("グループ作成エラー:", error);
      const errorMsg =
        error.response?.data?.error || "グループの作成に失敗しました";
      toast.error(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`グループ「${name}」を削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    try {
      await axios.delete(`/api/groups/${id}`);
      toast.success("グループを削除しました");
      fetchGroups();
    } catch (error: any) {
      console.error("グループ削除エラー:", error);
      const errorMsg =
        error.response?.data?.error || "グループの削除に失敗しました";
      toast.error(errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">グループ管理</h1>
          <p className="text-gray-400 mt-1">
            ユーザーグループと権限アタッチメントの管理
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!hasPermission("group:write")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + グループ作成
        </button>
      </div>

      {/* グループ一覧 */}
      {groups.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          <p>グループが登録されていません</p>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!hasPermission("group:write")}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            最初のグループを作成
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <Link href={`/admin/groups/${group.id}`}>
                      <h3 className="text-xl font-semibold hover:text-blue-400 cursor-pointer">
                        {group.name}
                      </h3>
                    </Link>
                    {!group.isActive && (
                      <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
                        無効
                      </span>
                    )}
                  </div>

                  {group.description && (
                    <p className="text-gray-400 mt-2">{group.description}</p>
                  )}

                  <div className="flex items-center space-x-6 mt-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-400">👥</span>
                      <span>{group.memberCount} メンバー</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400">🔑</span>
                      <span>{group.permissionCount} 権限</span>
                    </div>
                    <div className="text-gray-500">
                      作成日: {new Date(group.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link href={`/admin/groups/${group.id}`}>
                    <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded">
                      詳細
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(group.id, group.name)}
                    disabled={!hasPermission("group:delete") || group.isSystem}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title={group.isSystem ? "システムグループは削除できません" : ""}
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">グループ作成</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  グループ名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="管理者グループ"
                  className="w-full bg-gray-700 p-2 rounded"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  説明（任意）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="このグループの説明を入力"
                  rows={3}
                  className="w-full bg-gray-700 p-2 rounded"
                  disabled={creating}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setName("");
                  setDescription("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                disabled={creating}
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {creating ? "作成中..." : "作成"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
