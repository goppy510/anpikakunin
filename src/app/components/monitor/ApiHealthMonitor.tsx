"use client";

import { useEffect, useState } from "react";

type HealthStatus = "healthy" | "checking" | "error" | "unknown";

export function ApiHealthMonitor() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  const checkHealth = async () => {
    try {
      setStatus("checking");

      // DMData.jp API ヘルスチェック (契約情報取得)
      const response = await fetch("https://api.dmdata.jp/v2/contract", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_DMDATA_API_KEY || ""}`,
        },
      });

      if (response.ok) {
        setStatus("healthy");
        setErrorCount(0);
      } else {
        setStatus("error");
        setErrorCount((prev) => prev + 1);
      }

      setLastCheck(new Date());
    } catch (error) {
      console.error("API health check failed:", error);
      setStatus("error");
      setErrorCount((prev) => prev + 1);
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    // 初回チェック
    checkHealth();

    // 30秒ごとにヘルスチェック
    const interval = setInterval(() => {
      checkHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "checking":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "healthy":
        return "API正常";
      case "checking":
        return "確認中...";
      case "error":
        return "APIエラー";
      default:
        return "不明";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-black/80 rounded-lg px-4 py-2 text-white text-sm">
      {/* API状態インジケーター */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${getStatusColor()} ${
            status === "checking" ? "animate-pulse" : ""
          }`}
        ></div>
        <span>{getStatusText()}</span>
      </div>

      {/* エラーカウント */}
      {errorCount > 0 && (
        <div className="text-red-400 text-xs">
          エラー: {errorCount}
        </div>
      )}

      {/* 最終チェック時刻 */}
      {lastCheck && (
        <div className="text-gray-400 text-xs">
          {lastCheck.toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}
