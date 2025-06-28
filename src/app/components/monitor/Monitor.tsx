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
import { SafetyConfirmationSettings } from "../safety-confirmation/pages/SafetyConfirmationSettings";
import { useWebSocket } from "../providers/WebSocketProvider";

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
  // WebSocketProviderから状態を取得
  const { 
    status, 
    events: globalEvents, 
    serverTime, 
    lastMessageType, 
    authStatus, 
    addEvent, 
    reconnect, 
    refreshAuth, 
    clearAuth, 
    handleLogin 
  } = useWebSocket();

  const [soundPlay, setSoundPlay] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [runMapSimulation, setRunMapSimulation] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState(1); // デフォルト震度1
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(true);
  const [showSafetySettings, setShowSafetySettings] = useState<boolean>(false);

  // グローバルイベントをローカル状態に同期
  useEffect(() => {
    setEvents(globalEvents);
  }, [globalEvents]);

  // データベースからイベントを読み込み（初期化時のみ）
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
          
          // グローバル状態に追加（既存のものと重複しないように）
          correctedEvents.forEach(event => {
            addEvent(event);
          });
        }
      } catch (error) {
        console.error("IndexedDBからのイベント読み込みに失敗:", error);
      } finally {
        setIsLoadingFromDB(false);
      }
    };

    loadEventsFromDB();
  }, [addEvent]);

  // 震度を数値に変換するヘルパー関数
  const getIntensityValue = (intensity: string): number => {
    if (intensity === '5弱' || intensity === '5-') return 5.0;
    if (intensity === '5強' || intensity === '5+') return 5.5;
    if (intensity === '6弱' || intensity === '6-') return 6.0;
    if (intensity === '6強' || intensity === '6+') return 6.5;
    return parseFloat(intensity) || 0;
  };

  /* ---------- UIハンドラ例 ---------- */
  const reconnectWs = () => {
    reconnect();
  };
  
  const toggleSound = (v: boolean) => setSoundPlay(v);
  
  const toggleTestMode = () => setTestMode(!testMode);
  
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
        onOpenSafetySettings={() => setShowSafetySettings(true)}
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

          <ul className="flex-1 overflow-y-auto m-0 p-2 bg-black max-h-full">
            {events.slice(0, 20).map((ev, index) => {
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
                  return [{ ...newEvent, isConfirmed: true }, ...prevEvents];
                }
              });
            }}
            runSimulation={runMapSimulation}
            onSimulationComplete={() => setRunMapSimulation(false)}
            testMode={testMode}
            earthquakeEvents={events} // 地図用に現在のイベントを渡す
            connectionStatus={status}
            serverTime={serverTime}
            lastMessageType={lastMessageType}
          />
        </main>
      </div>

      {/* 安否確認設定モーダル */}
      {showSafetySettings && (
        <SafetyConfirmationSettings 
          onClose={() => setShowSafetySettings(false)} 
        />
      )}
    </div>
  );
}

