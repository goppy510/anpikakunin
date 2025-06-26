/* 現在時刻表示コンポーネント */
"use client";

import { useState, useEffect } from "react";
import cn from "classnames";

interface CurrentTimeDisplayProps {
  connectionStatus: "open" | "connecting" | "closed" | "error";
  serverTime?: string; // WebSocketから取得した時刻
}

export function CurrentTime({ connectionStatus, serverTime }: CurrentTimeDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeSource, setTimeSource] = useState<"local" | "server">("local");

  // ローカル時刻更新
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // サーバー時刻が利用可能な場合の処理
  useEffect(() => {
    if (serverTime && connectionStatus === "open") {
      const serverDate = new Date(serverTime);
      if (!isNaN(serverDate.getTime())) {
        setCurrentTime(serverDate);
        setTimeSource("server");
        return;
      }
    }
    
    // サーバー時刻が利用できない場合はローカル時刻にフォールバック
    setTimeSource("local");
  }, [serverTime, connectionStatus]);

  // 日本標準時に変換
  const formatTime = (date: Date): string => {
    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  // 接続状態に応じた色設定
  const getTimeColor = (): string => {
    if (timeSource === "server" && connectionStatus === "open") {
      return "text-green-300"; // サーバー時刻利用時は緑
    }
    if (connectionStatus === "connecting") {
      return "text-yellow-300"; // 接続中は黄色
    }
    if (connectionStatus === "error" || connectionStatus === "closed") {
      return "text-red-300"; // 接続エラー時は赤
    }
    return "text-gray-300"; // デフォルト
  };

  const getStatusText = (): string => {
    if (timeSource === "server" && connectionStatus === "open") {
      return "サーバー時刻";
    }
    return "ローカル時刻";
  };

  return (
    <div className="flex items-center mx-3">
      <div className="flex flex-col text-right">
        {/* メイン時刻表示 */}
        <div className={cn("text-sm font-mono font-bold", getTimeColor())}>
          {formatTime(currentTime)}
        </div>
        
        {/* 時刻ソース表示 */}
        <div className="text-xs text-gray-400">
          {getStatusText()}
        </div>
      </div>
    </div>
  );
}