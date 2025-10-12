"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { WebSocketManager } from "@/app/components/monitor/utils/websocketProcessor";
import { EventItem } from "@/app/components/monitor/types/EventItem";
import { TsunamiWarning } from "@/app/components/monitor/types/TsunamiTypes";
import { oauth2 } from "@/app/api/Oauth2Service";
import { ApiService } from "@/app/api/ApiService";
import { EventDatabase } from "@/app/components/monitor/utils/eventDatabase";
import { logEarthquakeEvent } from "@/app/components/monitor/utils/eventLogService";

interface WebSocketContextType {
  status: "open" | "connecting" | "closed" | "error";
  events: EventItem[];
  tsunamiWarnings: TsunamiWarning[];
  serverTime: string;
  lastMessageType: string;
  authStatus: "checking" | "authenticated" | "not_authenticated";
  isInitialized: boolean;
  responseCount: number;
  addEvent: (event: EventItem) => void;
  addTsunamiWarning: (warning: TsunamiWarning) => void;
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
  const [status, setStatus] = useState<
    "open" | "connecting" | "closed" | "error"
  >("closed");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tsunamiWarnings, setTsunamiWarnings] = useState<TsunamiWarning[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [serverTime, setServerTime] = useState<string>("");
  const [lastMessageType, setLastMessageType] = useState<string>("");
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "not_authenticated"
  >("checking");
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const notificationServiceRef = useRef<any>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  // ページ離脱時とフォーカス管理
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
      }
    };

    // ページがフォーカスを取り戻した時の接続チェック
    const handleVisibilityChange = () => {
      if (!document.hidden && authStatus === "authenticated") {
        // フォーカス復帰時に接続状態をチェック
        if (
          !wsManagerRef.current ||
          status === "closed" ||
          status === "error"
        ) {
          setTimeout(() => {
            if (wsManagerRef.current) {
              wsManagerRef.current.reconnect();
            }
          }, 1000);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authStatus, status]);

  // 震度を数値に変換するヘルパー関数
  const getIntensityValue = (intensity: string): number => {
    if (intensity === "5弱" || intensity === "5-") return 5.0;
    if (intensity === "5強" || intensity === "5+") return 5.5;
    if (intensity === "6弱" || intensity === "6-") return 6.0;
    if (intensity === "6強" || intensity === "6+") return 6.5;
    return parseFloat(intensity) || 0;
  };

  // 初期データ読み込み
  useEffect(() => {
    const loadInitialData = async () => {
      if (hasLoadedInitialData) return;
      
      try {
        const storedEvents = await EventDatabase.getLatestEvents(30);
        if (storedEvents.length > 0) {
          setEvents(storedEvents);
        }
        setHasLoadedInitialData(true);
      } catch (error) {
        setHasLoadedInitialData(true);
      }
    };

    loadInitialData();
  }, [hasLoadedInitialData]);

  // 認証状態確認とWebSocket接続クリーンアップ
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const oauth2Service = oauth2();
        const hasToken = await oauth2Service.refreshTokenCheck();

        if (hasToken) {
          try {
            const apiService = new ApiService();
            await apiService.contractList();

            // リロード時は必ず全接続をクリーンアップしてから認証状態を設定
            await cleanupOldConnections(apiService);
            setAuthStatus("authenticated");
          } catch (apiError) {
            setAuthStatus("not_authenticated");
          }
        } else {
          setAuthStatus("not_authenticated");
        }
      } catch (error) {
        setAuthStatus("not_authenticated");
      }
    };

    checkAuth();
  }, []);

  // 古い接続をクリーンアップする関数（強化版）
  const cleanupOldConnections = async (apiService: ApiService) => {
    try {

      // より徹底的なクリーンアップ: 5回試行
      for (let attempt = 1; attempt <= 5; attempt++) {

        const socketList = await apiService.socketList();
        const connectionCount = socketList.items?.length || 0;

        if (connectionCount === 0) {
          break;
        }

        // 全接続を順次クローズ（並列処理をやめて安全に）
        for (const socket of socketList.items!) {
          try {
            await apiService.socketClose(socket.id);
            // 各クローズ後に少し待機
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (error) {
          }
        }

        // サーバー側の処理完了を確実に待つ
        if (attempt < 5) {
          const waitTime = attempt * 1000; // 段階的に待機時間を増加
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }


      // 最終確認用の待機時間
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // データベースのクリーンアップ（30件保持のみ）
      EventDatabase.cleanupOldEvents(30).catch((error) => {
      });
    } catch (error) {
      // クリーンアップに失敗した場合は長めの待機
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  };

  const upsertEvent = useCallback(
    (incomingEvent: EventItem) => {
      setEvents((prevEvents) => {
        const existingIndex = prevEvents.findIndex(
          (e) => e.eventId === incomingEvent.eventId
        );

        let updatedEvents: EventItem[];
        let eventToSave: EventItem;

        if (existingIndex >= 0) {
          const existingEvent = prevEvents[existingIndex];
          eventToSave = {
            ...existingEvent,
            ...incomingEvent,
            maxInt: incomingEvent.maxInt ?? existingEvent.maxInt,
            currentMaxInt:
              incomingEvent.currentMaxInt ??
              incomingEvent.maxInt ??
              existingEvent.currentMaxInt ??
              existingEvent.maxInt,
            magnitude: incomingEvent.magnitude ?? existingEvent.magnitude,
            hypocenter: incomingEvent.hypocenter ?? existingEvent.hypocenter,
            originTime: incomingEvent.originTime ?? existingEvent.originTime,
            arrivalTime: incomingEvent.arrivalTime ?? existingEvent.arrivalTime,
            isConfirmed:
              incomingEvent.isConfirmed ?? existingEvent.isConfirmed ?? false,
            isTest: existingEvent.isTest || incomingEvent.isTest,
          };

          updatedEvents = [...prevEvents];
          updatedEvents[existingIndex] = eventToSave;
        } else {
          eventToSave = {
            ...incomingEvent,
            isConfirmed: incomingEvent.isConfirmed ?? false,
            currentMaxInt:
              incomingEvent.currentMaxInt ?? incomingEvent.maxInt ?? "-",
          };

          if (!eventToSave.currentMaxInt) {
            eventToSave.currentMaxInt = eventToSave.maxInt;
          }

          updatedEvents = [eventToSave, ...prevEvents];
        }

        EventDatabase.saveEvent(eventToSave)
          .then(async () => {
            if (Math.random() < 0.1) {
              try {
                await EventDatabase.cleanupOldEvents(30);
              } catch (cleanupError) {
              }
            }
          })
          .catch((error) => {
          });

        const sortedEvents = updatedEvents.sort((a, b) => {
          const timeA = new Date(a.originTime || a.arrivalTime).getTime();
          const timeB = new Date(b.originTime || b.arrivalTime).getTime();
          return timeB - timeA;
        });

        return sortedEvents;
      });

      setIsInitialized(true);
    },
    [setIsInitialized]
  );

  // WebSocket接続を初期化（認証済みの場合のみ）
  useEffect(() => {
    if (authStatus === "authenticated") {
      const handleNewEvent = (event: EventItem) => {
        const maxIntensity = getIntensityValue(event.maxInt);

        const normalizedEvent: EventItem = {
          ...event,
          currentMaxInt: event.currentMaxInt ?? event.maxInt,
        };

        upsertEvent(normalizedEvent);
        void logEarthquakeEvent(normalizedEvent, "websocket");

      };

      const handleStatusChange = (
        newStatus: "open" | "connecting" | "closed" | "error"
      ) => {
        setStatus(newStatus);
      };

      const handleTimeUpdate = (newServerTime: string, messageType: string) => {
        setServerTime(newServerTime);
        setLastMessageType(messageType);
        
        // レスポンスカウントを増加（点滅トリガー）
        setResponseCount(prev => prev + 1);
      };

      const handleTsunamiWarning = (warning: TsunamiWarning) => {
        setTsunamiWarnings((prevWarnings) => {
          const existingIndex = prevWarnings.findIndex(
            (w) => w.id === warning.id
          );
          let updatedWarnings: TsunamiWarning[];

          if (existingIndex >= 0) {
            // 既存の警報を更新
            updatedWarnings = [...prevWarnings];
            updatedWarnings[existingIndex] = warning;
          } else {
            // 新しい警報を追加
            updatedWarnings = [warning, ...prevWarnings];
          }

          // 解除された警報を除去
          return updatedWarnings.filter((w) => !w.isCancel);
        });
      };

      // WebSocketマネージャーを初期化（既存のものがあれば再利用）
      if (!wsManagerRef.current) {
        wsManagerRef.current = new WebSocketManager(
          handleNewEvent,
          handleStatusChange,
          handleTimeUpdate,
          handleTsunamiWarning
        );
        wsManagerRef.current.connect();
      }

      // クリーンアップはコンポーネントアンマウント時のみ
      return () => {
        // コンポーネントが完全にアンマウントされる時のみクリーンアップ
      };
    }
  }, [authStatus]);

  const addEvent = useCallback((event: EventItem) => {
    setEvents((prevEvents) => {
      const existingIndex = prevEvents.findIndex(
        (e) => e.eventId === event.eventId
      );
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
      EventDatabase.saveEvent(eventToSave).catch((error) => {
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

  const addTsunamiWarning = useCallback((warning: TsunamiWarning) => {
    setTsunamiWarnings((prevWarnings) => {
      const existingIndex = prevWarnings.findIndex((w) => w.id === warning.id);
      let updatedWarnings: TsunamiWarning[];

      if (existingIndex >= 0) {
        updatedWarnings = [...prevWarnings];
        updatedWarnings[existingIndex] = warning;
      } else {
        updatedWarnings = [warning, ...prevWarnings];
      }

      // 解除された警報を除去
      return updatedWarnings.filter((w) => !w.isCancel);
    });
  }, []);

  const reconnect = () => {
    if (wsManagerRef.current) {
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
          setAuthStatus("not_authenticated");
        }
      }
    } catch (error) {
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
      setTsunamiWarnings([]);
    } catch (error) {
    }
  };

  const handleLogin = async () => {
    try {
      const oauth2Service = oauth2();
      const authUrl = await oauth2Service.buildAuthorizationUrl();
      window.open(authUrl, "_blank");
    } catch (error) {
    }
  };

  const contextValue: WebSocketContextType = {
    status,
    events,
    tsunamiWarnings,
    serverTime,
    lastMessageType,
    authStatus,
    isInitialized,
    responseCount,
    addEvent,
    addTsunamiWarning,
    reconnect,
    refreshAuth,
    clearAuth,
    handleLogin,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}
