"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { WebSocketManager } from "@/app/components/monitor/utils/websocketProcessor";
import { EventItem } from "@/app/components/monitor/types/EventItem";
import { oauth2 } from "@/app/api/Oauth2Service";
import { ApiService } from "@/app/api/ApiService";
import { EventDatabase } from "@/app/components/monitor/utils/eventDatabase";

interface WebSocketContextType {
  status: "open" | "connecting" | "closed" | "error";
  events: EventItem[];
  serverTime: string;
  lastMessageType: string;
  authStatus: "checking" | "authenticated" | "not_authenticated";
  isInitialized: boolean;
  addEvent: (event: EventItem) => void;
  reconnect: () => void;
  refreshAuth: () => Promise<void>;
  clearAuth: () => Promise<void>;
  handleLogin: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [status, setStatus] = useState<"open" | "connecting" | "closed" | "error">("closed");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [serverTime, setServerTime] = useState<string>("");
  const [lastMessageType, setLastMessageType] = useState<string>("");
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "not_authenticated">("checking");
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const [notificationThreshold] = useState(1); // デフォルト震度1

  // ページ離脱時とフォーカス管理
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsManagerRef.current) {
        console.log("Page unload detected, disconnecting WebSocket...");
        wsManagerRef.current.disconnect();
      }
    };

    // ページがフォーカスを取り戻した時の接続チェック
    const handleVisibilityChange = () => {
      if (!document.hidden && authStatus === "authenticated") {
        console.log("Page focused, checking connection status...");
        // フォーカス復帰時に接続状態をチェック
        if (!wsManagerRef.current || status === "closed" || status === "error") {
          console.log("Reconnecting on page focus...");
          setTimeout(() => {
            if (wsManagerRef.current) {
              wsManagerRef.current.reconnect();
            }
          }, 1000);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authStatus, status]);

  // 震度を数値に変換するヘルパー関数
  const getIntensityValue = (intensity: string): number => {
    if (intensity === '5弱' || intensity === '5-') return 5.0;
    if (intensity === '5強' || intensity === '5+') return 5.5;
    if (intensity === '6弱' || intensity === '6-') return 6.0;
    if (intensity === '6強' || intensity === '6+') return 6.5;
    return parseFloat(intensity) || 0;
  };

  // 認証状態確認とWebSocket接続クリーンアップ
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const oauth2Service = oauth2();
        const hasToken = await oauth2Service.refreshTokenCheck();
        setAuthStatus(hasToken ? "authenticated" : "not_authenticated");
        
        if (hasToken) {
          try {
            const apiService = new ApiService();
            await apiService.contractList();
            
            // リロード時は必ず全接続をクリーンアップ
            console.log("=== Page Load: Cleaning up ALL existing connections ===");
            await cleanupOldConnections(apiService);
          } catch (apiError) {
            console.error("API access failed despite authentication:", apiError);
            setAuthStatus("not_authenticated");
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setAuthStatus("not_authenticated");
      }
    };
    
    checkAuth();
  }, []);

  // 古い接続をクリーンアップする関数（リロード対応強化版）
  const cleanupOldConnections = async (apiService: ApiService) => {
    try {
      console.log("=== AGGRESSIVE WebSocket Connection Cleanup ===");
      
      // 最大5回試行でリロード時の残存接続も確実にクリーンアップ
      for (let attempt = 1; attempt <= 5; attempt++) {
        console.log(`🔄 Cleanup attempt ${attempt}/5`);
        
        const socketList = await apiService.socketList();
        const connectionCount = socketList.items?.length || 0;
        console.log(`📊 Found ${connectionCount} existing connections`);
        
        if (connectionCount === 0) {
          console.log("✅ No connections to clean up");
          break;
        }
        
        // 全接続を並列で強制クローズ
        console.log("🧹 Aggressively cleaning up ALL connections...");
        const closePromises = socketList.items!.map(async (socket, index) => {
          console.log(`🔌 Force closing socket ${socket.id} (${index + 1}/${connectionCount}, status: ${socket.status})`);
          try {
            await apiService.socketClose(socket.id);
            console.log(`✅ Force closed socket ${socket.id}`);
          } catch (error) {
            console.error(`❌ Failed to force close socket ${socket.id}:`, error);
            // エラーでも続行
          }
        });
        
        await Promise.all(closePromises);
        console.log(`🏁 Completed batch close of ${connectionCount} connections`);
        
        // 試行間の待機時間を段階的に増加
        if (attempt < 5) {
          const waitTime = attempt * 1000; // 1s, 2s, 3s, 4s
          console.log(`⏳ Waiting ${waitTime}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      console.log("🎯 Connection cleanup completed");
      
      // より長い待機時間でサーバー側の完全な処理完了を待つ
      console.log("⏳ Waiting for server-side cleanup completion...");
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // データベースの古いイベントをクリーンアップ（100件保持）
      EventDatabase.cleanupOldEvents(100).catch(error => {
        console.warn("IndexedDB cleanup failed (continuing anyway):", error);
      });
      
    } catch (error) {
      console.warn("🚨 Connection cleanup failed (continuing anyway):", error.message);
      
      // クリーンアップに失敗した場合は最大待機
      console.log("⏳ Fallback: Extended wait due to cleanup failure...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  };

  // WebSocket接続を初期化（認証済みの場合のみ）
  useEffect(() => {
    if (authStatus === "authenticated") {
      const handleNewEvent = (event: EventItem) => {
        console.log("=== WebSocketProvider: Received earthquake event ===");
        console.log("Event details:", JSON.stringify(event, null, 2));
        
        // すべての地震データを表示（フィルタリングしない）
        const maxIntensity = getIntensityValue(event.maxInt);
        console.log(`地震データ受信: 震度"${event.maxInt}" (数値: ${maxIntensity}), 通知震度設定: ${notificationThreshold}`);
        console.log(`震度${event.maxInt}の地震データを追加します（全データ表示）`);
        
        setEvents(prevEvents => {
          console.log("Previous events in WebSocketProvider state:", prevEvents.length);
          console.log("Looking for existing event with ID:", event.eventId);
          
          const existingIndex = prevEvents.findIndex(e => e.eventId === event.eventId);
          console.log("Existing event index:", existingIndex);
          
          let updatedEvents: EventItem[];
          let eventToSave: EventItem;
          
          if (existingIndex >= 0) {
            // 既存イベントを更新
            console.log("Updating existing event in WebSocketProvider");
            const existingEvent = prevEvents[existingIndex];
            updatedEvents = [...prevEvents];
            
            eventToSave = {
              ...existingEvent,
              maxInt: event.maxInt || existingEvent.maxInt,
              currentMaxInt: event.maxInt || event.currentMaxInt || existingEvent.currentMaxInt,
              magnitude: event.magnitude || existingEvent.magnitude,
              hypocenter: event.hypocenter || existingEvent.hypocenter,
              originTime: event.originTime || existingEvent.originTime,
              isConfirmed: event.isConfirmed || existingEvent.isConfirmed,
              isTest: existingEvent.isTest || event.isTest
            };
            
            updatedEvents[existingIndex] = eventToSave;
            console.log("Updated event in WebSocketProvider:", eventToSave);
          } else {
            // 新規イベントを追加
            console.log("Adding new event to WebSocketProvider list");
            eventToSave = {
              ...event,
              isConfirmed: event.isConfirmed !== undefined ? event.isConfirmed : true,
              currentMaxInt: event.currentMaxInt || event.maxInt,
              maxInt: event.maxInt
            };
            console.log("New event to add in WebSocketProvider:", JSON.stringify(eventToSave, null, 2));
            updatedEvents = [eventToSave, ...prevEvents];
          }
          
          // IndexedDBに自動保存
          EventDatabase.saveEvent(eventToSave).catch(error => {
            console.error("WebSocketイベントのIndexedDB自動保存に失敗:", error);
          });
          
          console.log("Final updated events count in WebSocketProvider:", updatedEvents.length);
          
          // 発生時刻降順（新しいものが上）でソート
          const sortedEvents = updatedEvents.sort((a, b) => {
            const timeA = new Date(a.originTime || a.arrivalTime).getTime();
            const timeB = new Date(b.originTime || b.arrivalTime).getTime();
            return timeB - timeA; // 降順ソート（新しいものが上）
          });
          
          return sortedEvents;
        });
        
        console.log("✅ WebSocketProvider: Event processing completed");
      };

      const handleStatusChange = (newStatus: "open" | "connecting" | "closed" | "error") => {
        console.log("WebSocketProvider: Status changed to", newStatus);
        setStatus(newStatus);
      };

      const handleTimeUpdate = (newServerTime: string, messageType: string) => {
        setServerTime(newServerTime);
        setLastMessageType(messageType);
      };

      // WebSocketマネージャーを初期化（既存のものがあれば再利用）
      if (!wsManagerRef.current) {
        console.log("WebSocketProvider: Creating new WebSocketManager");
        wsManagerRef.current = new WebSocketManager(handleNewEvent, handleStatusChange, handleTimeUpdate);
        wsManagerRef.current.connect();
      }

      // クリーンアップはコンポーネントアンマウント時のみ
      return () => {
        // コンポーネントが完全にアンマウントされる時のみクリーンアップ
        console.log("WebSocketProvider: Component cleanup on unmount");
      };
    }
  }, [authStatus]); // notificationThresholdを依存配列から除去

  const addEvent = useCallback((event: EventItem) => {
    setEvents(prevEvents => {
      const existingIndex = prevEvents.findIndex(e => e.eventId === event.eventId);
      let updatedEvents: EventItem[];
      let eventToSave: EventItem;
      
      if (existingIndex >= 0) {
        updatedEvents = [...prevEvents];
        eventToSave = { ...updatedEvents[existingIndex], ...event };
        updatedEvents[existingIndex] = eventToSave;
      } else {
        eventToSave = event;
        updatedEvents = [event, ...prevEvents];
      }
      
      // IndexedDBに自動保存
      EventDatabase.saveEvent(eventToSave).catch(error => {
        console.error("addEventでのIndexedDB自動保存に失敗:", error);
      });
      
      // 発生時刻降順（新しいものが上）でソート
      const sortedEvents = updatedEvents.sort((a, b) => {
        const timeA = new Date(a.originTime || a.arrivalTime).getTime();
        const timeB = new Date(b.originTime || b.arrivalTime).getTime();
        return timeB - timeA; // 降順ソート（新しいものが上）
      });
      
      return sortedEvents;
    });
  }, []); // 依存配列を空にして安定化

  const reconnect = () => {
    if (wsManagerRef.current) {
      console.log("WebSocketProvider: Manual reconnect requested");
      wsManagerRef.current.reconnect();
    }
  };

  const refreshAuth = async () => {
    setAuthStatus("checking");
    try {
      const oauth2Service = oauth2();
      const hasToken = await oauth2Service.refreshTokenCheck();
      setAuthStatus(hasToken ? "authenticated" : "not_authenticated");
      
      if (hasToken) {
        try {
          const apiService = new ApiService();
          await apiService.contractList();
        } catch (apiError) {
          console.error("Manual API access failed despite authentication:", apiError);
          setAuthStatus("not_authenticated");
        }
      }
    } catch (error) {
      console.error("Manual auth check failed:", error);
      setAuthStatus("not_authenticated");
    }
  };

  const clearAuth = async () => {
    try {
      const oauth2Service = oauth2();
      await oauth2Service.refreshTokenDelete();
      setAuthStatus("not_authenticated");
      
      // WebSocket接続もクリア
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
        wsManagerRef.current = null;
      }
      
      // イベントリストもクリア
      setEvents([]);
    } catch (error) {
      console.error("Failed to clear auth:", error);
    }
  };

  const handleLogin = async () => {
    try {
      const oauth2Service = oauth2();
      const authUrl = await oauth2Service.buildAuthorizationUrl();
      window.open(authUrl, '_blank');
    } catch (error) {
      console.error("Failed to build auth URL:", error);
    }
  };

  const contextValue: WebSocketContextType = {
    status,
    events,
    serverTime,
    lastMessageType,
    authStatus,
    isInitialized,
    addEvent,
    reconnect,
    refreshAuth,
    clearAuth,
    handleLogin
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}