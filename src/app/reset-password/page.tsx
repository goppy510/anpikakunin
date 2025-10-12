"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("無効なリセットリンクです");
      setTimeout(() => router.push("/login"), 2000);
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("パスワードが一致しません");
      return;
    }

    if (password.length < 8) {
      toast.error("パスワードは8文字以上である必要があります");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-reset/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "パスワードのリセットに失敗しました");
      }

      setSuccess(true);
      toast.success(data.message || "パスワードをリセットしました");

      // 3秒後にログイン画面へリダイレクト
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "パスワードのリセットに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Toaster position="top-right" />
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center">
            <div className="mb-4 text-green-500 text-5xl">✓</div>
            <h1 className="text-2xl font-bold text-white mb-4">
              パスワードをリセットしました
            </h1>
            <p className="text-gray-300 mb-6">
              新しいパスワードでログインできます。
              <br />
              まもなくログイン画面に移動します...
            </p>
            <button
              onClick={() => router.push("/login")}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              今すぐログイン画面へ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <Toaster position="top-right" />
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          新しいパスワードを設定
        </h1>
        <p className="text-gray-400 text-sm mb-6 text-center">
          8文字以上の英数字を含むパスワードを入力してください
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              新しいパスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              新しいパスワード（確認）
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            {loading ? "設定中..." : "パスワードを設定"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
          >
            ログイン画面に戻る
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">読み込み中...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
