/* 現在時刻表示コンポーネント */
"use client";

import { useState, useEffect } from "react";
import cn from "classnames";

interface CurrentTimeDisplayProps {
  connectionStatus: "open" | "connecting" | "closed" | "error";
  serverTime?: string; // WebSocketから取得した時刻
  lastMessageType?: string; // 最後に受信したメッセージの種類
}

export function CurrentTime({ connectionStatus, serverTime, lastMessageType }: CurrentTimeDisplayProps) {
  const [displayTime, setDisplayTime] = useState(new Date());
  const [localTime, setLocalTime] = useState(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [updateInterval, setUpdateInterval] = useState<number>(0);

  // ローカル時刻を常に更新（間隔チェック用）
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setLocalTime(now);
      
      // 最後の更新からの経過時間を計算
      if (lastUpdateTime) {
        const elapsed = now.getTime() - lastUpdateTime;
        setUpdateInterval(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  // サーバー時刻（ping/pong受信時刻）が利用可能な場合の処理
  useEffect(() => {
    if (serverTime && connectionStatus === "open") {
      const serverDate = new Date(serverTime);
      if (!isNaN(serverDate.getTime())) {
        const now = Date.now();
        
        // 前回更新からの間隔を計算
        if (lastUpdateTime) {
          const interval = now - lastUpdateTime;
          setUpdateInterval(interval);
        }
        
        // ping/pong受信時刻をそのまま表示
        setDisplayTime(serverDate);
        setLastUpdateTime(now);
        return;
      }
    }
    
    // サーバー時刻が利用できない場合
    if (connectionStatus !== "open") {
      setUpdateInterval(0);
      setLastUpdateTime(null);
      // 接続がない場合はローカル時刻を表示
      setDisplayTime(localTime);
    }
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

  // 更新間隔に応じた色設定
  const getTimeColor = (): string => {
    if (connectionStatus !== "open") {
      if (connectionStatus === "connecting") {
        return "text-yellow-300"; // 接続中は黄色
      }
      return "text-gray-300"; // 切断時はグレー
    }

    // ping/pong受信間隔に基づく色分け
    if (updateInterval === 0) {
      return "text-green-300"; // 初回受信時は緑
    } else if (updateInterval < 20000) {
      return "text-green-300"; // 20秒未満：緑色
    } else if (updateInterval <= 40000) {
      return "text-yellow-300"; // 20-40秒：黄色
    } else {
      return "text-red-500"; // 40秒超過：赤色
    }
  };

  return (
    <div className="flex items-center mx-3 min-w-48">
      <div className="w-full text-center">
        {/* メイン時刻表示 */}
        <div className={cn("text-lg font-mono font-bold", getTimeColor())}>
          {formatTime(displayTime)}
        </div>
        
        {/* 時刻の種類を表示 */}
        <div className="text-xs text-gray-400 mt-1">
          {connectionStatus === "open" 
            ? `最終受信時刻 (${lastMessageType || "不明"})`
            : "ローカル時刻"
          }
        </div>
      </div>
    </div>
  );
}