"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

export default function PasskeyResetRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      await axios.post("/api/auth/passkey/reset-request", { email });

      setSent(true);
      toast.success("再登録用のリンクをメールで送信しました");
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        "メール送信に失敗しました。もう一度お試しください";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
          <div className="text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-4">
              メールを送信しました
            </h1>

            <p className="text-gray-300 mb-6">
              <strong>{email}</strong> 宛に
              <br />
              パスキー再登録用のリンクを送信しました。
            </p>

            <div className="bg-blue-900 border-l-4 border-blue-500 p-4 mb-6 text-left">
              <p className="text-blue-200 text-sm">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
                <br />
                リンクの有効期限は24時間です。
              </p>
            </div>

            <button
              onClick={() => router.push("/login")}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded font-medium"
            >
              ログイン画面に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6">
          パスキーの再登録
        </h1>

        <p className="text-gray-300 mb-6">
          パソコンを変更した場合や、パスキーが使えなくなった場合は、
          新しいパスキーを再登録できます。
        </p>

        <div className="bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-6">
          <p className="text-yellow-200 text-sm">
            <strong>注意:</strong> 再登録すると、既存のパスキーはすべて削除されます。
          </p>
        </div>

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
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded transition-colors disabled:opacity-50"
          >
            {loading ? "送信中..." : "再登録用リンクを送信"}
          </button>
        </form>

        <div className="mt-4 text-center">
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
