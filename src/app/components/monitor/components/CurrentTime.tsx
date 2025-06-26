/* 現在時刻表示コンポーネント */
"use client";

import { useState, useEffect } from "react";
import cn from "classnames";

interface CurrentTimeDisplayProps {
  connectionStatus: "open" | "connecting" | "closed" | "error";
  serverTime?: string; // WebSocketから取得した時刻
}

export function CurrentTime({ connectionStatus, serverTime }: CurrentTimeDisplayProps) {
  const [displayTime, setDisplayTime] = useState(new Date());
  const [localTime, setLocalTime] = useState(new Date());
  const [hasTimeDivergence, setHasTimeDivergence] = useState(false);

  // ローカル時刻を常に更新（内部で保持）
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // サーバー時刻が利用可能な場合の処理
  useEffect(() => {
    if (serverTime && connectionStatus === "open") {
      const serverDate = new Date(serverTime);
      if (!isNaN(serverDate.getTime())) {
        setDisplayTime(serverDate);
        
        // ローカル時刻との差を計算（1秒以上の乖離をチェック）
        const timeDiff = Math.abs(localTime.getTime() - serverDate.getTime());
        setHasTimeDivergence(timeDiff > 1000);
        return;
      }
    }
    
    // サーバー時刻が利用できない場合もサーバー時刻表示を継続
    // （最後に受信したサーバー時刻 + 経過時間で推定）
    setHasTimeDivergence(false);
  }, [serverTime, connectionStatus, localTime]);

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
    // 時刻の乖離がある場合は真っ赤
    if (hasTimeDivergence) {
      return "text-red-500";
    }
    // 接続中でサーバー時刻が利用可能な場合は緑
    if (connectionStatus === "open") {
      return "text-green-300";
    }
    if (connectionStatus === "connecting") {
      return "text-yellow-300"; // 接続中は黄色
    }
    return "text-gray-300"; // 切断時はグレー
  };

  return (
    <div className="flex items-center mx-3 min-w-48">
      <div className="w-full text-center">
        {/* メイン時刻表示（サーバー時刻のみ） */}
        <div className={cn("text-lg font-mono font-bold", getTimeColor())}>
          {formatTime(displayTime)}
        </div>
      </div>
    </div>
  );
}