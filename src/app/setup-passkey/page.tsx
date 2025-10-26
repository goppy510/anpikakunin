"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { startRegistration } from "@simplewebauthn/browser";

export const dynamic = "force-dynamic";

function SetupPasskeyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [deviceName, setDeviceName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    if (!userId) {
      toast.error("ユーザーIDが無効です");
      router.push("/login");
    }
  }, [userId, router]);

  const handleRegisterPasskey = async () => {
    try {
      setRegistering(true);

      // 1. チャレンジ生成
      const optionsResponse = await axios.post(
        "/api/auth/passkey/registration-options",
        { userId }
      );

      const { options } = optionsResponse.data;

      // 2. WebAuthn登録（ブラウザAPI）
      const credential = await startRegistration(options);

      // 3. 検証・保存
      await axios.post("/api/auth/passkey/register", {
        userId,
        credential,
        deviceName: deviceName.trim() || undefined,
      });

      toast.success("パスキーを登録しました！");

      // ログイン画面へ遷移
      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (error: any) {
      console.error("Passkey registration error:", error);

      if (error.name === "NotAllowedError") {
        toast.error("パスキー登録がキャンセルされました");
      } else if (error.name === "NotSupportedError") {
        toast.error("このブラウザはパスキーに対応していません");
      } else {
        const errorMsg =
          error.response?.data?.error || "パスキー登録に失敗しました";
        toast.error(errorMsg);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleSkip = async () => {
    try {
      setSkipping(true);
      toast.success("パスキーの登録をスキップしました");

      // ログイン画面へ遷移
      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } finally {
      setSkipping(false);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6">
          パスキーの登録
        </h1>

        <div className="bg-blue-900 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-blue-200 text-sm">
            セキュリティ向上のため、パスキーを登録してください。
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <h3 className="text-white font-semibold mb-2">パスキーとは？</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>✓ パスワード入力不要</li>
              <li>✓ 生体認証で即座にログイン</li>
              <li>✓ フィッシング詐欺に強い</li>
              <li>✓ Touch ID / Face ID / Windows Hello 対応</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              デバイス名（オプション）
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="例: MacBook Pro"
              className="w-full bg-gray-700 text-white p-3 rounded"
              disabled={registering || skipping}
            />
            <p className="text-gray-400 text-xs mt-1">
              後で識別しやすくするための名前です
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRegisterPasskey}
            disabled={registering || skipping}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {registering ? "登録中..." : "🔐 パスキーを登録"}
          </button>

          <button
            onClick={handleSkip}
            disabled={registering || skipping}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {skipping ? "スキップ中..." : "後で登録する"}
          </button>
        </div>

        <div className="mt-6 bg-yellow-900 border-l-4 border-yellow-500 p-4">
          <p className="text-yellow-200 text-xs">
            <strong>注意:</strong> スキップした場合、パスワードでのログインが必要です。
            パスキーは後からアカウント設定で登録できます。
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SetupPasskeyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white">読み込み中...</div>
        </div>
      }
    >
      <SetupPasskeyContent />
    </Suspense>
  );
}
