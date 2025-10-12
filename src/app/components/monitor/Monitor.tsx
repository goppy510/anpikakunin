/* src/app/components/monitor/Monitor.tsx */
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

import { ApiService } from "@/app/api/ApiService";
import { EventItem } from "./types/EventItem";
import { TsunamiWarning } from "./types/TsunamiTypes";
import { LatestEventCard } from "./ui/LatestEventCard";
import { RegularEventCard } from "./ui/RegularEventCard";
import { EventDatabase } from "./utils/eventDatabase";
import { MonitorHeader } from "./components/MonitorHeader";
import { SafetyConfirmationSettings } from "../safety-confirmation/pages/SafetyConfirmationSettings";
import { useWebSocket } from "../providers/WebSocketProvider";
import { getSettings, setSetting } from "@/app/utils/settings";
import { AudioManager } from "@/app/utils/audioManager";

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



export default function Monitor() {
  // WebSocketProviderから状態を取得
  const { 
    status, 
    events: globalEvents,
    tsunamiWarnings: globalTsunamiWarnings,
    serverTime, 
    lastMessageType, 
    authStatus, 
    addEvent,
    addTsunamiWarning,
    reconnect, 
    refreshAuth, 
    clearAuth, 
    handleLogin 
  } = useWebSocket();

  const [soundPlay, setSoundPlay] = useState(false);
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [runMapSimulation, setRunMapSimulation] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState(1); // デフォルト震度1
  const [showSafetySettings, setShowSafetySettings] = useState<boolean>(false);
  const audioManager = useRef<AudioManager>(AudioManager.getInstance());

  // 設定の初期化（ローカルストレージから読み込み）
  useEffect(() => {
    const settings = getSettings();
    setSoundPlay(settings.soundEnabled);
    setNotificationThreshold(settings.notificationThreshold);
    setTestMode(settings.testMode);
    audioManager.current.setEnabled(settings.soundEnabled);
  }, []);

  // 音声通知用の前回のイベント数を記録
  const [previousEventCount, setPreviousEventCount] = useState(0);
  
  // 新しいイベントが追加された時の音声通知
  useEffect(() => {
    // 新しいイベントが追加された時の音声通知（増加した場合のみ）
    if (globalEvents.length > previousEventCount && globalEvents.length > 0 && soundPlay) {
      const latestEvent = globalEvents[0];
      if (latestEvent && !latestEvent.isTest) {
        const intensity = getIntensityValue(latestEvent.maxInt || "0");
        if (intensity >= notificationThreshold) {
          audioManager.current.playAlert(intensity);
        } else {
        }
      }
    }
    setPreviousEventCount(globalEvents.length);
  }, [globalEvents.length, soundPlay, notificationThreshold, previousEventCount, globalEvents]);
  
  // テストモードの変更を監視（津波警報はWebSocketProviderで管理）
  useEffect(() => {
    if (!testMode) {
    }
  }, [testMode]);
  
  // 津波シミュレーションハンドラー
  const handleTsunamiSimulation = (warning: TsunamiWarning) => {
    addTsunamiWarning(warning);
  };

  // データベースからイベントを読み込み（初期化時のみ）
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false);
  
  useEffect(() => {
    const loadEventsFromDB = async () => {
      if (hasLoadedFromDB) return; // 重複実行を防止
      
      try {
        const storedEvents = await EventDatabase.getLatestEvents(30);
        
        if (storedEvents.length > 0) {
          // DBからのイベントをWebSocketProviderの状態に設定
          storedEvents.forEach(event => addEvent(event));
        }
        
        setHasLoadedFromDB(true);
      } catch (error) {
        setHasLoadedFromDB(true);
      }
    };

    // 初回のみ実行
    if (!hasLoadedFromDB) {
      loadEventsFromDB();
    }
  }, [hasLoadedFromDB, addEvent]);


  // 震度を数値に変換するヘルパー関数
  const getIntensityValue = (intensity: string): number => {
    if (intensity === '5弱' || intensity === '5-') return 5.0;
    if (intensity === '5強' || intensity === '5+') return 5.5;
    if (intensity === '6弱' || intensity === '6-') return 6.0;
    if (intensity === '6強' || intensity === '6+') return 6.5;
    return parseFloat(intensity) || 0;
  };

  /* ---------- UIハンドラ例 ---------- */
  
  const toggleSound = async (v: boolean) => {
    setSoundPlay(v);
    setSetting('soundEnabled', v);
    audioManager.current.setEnabled(v);
    
    // 音声有効化時にテスト音を再生
    if (v) {
      await audioManager.current.playTestSound();
    }
  };
  
  const toggleTestMode = () => {
    const newTestMode = !testMode;
    setTestMode(newTestMode);
    setSetting('testMode', newTestMode);
  };
  
  const handleNotificationThresholdChange = (threshold: number) => {
    setNotificationThreshold(threshold);
    setSetting('notificationThreshold', threshold);
  };
  
  const cleanupConnections = async () => {
    try {
      const apiService = new ApiService();
      
      // 緊急時は10回試行で確実にクリーンアップ
      for (let attempt = 1; attempt <= 10; attempt++) {
        
        const socketList = await apiService.socketList();
        const connectionCount = socketList.items?.length || 0;
        
        if (connectionCount === 0) {
          break;
        }
        
        // 全接続を並列で強制終了
        const closePromises = socketList.items!.map(async (socket, index) => {
          try {
            await apiService.socketClose(socket.id);
          } catch (error) {
          }
        });
        
        await Promise.all(closePromises);
        
        // 段階的待機時間 (最大7秒)
        if (attempt < 10) {
          const waitTime = Math.min(attempt * 800, 7000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      
      // 最終待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // クリーンアップ後にWebSocketを再接続
      reconnect();
      
    } catch (error) {
    }
  };


  

  const runTestSimulation = () => {
    // 既存の未確定イベントを探す
    const unconfirmedEvent = globalEvents.find(event => !event.isConfirmed);
    
    if (unconfirmedEvent) {
      
      // ステップ1: 3秒後に震度を段階的に更新（確認中のまま）
      setTimeout(() => {
        const updatedEvent = { ...unconfirmedEvent, currentMaxInt: "3" };
        addEvent(updatedEvent);
      }, 3000);
      
      // ステップ2: 6秒後にさらに震度更新
      setTimeout(() => {
        const updatedEvent = { ...unconfirmedEvent, currentMaxInt: "4" };
        addEvent(updatedEvent);
      }, 6000);
      
      // ステップ3: 9秒後に最終確定
      setTimeout(() => {
        const finalEvent = { 
          ...unconfirmedEvent, 
          maxInt: "4", // 確定震度
          hypocenter: { name: "千葉県東方沖", depth: { value: 30 } },
          magnitude: { value: 5.2 },
          isConfirmed: true 
        };
        addEvent(finalEvent);
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
      addEvent(initialEvent);
      
      // 以下は上記と同じシミュレーション処理
      setTimeout(() => {
        const updatedEvent = { ...initialEvent, currentMaxInt: "3" };
        addEvent(updatedEvent);
      }, 3000);
      
      setTimeout(() => {
        const updatedEvent = { ...initialEvent, currentMaxInt: "4" };
        addEvent(updatedEvent);
      }, 6000);
      
      setTimeout(() => {
        const finalEvent = { 
          ...initialEvent, 
          maxInt: "4", // 確定震度
          hypocenter: { name: "テスト震源（確定）", depth: { value: 30 } },
          magnitude: { value: 5.2 },
          isConfirmed: true 
        };
        addEvent(finalEvent);
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
        onNotificationThresholdChange={handleNotificationThresholdChange}
        onToggleTestMode={toggleTestMode}
        onRunTestSimulation={runTestSimulation}
        onOpenSafetySettings={() => setShowSafetySettings(true)}
        onCleanupConnections={cleanupConnections}
      />

      {/* main -------------------------------------------------------- */}
      <div className="z-[5] flex flex-1 max-h-full overflow-hidden">
        {/* ---- event list ---- */}
        <aside className="flex flex-col w-[380px] max-w-[380px]">
          <ul className="flex-1 overflow-y-auto m-0 p-2 bg-black max-h-full">
            {globalEvents.slice(0, 50).map((ev, index) => {
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
              const eventWithConfirmed = {
                ...newEvent,
                isConfirmed: true // MapComponentからは確定済み
              };
              addEvent(eventWithConfirmed);
            }}
            onTsunamiSimulation={handleTsunamiSimulation}
            runSimulation={runMapSimulation}
            onSimulationComplete={() => setRunMapSimulation(false)}
            testMode={testMode}
            earthquakeEvents={globalEvents} // 地図用にグローバルイベントを渡す
            tsunamiWarnings={globalTsunamiWarnings} // 津波警報データを渡す
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

