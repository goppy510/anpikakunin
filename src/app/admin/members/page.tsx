"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { usePermissions } from "@/app/lib/hooks/usePermissions";

type User = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  token: string;
  inviterEmail: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean; // システムグループかどうか
};

export default function MembersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [email, setEmail] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const { hasPermission, isAdmin } = usePermissions();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, invitationsRes, groupsRes] = await Promise.all([
        axios.get("/api/users"),
        axios.get("/api/invitations"),
        axios.get("/api/groups"),
      ]);

      setUsers(usersRes.data.users || []);
      setInvitations(
        (invitationsRes.data.invitations || []).filter(
          (inv: Invitation) => !inv.acceptedAt
        )
      );
      setGroups(groupsRes.data.groups || []);
    } catch (error) {
      console.error("データ取得エラー:", error);
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!email || !email.includes("@")) {
      toast.error("有効なメールアドレスを入力してください");
      return;
    }

    if (!selectedGroupId) {
      toast.error("グループを選択してください");
      return;
    }

    try {
      setInviting(true);

      const res = await axios.post("/api/invitations", {
        email,
        groupId: selectedGroupId,
      });

      toast.success("招待を送信しました");

      // 招待URLをコピー
      const invitationUrl = res.data.invitationUrl;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(invitationUrl);
        toast.success("招待URLをクリップボードにコピーしました");
      }

      setShowInviteModal(false);
      setEmail("");
      setSelectedGroupId("");
      fetchData();
    } catch (error: any) {
      // 409 (既に登録済み) や 400 (バリデーションエラー) は想定内なのでログ出力しない
      if (error.response?.status !== 409 && error.response?.status !== 400) {
        console.error("招待エラー:", error);
      }
      const errorMsg = error.response?.data?.error || "招待の送信に失敗しました";
      toast.error(errorMsg);
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (id: string, email: string) => {
    if (!confirm(`${email} への招待をキャンセルしますか？`)) {
      return;
    }

    try {
      await axios.delete(`/api/invitations?id=${id}`);
      toast.success("招待をキャンセルしました");
      fetchData();
    } catch (error: any) {
      console.error("招待キャンセルエラー:", error);
      const errorMsg =
        error.response?.data?.error || "招待のキャンセルに失敗しました";
      toast.error(errorMsg);
    }
  };

  const copyInvitationUrl = (token: string) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080";
    const invitationUrl = `${baseUrl}/accept-invitation?token=${token}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(invitationUrl);
      toast.success("招待URLをコピーしました");
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
      <Toaster position="top-right" />
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">メンバー管理</h1>
          <p className="text-gray-400 mt-1">
            ユーザーの招待と権限管理
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          disabled={!hasPermission("member:invite")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + メンバー招待
        </button>
      </div>

      {/* 保留中の招待 */}
      {invitations.length > 0 && (
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">保留中の招待</h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between bg-gray-800 p-3 rounded"
              >
                <div className="flex-1">
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-sm text-gray-400">
                    権限: {inv.role === "ADMIN" ? "管理者" : "編集者"} | 有効期限:{" "}
                    {new Date(inv.expiresAt).toLocaleDateString("ja-JP")}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyInvitationUrl(inv.token)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    URLコピー
                  </button>
                  <button
                    onClick={() => handleCancelInvitation(inv.id, inv.email)}
                    disabled={!hasPermission("member:delete")}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* メンバー一覧 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">メンバー一覧</h2>
        {users.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            メンバーがいません
          </p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between bg-gray-700 p-3 rounded"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    {user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{user.email}</div>
                    <div className="text-xs text-gray-400 space-x-2">
                      <span>{user.role === "ADMIN" ? "管理者" : "編集者"}</span>
                      {!user.isActive && (
                        <span className="text-red-400">(無効)</span>
                      )}
                      {!user.emailVerified && (
                        <span className="text-yellow-400">(未確認)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  登録日: {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 招待モーダル */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">メンバーを招待</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-gray-700 p-2 rounded"
                  disabled={inviting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  所属グループ <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded"
                  disabled={inviting}
                >
                  <option value="">グループを選択してください</option>
                  {groups
                    .filter((group) => isAdmin || !group.isSystem) // EDITORはシステムグループを除外
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                        {group.description && ` - ${group.description}`}
                        {group.isSystem && " (管理者グループ)"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3">
                <p className="text-sm text-gray-300">
                  💡 招待されたメンバーは選択したグループに自動的に所属します。
                  <br />
                  グループの権限に応じて機能にアクセスできます。
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setEmail("");
                  setSelectedGroupId("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                disabled={inviting}
              >
                キャンセル
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !email || !selectedGroupId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {inviting ? "招待中..." : "招待"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
