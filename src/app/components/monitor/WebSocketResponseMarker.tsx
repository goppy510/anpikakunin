"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "../providers/WebSocketProvider";

export function WebSocketResponseMarker() {
  const { responseCount, status, lastMessageType } = useWebSocket();
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    if (responseCount > 0) {
      setIsBlinking(true);
      const timer = setTimeout(() => {
        setIsBlinking(false);
      }, 200); // 200ms点滅

      return () => clearTimeout(timer);
    }
  }, [responseCount]);

  const getStatusColor = () => {
    switch (status) {
      case "open":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "closed":
        return "bg-gray-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "open":
        return "接続中";
      case "connecting":
        return "接続中...";
      case "closed":
        return "切断";
      case "error":
        return "エラー";
      default:
        return "不明";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-black/80 rounded-lg px-3 py-2 text-white text-sm">
      {/* WebSocket状態インジケーター */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
        <span>{getStatusText()}</span>
      </div>
      
      {/* レスポンスカウンター */}
      <div className="text-gray-300">
        <span className="text-xs">Response: {responseCount}</span>
      </div>
      
      {/* 点滅マーカー */}
      <div 
        className={`w-3 h-3 rounded-full transition-all duration-200 ${
          isBlinking 
            ? "bg-blue-400 shadow-lg shadow-blue-400/50 scale-110" 
            : "bg-gray-600"
        }`}
      ></div>
      
      {/* 最後のメッセージタイプ */}
      {lastMessageType && (
        <div className="text-xs text-gray-400 max-w-20 truncate">
          {lastMessageType}
        </div>
      )}
    </div>
  );
}