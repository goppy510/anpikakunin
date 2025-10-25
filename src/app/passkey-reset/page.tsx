"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { startRegistration } from "@simplewebauthn/browser";

export const dynamic = "force-dynamic";

function PasskeyResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [deviceName, setDeviceName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      toast.error("トークンが無効です");
      router.push("/login");
      return;
    }

    // トークン検証（オプション: APIで検証する場合）
    setValidating(false);
    setValid(true);
  }, [token, router]);

  const handleResetPasskey = async () => {
    if (!token) return;

    try {
      setRegistering(true);

      // 1. チャレンジ生成（reset用のエンドポイントを使う場合、もしくは通常のregistration-optionsを使用）
      // ここでは簡略化のため、まずトークンから一時的にuserIdを取得する必要がある場合があります
      // または、reset専用のチャレンジ生成エンドポイントを作成

      // 簡略化: 通常のregistration-optionsを使用するため、userIdが必要
      // 実際にはreset-request時にuserIdを含めるか、トークンからuserIdを取得するAPIを作成

      // ここでは仮にトークンからuserIdを取得するAPIがあると仮定
      const tokenInfoResponse = await axios.get(
        `/api/auth/passkey/validate-reset-token?token=${token}`
      );
      const { userId: fetchedUserId } = tokenInfoResponse.data;
      setUserId(fetchedUserId);

      // チャレンジ生成
      const optionsResponse = await axios.post(
        "/api/auth/passkey/registration-options",
        { userId: fetchedUserId }
      );

      const { options } = optionsResponse.data;

      // 2. WebAuthn登録（ブラウザAPI）
      const credential = await startRegistration(options);

      // 3. 検証・保存（reset専用エンドポイント）
      await axios.post("/api/auth/passkey/reset", {
        token,
        credential,
        deviceName: deviceName.trim() || undefined,
      });

      toast.success("パスキーを再登録しました！");

      // ログイン画面へ遷移
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error: any) {
      console.error("Passkey reset error:", error);

      if (error.name === "NotAllowedError") {
        toast.error("パスキー登録がキャンセルされました");
      } else if (error.name === "NotSupportedError") {
        toast.error("このブラウザはパスキーに対応していません");
      } else {
        const errorMsg =
          error.response?.data?.error || "パスキー再登録に失敗しました";
        toast.error(errorMsg);
      }
    } finally {
      setRegistering(false);
    }
  };

  if (!token) {
    return null;
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">トークンを検証中...</div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            トークンが無効です
          </h1>
          <p className="text-gray-300 mb-6">
            このリンクは無効または期限切れです。
          </p>
          <button
            onClick={() => router.push("/passkey-reset-request")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium"
          >
            再度リクエストする
          </button>
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

        <div className="bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-6">
          <p className="text-yellow-200 text-sm">
            <strong>注意:</strong> 再登録すると、既存のパスキーはすべて削除されます。
          </p>
        </div>

        <div className="space-y-4 mb-6">
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
              disabled={registering}
            />
            <p className="text-gray-400 text-xs mt-1">
              後で識別しやすくするための名前です
            </p>
          </div>
        </div>

        <button
          onClick={handleResetPasskey}
          disabled={registering}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {registering ? "再登録中..." : "🔐 パスキーを再登録"}
        </button>

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

export default function PasskeyResetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white">読み込み中...</div>
        </div>
      }
    >
      <PasskeyResetContent />
    </Suspense>
  );
}
