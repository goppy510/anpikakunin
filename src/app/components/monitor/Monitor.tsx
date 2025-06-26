/* src/app/components/monitor/Monitor.tsx */
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

import cn from "classnames";
import { ApiService } from "@/app/api/ApiService";
import { oauth2 } from "@/app/api/Oauth2Service";
import { EventItem } from "./types/EventItem";
import { LatestEventCard } from "./ui/LatestEventCard";
import { RegularEventCard } from "./ui/RegularEventCard";
import { runProgressiveSimulation } from "./utils/progressiveSimulationService";
import { WebSocketManager } from "./utils/websocketProcessor";
import { EventDatabase } from "./utils/eventDatabase";
import { CurrentTime } from "./components/CurrentTime";
import { IntensityScale } from "./components/IntensityScale";
import { MonitorHeader } from "./components/MonitorHeader";

const MapComponent = dynamic(() => import("./map/MapCompnent"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
      }}
    >
      地図を読み込み中...
    </div>
  ),
});


const dummyEvents: EventItem[] = [
  // 実際のWebSocketデータを使用するため、ダミーデータは空にする
];

export default function Monitor() {
  const [status, setStatus] = useState<
    "open" | "connecting" | "closed" | "error"
  >("closed");
  const [soundPlay, setSoundPlay] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [runMapSimulation, setRunMapSimulation] = useState(false);
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "not_authenticated">("checking");
  const [notificationThreshold, setNotificationThreshold] = useState(1); // デフォルト震度1
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(true);
  const [serverTime, setServerTime] = useState<string>("");

  // データベースからイベントを読み込み
  useEffect(() => {
    const loadEventsFromDB = async () => {
      try {
        const storedEvents = await EventDatabase.getLatestEvents(50);
        
        if (storedEvents.length > 0) {
          // 読み込み時に確定状態を修正（震源と震度の両方があれば確定）
          const correctedEvents = storedEvents.map(event => {
            const hasHypocenter = event.hypocenter?.name && event.hypocenter.name !== "震源不明";
            const hasIntensity = event.maxInt && event.maxInt !== "0" && event.maxInt !== "-";
            const shouldBeConfirmed = hasHypocenter && hasIntensity;
            
            return {
              ...event,
              isConfirmed: shouldBeConfirmed || event.isConfirmed
            };
          });
          setEvents(correctedEvents);
        } else {
        }
      } catch (error) {
        console.error("IndexedDBからのイベント読み込みに失敗:", error);
      } finally {
        setIsLoadingFromDB(false);
      }
    };

    loadEventsFromDB();
  }, []);

  // 認証状態確認
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const oauth2Service = oauth2();
        
        const hasToken = await oauth2Service.refreshTokenCheck();
        
        setAuthStatus(hasToken ? "authenticated" : "not_authenticated");
        
        // 認証済みの場合、簡単なAPI呼び出しでテスト
        if (hasToken) {
          try {
            const apiService = new ApiService();
            const contracts = await apiService.contractList();
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

  // 震度を数値に変換するヘルパー関数
  const getIntensityValue = (intensity: string): number => {
    if (intensity === '5弱' || intensity === '5-') return 5.0;
    if (intensity === '5強' || intensity === '5+') return 5.5;
    if (intensity === '6弱' || intensity === '6-') return 6.0;
    if (intensity === '6強' || intensity === '6+') return 6.5;
    return parseFloat(intensity) || 0;
  };

  // WebSocket接続を初期化
  useEffect(() => {
    if (authStatus === "authenticated") {
      const handleNewEvent = (event: EventItem) => {
        console.log("=== Monitor: Received earthquake event ===");
        console.log("Event details:", JSON.stringify(event, null, 2));
        
        // 通知震度フィルタリング
        const maxIntensity = getIntensityValue(event.maxInt);
        console.log(`地震データ受信: 震度"${event.maxInt}" (数値: ${maxIntensity}), 通知震度設定: ${notificationThreshold}`);
        
        // 震度が"-"（確認中）の場合は常に通知
        if (event.maxInt === "-") {
          console.log("震度が確認中（-）のため、フィルタリングをスキップして表示します");
        } else if (maxIntensity < notificationThreshold) {
          console.log(`地震データを受信しましたが、震度${event.maxInt}は通知震度${notificationThreshold}未満のため表示されません`);
          return; // 通知震度未満の場合は表示しない
        }
        
        console.log(`震度${event.maxInt}の地震データを追加します（通知震度${notificationThreshold}以上またはテスト）`);
        
        // 既存のイベントを更新するか新規追加
        console.log("=== Monitor: Updating events state ===");
        console.log("Current events count:", events.length);
        
        setEvents(prevEvents => {
          console.log("Previous events in state:", prevEvents.length);
          console.log("Looking for existing event with ID:", event.eventId);
          
          const existingIndex = prevEvents.findIndex(e => e.eventId === event.eventId);
          console.log("Existing event index:", existingIndex);
          
          let updatedEvents: EventItem[];
          
          if (existingIndex >= 0) {
            // 既存イベントを更新
            console.log("Updating existing event");
            const existingEvent = prevEvents[existingIndex];
            updatedEvents = [...prevEvents];
            
            // 既存イベントを動的に更新（震度・震源・マグニチュードなど）
            console.log("Updating existing event dynamically");
            console.log("Existing event:", existingEvent);
            console.log("New event data:", event);
            
            updatedEvents[existingIndex] = {
              ...existingEvent,
              // 新しいデータで更新（より詳細な情報があれば採用）
              maxInt: event.maxInt || existingEvent.maxInt,
              currentMaxInt: event.maxInt || event.currentMaxInt || existingEvent.currentMaxInt,
              magnitude: event.magnitude || existingEvent.magnitude,
              hypocenter: event.hypocenter || existingEvent.hypocenter,
              originTime: event.originTime || existingEvent.originTime,
              isConfirmed: event.isConfirmed || existingEvent.isConfirmed, // 一度確定したら確定を維持
              isTest: existingEvent.isTest || event.isTest
            };
            
            console.log("Updated event:", updatedEvents[existingIndex]);
          } else {
            // 新規イベントを追加（DMDATAからのデータは確定状態で）
            console.log("Adding new event to list");
            const newEvent = {
              ...event,
              isConfirmed: event.isConfirmed !== undefined ? event.isConfirmed : true, // processWebSocketMessageの判定を優先
              currentMaxInt: event.currentMaxInt || event.maxInt,
              maxInt: event.maxInt
            };
            console.log("New event to add:", JSON.stringify(newEvent, null, 2));
            updatedEvents = [newEvent, ...prevEvents.slice(0, 9)];
          }
          
          console.log("Final updated events count:", updatedEvents.length);
          console.log("Updated events summary:", updatedEvents.map(e => ({
            eventId: e.eventId,
            maxInt: e.maxInt,
            currentMaxInt: e.currentMaxInt,
            hypocenter: e.hypocenter?.name,
            isConfirmed: e.isConfirmed
          })));
          
          // IndexedDBに保存（非同期で実行）
          const eventToSave = updatedEvents.find(e => e.eventId === event.eventId);
          if (eventToSave) {
            EventDatabase.saveEvent(eventToSave).catch(error => {
              console.error("IndexedDBへの保存に失敗:", error);
            });
          }
          
          return updatedEvents;
        });
        
        console.log("✅ Monitor: setEvents completed");
      };

      const handleStatusChange = (newStatus: "open" | "connecting" | "closed" | "error") => {
        setStatus(newStatus);
      };

      const handleTimeUpdate = (newServerTime: string) => {
        setServerTime(newServerTime);
      };

      // WebSocketマネージャーを初期化
      wsManagerRef.current = new WebSocketManager(handleNewEvent, handleStatusChange, handleTimeUpdate);
      
      // 自動接続開始
      wsManagerRef.current.connect();

      // クリーンアップ
      return () => {
        if (wsManagerRef.current) {
          wsManagerRef.current.disconnect();
        }
      };
    }
  }, [authStatus, notificationThreshold]);

  /* ---------- UIハンドラ例 ---------- */
  const reconnectWs = () => {
    if (wsManagerRef.current) {
      wsManagerRef.current.reconnect();
    }
  };
  
  const toggleSound = (v: boolean) => setSoundPlay(v);
  
  const toggleTestMode = () => setTestMode(!testMode);
  
  const handleLogin = async () => {
    try {
      const oauth2Service = oauth2();
      const authUrl = await oauth2Service.buildAuthorizationUrl();
      window.open(authUrl, '_blank');
    } catch (error) {
      console.error("Failed to build auth URL:", error);
    }
  };
  
  const refreshAuth = async () => {
    setAuthStatus("checking");
    const checkAuth = async () => {
      try {
        const oauth2Service = oauth2();
        
        const hasToken = await oauth2Service.refreshTokenCheck();
        
        setAuthStatus(hasToken ? "authenticated" : "not_authenticated");
        
        if (hasToken) {
          try {
            const apiService = new ApiService();
            const contracts = await apiService.contractList();
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
    
    await checkAuth();
  };
  
  const clearAuth = async () => {
    try {
      const oauth2Service = oauth2();
      await oauth2Service.refreshTokenDelete();
      setAuthStatus("not_authenticated");
    } catch (error) {
      console.error("Failed to clear auth:", error);
    }
  };
  
  const cleanupConnections = async () => {
    try {
      const apiService = new ApiService();
      const socketList = await apiService.socketList();
      
      if (socketList.items && socketList.items.length > 0) {
        for (const socket of socketList.items) {
          if (socket.status === 'open' || socket.status === 'waiting') {
            await apiService.socketClose(socket.id);
          }
        }
      } else {
      }
    } catch (error) {
      console.error("Manual cleanup failed:", error);
    }
  };


  
  // イベント確定処理
  const confirmEvent = (eventId: string) => {
    setEvents(prevEvents => {
      return prevEvents.map(event => {
        if (event.eventId === eventId && !event.isConfirmed) {
          const confirmedEvent = {
            ...event,
            isConfirmed: true,
            maxInt: event.currentMaxInt || event.maxInt // 現在の震度を確定
          };
          
          // IndexedDBに保存
          EventDatabase.saveEvent(confirmedEvent).catch(error => {
            console.error("確定イベントのIndexedDB保存に失敗:", error);
          });
          
          return confirmedEvent;
        }
        return event;
      });
    });
  };

  const runTestSimulation = () => {
    // 既存の未確定イベントを探す
    const unconfirmedEvent = events.find(event => !event.isConfirmed);
    
    if (unconfirmedEvent) {
      const targetEventId = unconfirmedEvent.eventId;
      
      // ステップ1: 3秒後に震度を段階的に更新（確認中のまま）
      setTimeout(() => {
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === targetEventId 
              ? { ...event, currentMaxInt: "3" }
              : event
          )
        );
      }, 3000);
      
      // ステップ2: 6秒後にさらに震度更新
      setTimeout(() => {
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === targetEventId 
              ? { ...event, currentMaxInt: "4" }
              : event
          )
        );
      }, 6000);
      
      // ステップ3: 9秒後に最終確定
      setTimeout(() => {
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === targetEventId 
              ? { 
                  ...event, 
                  maxInt: "4", // 確定震度
                  hypocenter: { name: "千葉県東方沖", depth: { value: 30 } },
                  magnitude: { value: 5.2 },
                  isConfirmed: true 
                }
              : event
          )
        );
      }, 9000);
    } else {
      // 未確定イベントがない場合は新規作成してシミュレート
      const testEventId = `test-${Date.now()}`;
      
      const initialEvent: EventItem = {
        eventId: testEventId,
        arrivalTime: new Date().toISOString(),
        originTime: new Date(Date.now() - 120000).toISOString(), // 2分前
        maxInt: "-", // 確認中なのでハイフン
        currentMaxInt: "2", // 地図用の初期震度
        magnitude: undefined,
        hypocenter: { name: "テスト震源" },
        isConfirmed: false,
        isTest: true
      };
      
      
      // 初期イベントを追加
      setEvents(prevEvents => [initialEvent, ...prevEvents.slice(0, 9)]);
      
      // 以下は上記と同じシミュレーション処理
      setTimeout(() => {
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === testEventId 
              ? { ...event, currentMaxInt: "3" }
              : event
          )
        );
      }, 3000);
      
      setTimeout(() => {
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === testEventId 
              ? { ...event, currentMaxInt: "4" }
              : event
          )
        );
      }, 6000);
      
      setTimeout(() => {
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === testEventId 
              ? { 
                  ...event, 
                  maxInt: "4", // 確定震度
                  hypocenter: { name: "テスト震源（確定）", depth: { value: 30 } },
                  magnitude: { value: 5.2 },
                  isConfirmed: true 
                }
              : event
          )
        );
      }, 9000);
    }
    
    // マップシミュレーションも実行
    setRunMapSimulation(true);
    setTimeout(() => setRunMapSimulation(false), 100);
  };

  return (
    <div className="flex flex-col flex-wrap w-screen h-screen max-h-screen">
      {/* Header */}
      <MonitorHeader
        authStatus={authStatus}
        status={status}
        soundPlay={soundPlay}
        notificationThreshold={notificationThreshold}
        testMode={testMode}
        onLogin={handleLogin}
        onClearAuth={clearAuth}
        onRefreshAuth={refreshAuth}
        onToggleSound={toggleSound}
        onNotificationThresholdChange={setNotificationThreshold}
        onToggleTestMode={toggleTestMode}
        onRunTestSimulation={runTestSimulation}
      />

      {/* main -------------------------------------------------------- */}
      <div className="z-[5] flex flex-1 max-h-full overflow-hidden">
        {/* ---- event list ---- */}
        <aside className="flex flex-col w-[380px] max-w-[380px]">
          <header className="py-1 bg-red-600 text-center border-b-2 border-red-700">
            <h3 className="text-xs font-bold text-white tracking-wide leading-tight">
              地震情報 [{events.length}] {isLoadingFromDB && <span className="text-yellow-300">(読み込み中...)</span>}
            </h3>
          </header>

          <ul className="flex-1 overflow-y-scroll m-0 p-2 bg-black">
            {events.map((ev, index) => {
              const isLatest = index === 0;
              const isSelected = viewEventId === ev.eventId;
              
              return isLatest ? (
                <LatestEventCard
                  key={ev.eventId}
                  event={ev}
                  isSelected={isSelected}
                  onClick={() => setViewEventId(ev.eventId)}
                />
              ) : (
                <RegularEventCard
                  key={ev.eventId}
                  event={ev}
                  isSelected={isSelected}
                  onClick={() => setViewEventId(ev.eventId)}
                />
              );
            })}
          </ul>
        </aside>

        {/* ---- event-data/map ---- */}
        <main className="flex-1 bg-gray-50">
          <MapComponent
            onEarthquakeUpdate={(newEvent) => {
              // MapComponentからのイベントは確定済みとして処理
              setEvents((prevEvents) => {
                const existingIndex = prevEvents.findIndex(e => e.eventId === newEvent.eventId);
                if (existingIndex >= 0) {
                  // 既存イベントを更新
                  const updatedEvents = [...prevEvents];
                  updatedEvents[existingIndex] = {
                    ...updatedEvents[existingIndex],
                    ...newEvent,
                    eventId: newEvent.eventId,
                    isConfirmed: true // MapComponentからは確定済み
                  };
                  return updatedEvents;
                } else {
                  // 新規イベントを追加
                  return [{ ...newEvent, isConfirmed: true }, ...prevEvents.slice(0, 9)];
                }
              });
            }}
            runSimulation={runMapSimulation}
            onSimulationComplete={() => setRunMapSimulation(false)}
            testMode={testMode}
            earthquakeEvents={events} // 地図用に現在のイベントを渡す
            connectionStatus={status}
            serverTime={serverTime}
          />
        </main>
      </div>
    </div>
  );
}

