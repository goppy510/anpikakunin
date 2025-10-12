"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(300); // 5分

  useEffect(() => {
    if (!email) {
      router.push("/login");
      return;
    }

    // カウントダウンタイマー
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "認証に失敗しました");
      }

      // ログイン成功、ダッシュボードへ
      if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "認証に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);

    try {
      // ログインAPIを再度呼び出してOTP再送信
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password: "dummy" }), // パスワードは不要だが一旦ダミー
      });

      if (response.ok) {
        setTimeLeft(300); // タイマーリセット
        alert("認証コードを再送信しました");
      }
    } catch (err) {
      // Silenced
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <Toaster position="top-right" />
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          認証コード入力
        </h1>
        <p className="text-gray-400 text-sm mb-6 text-center">
          {email} に送信された6桁のコードを入力してください
        </p>

        {error && (
          <div className="bg-red-900 text-red-200 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-blue-900 bg-opacity-30 border border-blue-600 p-3 rounded mb-4 text-center">
          <div className="text-blue-300 text-sm mb-1">有効期限</div>
          <div className="text-white text-2xl font-mono font-bold">
            {formatTime(timeLeft)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              認証コード（6桁）
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
              maxLength={6}
              className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000000"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            {loading ? "確認中..." : "ログイン"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={loading || timeLeft > 240} // 1分経過後に再送信可能
            className="text-blue-400 hover:text-blue-300 text-sm disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            コードを再送信
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/login")}
            className="text-gray-400 hover:text-gray-300 text-sm"
          >
            ← ログイン画面に戻る
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-white">読み込み中...</div></div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
