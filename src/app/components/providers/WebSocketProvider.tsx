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

  // ページ完全離脱時のクリーンアップ（タブ切り替えでは切断しない）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsManagerRef.current) {
        console.log("Page unload detected, disconnecting WebSocket...");
        wsManagerRef.current.disconnect();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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
            
            // 古い接続をクリーンアップ
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

  // 古い接続をクリーンアップする関数
  const cleanupOldConnections = async (apiService: ApiService) => {
    try {
      console.log("=== WebSocket Connection Cleanup ===");
      
      // 複数回試行してすべての接続を確実にクリーンアップ
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`Cleanup attempt ${attempt}/3`);
        
        const socketList = await apiService.socketList();
        console.log(`Found ${socketList.items?.length || 0} existing connections`);
        
        if (!socketList.items || socketList.items.length === 0) {
          console.log("No connections to clean up");
          break;
        }
        
        console.log("Cleaning up connections...");
        const closePromises = socketList.items.map(async (socket) => {
          console.log(`Closing socket ${socket.id} (status: ${socket.status})`);
          try {
            await apiService.socketClose(socket.id);
            console.log(`✅ Closed socket ${socket.id}`);
          } catch (error) {
            console.error(`❌ Failed to close socket ${socket.id}:`, error);
          }
        });
        
        await Promise.all(closePromises);
        
        // 次の試行前に少し待つ
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log("Connection cleanup completed");
      
      // 新しい接続開始前により長い待機時間
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // データベースの古いイベントをクリーンアップ（100件保持）
      EventDatabase.cleanupOldEvents(100).catch(error => {
        console.warn("IndexedDB cleanup failed (continuing anyway):", error);
      });
      
    } catch (error) {
      console.warn("Connection cleanup failed (continuing anyway):", error.message);
      
      // クリーンアップに失敗した場合でもより長く待つ
      await new Promise(resolve => setTimeout(resolve, 3000));
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