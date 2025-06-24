"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ApiService } from "@/app/api/ApiService";
import { oauth2 } from "@/app/api/Oauth2Service";
import pack from "@/../package.json";

const Monitor = dynamic(() => import("@/app/components/monitor/Monitor"), {
  ssr: false,
});

const apiService = new ApiService();

type Status = "ok" | "loading" | "no-contract" | "no-auth" | undefined;

export default function MainPage() {
  const [initMode, setInitMode] = useState(false);
  const [status, setStatus] = useState<Status>("loading");

  /* ---------------- boot ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const isValid = await oauth2().refreshTokenCheck();
        console.log("refreshTokenCheck result:", isValid);
        if (isValid) {
          console.log("Token valid, calling contractCheck");
          await contractCheck();
        } else {
          console.log("Token invalid, setting initMode to true");
          setInitMode(true);
        }
      } catch (e) {
        console.error(e);
        setStatus("no-auth");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- handlers ---------------- */
  const init = async () => {
    // ❶ 状態をリセット
    setInitMode(false);
    setStatus("loading");

    try {
      // ❷ RefreshToken を削除
      await oauth2().refreshTokenDelete();

      // ❸ 認可 URL を作成してリダイレクト
      const authUrl = await oauth2().buildAuthorizationUrl(); // ← 下で実装
      window.location.href = authUrl; // ブラウザ遷移
    } catch (e) {
      console.error(e);
      setStatus("no-auth");
    }
  };

  const contractCheck = async () => {
    setInitMode(false);
    try {
      console.log("Starting contract check...");
      const res = await apiService.contractList();
      console.log("Contract list response:", res);
      if ("items" in res && Array.isArray(res.items)) {
        const hasEarthquake = res.items.some(
          (r) => r.classification === "telegram.earthquake"
        );
        console.log("Has earthquake contract:", hasEarthquake);
        console.log("Setting status to:", hasEarthquake ? "ok" : "no-contract");
        setStatus(hasEarthquake ? "ok" : "no-contract");
      } else {
        console.error("Unexpected response format:", res);
        setStatus("no-auth");
      }
    } catch (err) {
      console.error(err);
      setStatus("no-auth");
    }
  };

  /* ---------------- view ---------------- */
  if (initMode || status !== "ok") {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-[#677a98]">
        {/* central message */}
        <div className="text-center text-white">
          {/* status mode ------------------------------------ */}
          {!initMode && (
            <div className="text-[20px]">
              {status === "no-contract" && (
                <p>現在、地震津波関連の契約がないため情報が表示できません。</p>
              )}

              {status === "no-auth" && (
                <>
                  <p>
                    認可情報が取り消されました。アプリケーション再連携を行ってください。
                  </p>
                  <button
                    onClick={init}
                    className="mx-auto mt-2 rounded-md border border-[#063e7c] bg-[#1c528d] px-4 py-2"
                  >
                    アプリケーション再連携
                  </button>
                </>
              )}

              {status === "loading" && <p>Now loading...</p>}

              {!["no-contract", "no-auth", "loading"].includes(
                status ?? ""
              ) && <p>Now process...</p>}
            </div>
          )}

          {/* init view ------------------------------------ */}
          {initMode && (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">地震情報ビューア</h1>
              <p>これは、地震情報をリアルタイムに更新する情報パネルです。</p>
              <p>
                <a
                  href="https://dmdata.jp"
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  dmdata.jp
                </a>
                の「地震・津波関連」を契約している方のみ使用できます。
              </p>
              <p>
                WebSocket または PuLL リクエストを行い情報を取得しています。
              </p>
              <p>
                このアプリケーションを使用するには、以下のアプリケーション連携をしてください。
              </p>

              <button
                onClick={init}
                className="mx-auto rounded-md border border-[#063e7c] bg-[#1c528d] px-4 py-2"
              >
                アプリケーション連携
              </button>
            </div>
          )}
        </div>

        {/* footer ------------------------------------------ */}
        <footer className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center text-sm text-white">
          <p>ETCM - v.{pack.version}</p>
          <p>安否確認</p>
        </footer>
      </div>
    );
  }

  /* 通常モニタ画面 */
  console.log("Rendering Monitor component, status:", status, "initMode:", initMode);
  return <Monitor />;
}
