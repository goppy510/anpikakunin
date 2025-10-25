"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  validatePasswordStrength,
  getPasswordStrengthLevel,
} from "@/app/lib/validation/password";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [fetched, setFetched] = useState(false); // 重複実行防止フラグ

  // パスワード強度計算
  const passwordStrength = useMemo(
    () => validatePasswordStrength(password),
    [password]
  );
  const strengthLevel = useMemo(
    () => getPasswordStrengthLevel(passwordStrength.score),
    [passwordStrength.score]
  );

  useEffect(() => {
    if (!token) {
      toast.error("招待トークンが無効です");
      router.push("/login");
      return;
    }

    if (fetched) return; // 既に実行済みなら何もしない
    setFetched(true);
    fetchInvitation();
  }, [token, fetched]);

  const fetchInvitation = async () => {
    try {
      const res = await axios.get(`/api/invitations/verify?token=${token}`);
      setInvitation(res.data);
    } catch (error: any) {
      // Silenced
      const errorMsg = error.response?.data?.error || "招待の確認に失敗しました";
      toast.error(errorMsg);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    // パスワード強度チェック
    if (!passwordStrength.isValid) {
      toast.error("パスワードが要件を満たしていません");
      return;
    }

    if (password !== passwordConfirm) {
      toast.error("パスワードが一致しません");
      return;
    }

    try {
      setAccepting(true);

      const response = await axios.post("/api/invitations/accept", {
        token,
        password,
      });

      const { userId } = response.data;

      toast.success("アカウントを作成しました");

      // パスキー登録画面へ遷移
      router.push(`/setup-passkey?userId=${userId}`);
    } catch (error: any) {
      // Silenced
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
      <Toaster position="top-right" />
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

            {/* パスワード強度インジケーター */}
            {password && (
              <div className="mt-3 space-y-2">
                {/* 強度バー */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-600 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        strengthLevel.color === "red"
                          ? "bg-red-500"
                          : strengthLevel.color === "yellow"
                            ? "bg-yellow-500"
                            : strengthLevel.color === "blue"
                              ? "bg-blue-500"
                              : "bg-green-500"
                      }`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      strengthLevel.color === "red"
                        ? "text-red-400"
                        : strengthLevel.color === "yellow"
                          ? "text-yellow-400"
                          : strengthLevel.color === "blue"
                            ? "text-blue-400"
                            : "text-green-400"
                    }`}
                  >
                    {strengthLevel.label}
                  </span>
                </div>

                {/* 要件チェックリスト */}
                <div className="bg-gray-700 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        passwordStrength.requirements.minLength
                          ? "text-green-400"
                          : "text-gray-400"
                      }
                    >
                      {passwordStrength.requirements.minLength ? "✓" : "○"}
                    </span>
                    <span className="text-gray-300">8文字以上</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        passwordStrength.requirements.hasUppercase
                          ? "text-green-400"
                          : "text-gray-400"
                      }
                    >
                      {passwordStrength.requirements.hasUppercase ? "✓" : "○"}
                    </span>
                    <span className="text-gray-300">大文字を含む (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        passwordStrength.requirements.hasLowercase
                          ? "text-green-400"
                          : "text-gray-400"
                      }
                    >
                      {passwordStrength.requirements.hasLowercase ? "✓" : "○"}
                    </span>
                    <span className="text-gray-300">小文字を含む (a-z)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        passwordStrength.requirements.hasNumber
                          ? "text-green-400"
                          : "text-gray-400"
                      }
                    >
                      {passwordStrength.requirements.hasNumber ? "✓" : "○"}
                    </span>
                    <span className="text-gray-300">数字を含む (0-9)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        passwordStrength.requirements.hasSymbol
                          ? "text-green-400"
                          : "text-gray-400"
                      }
                    >
                      {passwordStrength.requirements.hasSymbol ? "✓" : "○"}
                    </span>
                    <span className="text-gray-300">記号を含む (!@#$%...)</span>
                  </div>
                </div>
              </div>
            )}
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
          disabled={
            accepting ||
            !password ||
            !passwordConfirm ||
            !passwordStrength.isValid
          }
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
