"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "メールの送信に失敗しました");
      }

      setSubmitted(true);
      toast.success(data.message || "パスワードリセットメールを送信しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "メールの送信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Toaster position="top-right" />
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center">
            <div className="mb-4 text-green-500 text-5xl">✓</div>
            <h1 className="text-2xl font-bold text-white mb-4">
              メールを送信しました
            </h1>
            <p className="text-gray-300 mb-6">
              {email} 宛にパスワードリセットのメールを送信しました。
              <br />
              メールに記載されたリンクをクリックして、新しいパスワードを設定してください。
            </p>
            <p className="text-sm text-gray-400 mb-6">
              ※ メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </p>
            <button
              onClick={() => router.push("/login")}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              ログイン画面に戻る
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
          パスワードの再発行
        </h1>
        <p className="text-gray-400 text-sm mb-6 text-center">
          登録されているメールアドレスを入力してください
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            {loading ? "送信中..." : "リセットメールを送信"}
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
