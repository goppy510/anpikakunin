"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("招待トークンが無効です");
      router.push("/login");
      return;
    }

    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const res = await axios.get(`/api/invitations/verify?token=${token}`);
      setInvitation(res.data);
    } catch (error: any) {
      console.error("招待確認エラー:", error);
      const errorMsg = error.response?.data?.error || "招待の確認に失敗しました";
      toast.error(errorMsg);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!password || password.length < 8) {
      toast.error("パスワードは8文字以上で入力してください");
      return;
    }

    if (password !== passwordConfirm) {
      toast.error("パスワードが一致しません");
      return;
    }

    try {
      setAccepting(true);

      await axios.post("/api/invitations/accept", {
        token,
        password,
      });

      toast.success("アカウントを作成しました");
      router.push("/login");
    } catch (error: any) {
      console.error("招待受諾エラー:", error);
      const errorMsg = error.response?.data?.error || "アカウント作成に失敗しました";
      toast.error(errorMsg);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">読み込み中...</div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6">招待を受諾</h1>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-gray-400 text-sm">招待されたメールアドレス</p>
            <p className="text-white font-medium">{invitation.email}</p>
          </div>

          <div>
            <p className="text-gray-400 text-sm">権限</p>
            <p className="text-white font-medium">
              {invitation.role === "ADMIN" ? "管理者" : "編集者"}
            </p>
          </div>

          <div>
            <p className="text-gray-400 text-sm">有効期限</p>
            <p className="text-white font-medium">
              {new Date(invitation.expiresAt).toLocaleString("ja-JP")}
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              className="w-full bg-gray-700 text-white p-3 rounded"
              disabled={accepting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              パスワード（確認）
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="パスワードを再入力"
              className="w-full bg-gray-700 text-white p-3 rounded"
              disabled={accepting}
            />
          </div>
        </div>

        <button
          onClick={handleAccept}
          disabled={accepting || !password || !passwordConfirm}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {accepting ? "作成中..." : "アカウントを作成"}
        </button>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white">読み込み中...</div>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
