"use client";

import { use, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import { usePermissions } from "@/app/lib/hooks/usePermissions";

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean; // システムグループかどうか
  memberCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
  members: {
    id: string;
    email: string;
    role: string;
  }[];
  permissions: {
    id: string;
    name: string;
    displayName: string;
    category: string;
  }[];
};

type Permission = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
};

type User = {
  id: string;
  email: string;
  role: string;
};

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = usePermissions();

  // 権限追加モーダル
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [addingPermission, setAddingPermission] = useState(false);

  // メンバー追加モーダル
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // グループ名編集モーダル
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchGroup();
    fetchAllPermissions();
    fetchAllUsers();
  }, [id]);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/groups/${id}`);
      setGroup(res.data);
    } catch (error) {
      console.error("グループ取得エラー:", error);
      toast.error("グループの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPermissions = async () => {
    try {
      const res = await axios.get("/api/permissions");
      setAllPermissions(res.data.permissions || []);
    } catch (error) {
      console.error("権限一覧取得エラー:", error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await axios.get("/api/users");
      setAllUsers(res.data.users || []);
    } catch (error) {
      console.error("ユーザー一覧取得エラー:", error);
    }
  };

  const handleAttachPermission = async () => {
    if (selectedPermissionIds.length === 0) {
      toast.error("権限を選択してください");
      return;
    }

    try {
      setAddingPermission(true);

      // 複数権限を順次アタッチ
      for (const permissionId of selectedPermissionIds) {
        await axios.post(`/api/groups/${id}/permissions`, {
          permissionId,
        });
      }

      toast.success(`${selectedPermissionIds.length}件の権限をアタッチしました`);
      setShowPermissionModal(false);
      setSelectedPermissionIds([]);
      fetchGroup();
    } catch (error: any) {
      console.error("権限アタッチエラー:", error);
      const errorMsg =
        error.response?.data?.error || "権限のアタッチに失敗しました";
      toast.error(errorMsg);
    } finally {
      setAddingPermission(false);
    }
  };

  const togglePermissionSelection = (permissionId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleDetachPermission = async (permissionId: string, name: string) => {
    if (!confirm(`権限「${name}」をデタッチしますか？`)) {
      return;
    }

    try {
      await axios.delete(
        `/api/groups/${id}/permissions?permissionId=${permissionId}`
      );
      toast.success("権限をデタッチしました");
      fetchGroup();
    } catch (error: any) {
      console.error("権限デタッチエラー:", error);
      const errorMsg =
        error.response?.data?.error || "権限のデタッチに失敗しました";
      toast.error(errorMsg);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast.error("ユーザーを選択してください");
      return;
    }

    try {
      setAddingMember(true);
      await axios.post(`/api/groups/${id}/members`, {
        userId: selectedUserId,
      });

      toast.success("メンバーを追加しました");
      setShowMemberModal(false);
      setSelectedUserId("");
      fetchGroup();
    } catch (error: any) {
      console.error("メンバー追加エラー:", error);
      const errorMsg =
        error.response?.data?.error || "メンバーの追加に失敗しました";
      toast.error(errorMsg);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string, email: string) => {
    if (!confirm(`メンバー「${email}」を削除しますか？`)) {
      return;
    }

    try {
      await axios.delete(`/api/groups/${id}/members?userId=${userId}`);
      toast.success("メンバーを削除しました");
      fetchGroup();
    } catch (error: any) {
      console.error("メンバー削除エラー:", error);
      const errorMsg =
        error.response?.data?.error || "メンバーの削除に失敗しました";
      toast.error(errorMsg);
    }
  };

  const handleEditGroup = () => {
    setEditingName(group?.name || "");
    setEditingDescription(group?.description || "");
    setShowEditModal(true);
  };

  const handleUpdateGroup = async () => {
    if (!editingName.trim()) {
      toast.error("グループ名を入力してください");
      return;
    }

    try {
      setUpdating(true);
      await axios.patch(`/api/groups/${id}`, {
        name: editingName.trim(),
        description: editingDescription.trim() || null,
      });

      toast.success("グループ情報を更新しました");
      setShowEditModal(false);
      fetchGroup();
    } catch (error: any) {
      console.error("グループ更新エラー:", error);
      const errorMsg =
        error.response?.data?.error || "グループ情報の更新に失敗しました";
      toast.error(errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-8">
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
          <p className="text-red-400">グループが見つかりません</p>
        </div>
      </div>
    );
  }

  // アタッチ可能な権限（既にアタッチ済みを除外）
  const attachablePermissions = allPermissions.filter(
    (p) => !group.permissions.some((gp) => gp.id === p.id)
  );

  // 追加可能なユーザー（既にメンバーを除外）
  const addableUsers = allUsers.filter(
    (u) => !group.members.some((m) => m.id === u.id)
  );

  return (
    <div className="p-8 space-y-6">
      {/* ヘッダー */}
      <div>
        <Link
          href="/admin/groups"
          className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
        >
          ← グループ一覧に戻る
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            {group.description && (
              <p className="text-gray-400 mt-1">{group.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <div>👥 {group.memberCount} メンバー</div>
              <div>🔑 {group.permissionCount} 権限</div>
            </div>
            {!(group as any).isSystem && hasPermission("group:write") && (
              <button
                onClick={handleEditGroup}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                編集
              </button>
            )}
          </div>
        </div>
      </div>

      {/* メンバー */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">メンバー</h2>
          <button
            onClick={() => setShowMemberModal(true)}
            disabled={!hasPermission("group:write")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + メンバー追加
          </button>
        </div>

        {group.members.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            メンバーがいません
          </p>
        ) : (
          <div className="space-y-2">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-gray-700 p-3 rounded"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    {member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{member.email}</div>
                    <div className="text-xs text-gray-400">{member.role}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMember(member.id, member.email)}
                  disabled={!hasPermission("group:write") || group.isSystem}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={group.isSystem ? "システムグループのメンバーは削除できません" : ""}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 権限 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">アタッチされた権限</h2>
          <button
            onClick={() => setShowPermissionModal(true)}
            disabled={!hasPermission("group:attach_permission")}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + 権限アタッチ
          </button>
        </div>

        {group.permissions.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            権限がアタッチされていません
          </p>
        ) : (
          <div className="space-y-2">
            {group.permissions.map((perm) => (
              <div
                key={perm.id}
                className="flex items-center justify-between bg-gray-700 p-3 rounded"
              >
                <div>
                  <div className="font-medium">{perm.displayName}</div>
                  <div className="text-sm text-gray-400">
                    <span className="px-2 py-0.5 bg-gray-600 rounded text-xs mr-2">
                      {perm.category}
                    </span>
                    {perm.name}
                  </div>
                </div>
                <button
                  onClick={() =>
                    handleDetachPermission(perm.id, perm.displayName)
                  }
                  disabled={!hasPermission("group:attach_permission")}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  デタッチ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 権限追加モーダル */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
            <h2 className="text-2xl font-bold mb-4">
              権限をアタッチ
              {selectedPermissionIds.length > 0 && (
                <span className="text-sm text-gray-400 ml-2">
                  ({selectedPermissionIds.length}件選択中)
                </span>
              )}
            </h2>

            <div className="space-y-2 mb-6">
              {/* カテゴリごとにグルーピング */}
              {Object.entries(
                attachablePermissions.reduce((acc, perm) => {
                  if (!acc[perm.category]) acc[perm.category] = [];
                  acc[perm.category].push(perm);
                  return acc;
                }, {} as Record<string, typeof attachablePermissions>)
              ).map(([category, perms]) => (
                <div key={category} className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center space-x-3 p-2 hover:bg-gray-600 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.includes(perm.id)}
                          onChange={() => togglePermissionSelection(perm.id)}
                          disabled={addingPermission}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{perm.displayName}</div>
                          <div className="text-xs text-gray-400">
                            {perm.name}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  setSelectedPermissionIds([]);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                disabled={addingPermission}
              >
                キャンセル
              </button>
              <button
                onClick={handleAttachPermission}
                disabled={addingPermission || selectedPermissionIds.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
              >
                {addingPermission
                  ? "追加中..."
                  : `アタッチ (${selectedPermissionIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* グループ編集モーダル */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">グループ情報を編集</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  グループ名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded"
                  disabled={updating}
                  placeholder="グループ名を入力"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  説明
                </label>
                <textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded"
                  disabled={updating}
                  placeholder="グループの説明を入力（任意）"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingName("");
                  setEditingDescription("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                disabled={updating}
              >
                キャンセル
              </button>
              <button
                onClick={handleUpdateGroup}
                disabled={updating || !editingName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {updating ? "更新中..." : "更新"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メンバー追加モーダル */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">メンバーを追加</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ユーザー
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded"
                  disabled={addingMember}
                >
                  <option value="">選択してください</option>
                  {addableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowMemberModal(false);
                  setSelectedUserId("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                disabled={addingMember}
              >
                キャンセル
              </button>
              <button
                onClick={handleAddMember}
                disabled={addingMember || !selectedUserId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {addingMember ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
