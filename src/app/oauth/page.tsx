"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function OAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state) {
      // サーバーサイドのコールバックAPIにリダイレクト
      window.location.href = `/api/admin/dmdata-oauth/callback?code=${code}&state=${state}`;
    } else {
      // エラー時は設定ページに戻る
      window.location.href = "/admin/dmdata-settings?error=Invalid callback parameters";
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg">OAuth認証処理中...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">読み込み中...</p>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
