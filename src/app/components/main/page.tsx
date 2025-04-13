"use client";

import { useEffect, useState } from "react";
import { apiService } from "@/app/api/ApiService";
import {
  oauth2,
  refreshTokenDelete,
  oAuth2ClassReInit,
} from "@/app/api/Oauth2Service";
import pack from "@/../package.json";
import dynamic from "next/dynamic";

const Monitor = dynamic(() => import("@/app/components/monitor/Monitor"), {
  ssr: false,
});

type Status = "ok" | "loading" | "no-contract" | "no-auth" | undefined;

export default function MainPage() {
  const [initMode, setInitMode] = useState(false);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    oauth2
      .refreshTokenCheck()
      .then((isValid) => (isValid ? contractCheck() : setInitMode(true)))
      .finally(() => setStatus(undefined));
  }, []);

  const init = async () => {
    setInitMode(false);
    setStatus("loading");
    await refreshTokenDelete();
    await oAuth2ClassReInit();
    contractCheck();
  };

  const contractCheck = () => {
    setInitMode(false);
    apiService
      .contractList()
      .then((res) => {
        const hasEarthquake = res.items.some(
          (r) => r.classification === "telegram.earthquake"
        );
        setStatus(hasEarthquake ? "ok" : "no-contract");
      })
      .catch((err) => {
        setStatus("no-auth");
        console.error(err);
      });
  };

  if (initMode || status !== "ok") {
    return (
      <div className="full-window">
        <div className="content">
          {!initMode && (
            <div className="status-message">
              {status === "no-contract" && (
                <p>現在、地震津波関連の契約がないため情報が表示できません。</p>
              )}
              {status === "no-auth" && (
                <>
                  <p>
                    認可情報が取り消されました。アプリケーション再連携を行ってください。
                  </p>
                  <div className="init" onClick={init}>
                    アプリケーション再連携
                  </div>
                </>
              )}
              {status === "loading" && <p>Now loading...</p>}
              {!["no-contract", "no-auth", "loading"].includes(
                status ?? ""
              ) && <p>Now process...</p>}
            </div>
          )}
          {initMode && (
            <div className="init-view">
              <h1>地震情報ビューア</h1>
              <p>これは、地震情報をリアルタイムに更新する情報パネルです。</p>
              <p>
                <a href="https://dmdata.jp">dmdata.jp</a>
                の「地震・津波関連」を契約している方のみ使用できます。
              </p>
              <p>WebSocketまたはPuLLリクエストを行い情報を取得しています。</p>
              <br />
              <p>
                このアプリケーションを使用するには、以下のアプリケーション連携をしてください。
              </p>
              <div className="init" onClick={init}>
                アプリケーション連携
              </div>
            </div>
          )}
        </div>

        <div className="footer">
          <p>ETCM - v.{pack.version}</p>
          <p>&copy; {pack.author}</p>
          <p>by DMDATA.JP</p>
        </div>
      </div>
    );
  }

  return <Monitor />;
}
