/* src/app/components/monitor/Monitor.tsx */
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

console.log("Monitor component loaded");
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
  {
    eventId: "20250428120000",
    arrivalTime: "2025-04-28T12:00:00+09:00",
    originTime: "2025-04-28T11:58:10+09:00",
    maxInt: "-",
    currentMaxInt: "4",
    magnitude: { value: 5.8 },
    hypocenter: { name: "茨城県沖", depth: { value: 50 } },
    isConfirmed: false,
  },
  // …モックデータ続く
];

export default function Monitor() {
  const [status, setStatus] = useState<
    "open" | "connecting" | "closed" | "error"
  >("closed");
  const [soundPlay, setSoundPlay] = useState(false);
  const [events, setEvents] = useState<EventItem[]>(dummyEvents);
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
        console.log("IndexedDBから地震イベントを読み込み中...");
        const storedEvents = await EventDatabase.getLatestEvents(50);
        
        if (storedEvents.length > 0) {
          setEvents(storedEvents);
          console.log(`IndexedDBから ${storedEvents.length}件 の地震イベントを復元しました`);
        } else {
          console.log("IndexedDBに保存された地震イベントはありません");
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
        console.log("=== Authentication Check ===");
        const oauth2Service = oauth2();
        
        // 詳細な認証状態をデバッグ
        await oauth2Service.debugTokenStatus();
        
        const hasToken = await oauth2Service.refreshTokenCheck();
        console.log("Authentication check result:", hasToken);
        
        setAuthStatus(hasToken ? "authenticated" : "not_authenticated");
        
        // 認証済みの場合、簡単なAPI呼び出しでテスト
        if (hasToken) {
          try {
            const apiService = new ApiService();
            const contracts = await apiService.contractList();
            console.log("Contract verification successful:", contracts);
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
        console.log("Received earthquake event:", event);
        
        // 通知震度フィルタリング
        const maxIntensity = getIntensityValue(event.maxInt);
        if (maxIntensity < notificationThreshold) {
          console.log(`地震データを受信しましたが、震度${event.maxInt}は通知震度${notificationThreshold}未満のため表示されません`);
          return; // 通知震度未満の場合は表示しない
        }
        
        console.log(`震度${event.maxInt}の地震データを追加します（通知震度${notificationThreshold}以上）`);
        
        // 既存のイベントを更新するか新規追加
        setEvents(prevEvents => {
          const existingIndex = prevEvents.findIndex(e => e.eventId === event.eventId);
          let updatedEvents: EventItem[];
          
          if (existingIndex >= 0) {
            // 既存イベントを更新
            const existingEvent = prevEvents[existingIndex];
            updatedEvents = [...prevEvents];
            
            // 既存イベントが確定済みの場合は震度を更新しない
            if (existingEvent.isConfirmed) {
              // 確定済みの場合は地図用の現在震度のみ更新
              updatedEvents[existingIndex] = {
                ...existingEvent,
                currentMaxInt: event.maxInt
              };
            } else {
              // 未確定の場合は現在震度のみ更新、表示震度は保持
              updatedEvents[existingIndex] = {
                ...existingEvent,
                currentMaxInt: event.maxInt,
                // その他の情報は更新（震源、マグニチュードなど）
                magnitude: event.magnitude || existingEvent.magnitude,
                hypocenter: event.hypocenter || existingEvent.hypocenter,
                originTime: event.originTime || existingEvent.originTime
              };
            }
          } else {
            // 新規イベントを追加（確認中状態で）
            const newEvent = {
              ...event,
              isConfirmed: false,
              currentMaxInt: event.maxInt,
              maxInt: "-" // 震度はハイフン表示
            };
            updatedEvents = [newEvent, ...prevEvents.slice(0, 9)];
          }
          
          // IndexedDBに保存（非同期で実行）
          const eventToSave = updatedEvents.find(e => e.eventId === event.eventId);
          if (eventToSave) {
            EventDatabase.saveEvent(eventToSave).catch(error => {
              console.error("IndexedDBへの保存に失敗:", error);
            });
          }
          
          return updatedEvents;
        });
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
        console.log("=== Manual Authentication Refresh ===");
        const oauth2Service = oauth2();
        
        await oauth2Service.debugTokenStatus();
        const hasToken = await oauth2Service.refreshTokenCheck();
        console.log("Manual auth check result:", hasToken);
        
        setAuthStatus(hasToken ? "authenticated" : "not_authenticated");
        
        if (hasToken) {
          try {
            const apiService = new ApiService();
            const contracts = await apiService.contractList();
            console.log("Manual contract verification successful:", contracts);
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
      console.log("Authentication cleared");
    } catch (error) {
      console.error("Failed to clear auth:", error);
    }
  };
  
  const cleanupConnections = async () => {
    try {
      const apiService = new ApiService();
      console.log("Manual cleanup: Listing connections...");
      const socketList = await apiService.socketList();
      console.log("Found connections:", socketList.items?.length || 0);
      
      if (socketList.items && socketList.items.length > 0) {
        for (const socket of socketList.items) {
          if (socket.status === 'open' || socket.status === 'waiting') {
            console.log(`Manual cleanup: Closing socket ${socket.id}`);
            await apiService.socketClose(socket.id);
          }
        }
        console.log("Manual cleanup complete");
      } else {
        console.log("No connections to clean up");
      }
    } catch (error) {
      console.error("Manual cleanup failed:", error);
    }
  };

  const cleanupDatabase = async () => {
    if (confirm("データベースの古いイベントを削除しますか？（最新100件のみ残します）")) {
      try {
        await EventDatabase.cleanupOldEvents(100);
        const stats = await EventDatabase.getStats();
        alert(`クリーンアップ完了\n保存イベント数: ${stats.totalEvents}件`);
      } catch (error) {
        console.error("Database cleanup failed:", error);
        alert("データベースのクリーンアップに失敗しました");
      }
    }
  };

  const clearDatabase = async () => {
    if (confirm("すべての地震イベントデータを削除しますか？\nこの操作は取り消せません。")) {
      try {
        await EventDatabase.clearAll();
        setEvents([]);
        alert("すべての地震イベントデータを削除しました");
      } catch (error) {
        console.error("Database clear failed:", error);
        alert("データベースのクリアに失敗しました");
      }
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
      console.log("テストシミュレーション開始: 既存の確認中イベントを更新", unconfirmedEvent.eventId);
      const targetEventId = unconfirmedEvent.eventId;
      
      // ステップ1: 3秒後に震度を段階的に更新（確認中のまま）
      setTimeout(() => {
        console.log("震度更新: → 3（確認中のまま）");
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
        console.log("震度更新: 3 → 4（確認中のまま）");
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
        console.log("最終確定: 震度4、震源確定");
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
        hypocenter: { name: "震源不明" },
        isConfirmed: false,
        isTest: true
      };
      
      console.log("テストシミュレーション開始: 新規確認中状態で地震イベントを追加");
      
      // 初期イベントを追加
      setEvents(prevEvents => [initialEvent, ...prevEvents.slice(0, 9)]);
      
      // 以下は上記と同じシミュレーション処理
      setTimeout(() => {
        console.log("震度更新: 2 → 3（確認中のまま）");
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === testEventId 
              ? { ...event, currentMaxInt: "3" }
              : event
          )
        );
      }, 3000);
      
      setTimeout(() => {
        console.log("震度更新: 3 → 4（確認中のまま）");
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === testEventId 
              ? { ...event, currentMaxInt: "4" }
              : event
          )
        );
      }, 6000);
      
      setTimeout(() => {
        console.log("最終確定: 震度4、震源確定");
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.eventId === testEventId 
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
    }
    
    // マップシミュレーションも実行
    setRunMapSimulation(true);
    setTimeout(() => setRunMapSimulation(false), 100);
  };

  return (
    <div className="flex flex-col flex-wrap w-screen h-screen max-h-screen">
      {/* settings bar ------------------------------------------------ */}
      <div className="flex text-white text-sm leading-[36px] min-h-[36px] bg-gray-800 border-b border-gray-700">
        {/* 認証状態 */}
        <div className="flex items-center mx-3">
          {authStatus === "not_authenticated" ? (
            <button
              className="mx-1 px-3 py-1 border border-blue-500 rounded bg-blue-900 hover:bg-blue-800 text-blue-300 transition-colors text-xs"
              onClick={handleLogin}
            >
              DMDATA認証
            </button>
          ) : (
            <>
              <span
                className={cn(
                  "mx-1 px-2 py-1 rounded text-xs font-medium",
                  {
                    checking: "border border-yellow-500 bg-yellow-900 text-yellow-300",
                    authenticated: "border border-green-500 bg-green-900 text-green-300",
                    not_authenticated: "border border-red-500 bg-red-900 text-red-300",
                  }[authStatus]
                )}
              >
                認証: {authStatus === "checking" ? "確認中" : "済"}
              </span>
              {authStatus === "authenticated" && (
                <button
                  className="mx-1 px-2 py-1 border border-red-500 rounded bg-red-900 hover:bg-red-800 text-red-300 transition-colors text-xs"
                  onClick={clearAuth}
                >
                  クリア
                </button>
              )}
            </>
          )}
          <button
            className="mx-1 px-2 py-1 border border-gray-500 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors text-xs"
            onClick={refreshAuth}
          >
            更新
          </button>
        </div>

        {/* WebSocket 操作 */}
        <div className="flex items-center mx-3">
          <button
            className="mx-1 px-3 py-1 border border-gray-600 rounded bg-gray-700 hover:bg-gray-600 transition-colors text-xs"
            onClick={reconnectWs}
            disabled={status === "connecting" || authStatus !== "authenticated"}
          >
            {status === "connecting" ? "接続中..." : "再接続"}
          </button>
          <button
            className="mx-1 px-2 py-1 border border-orange-500 rounded bg-orange-900 hover:bg-orange-800 text-orange-300 transition-colors text-xs"
            onClick={cleanupConnections}
            disabled={authStatus !== "authenticated"}
          >
            接続クリア
          </button>
          <span
            className={cn(
              "mx-1 px-2 py-1 rounded text-xs font-medium",
              {
                open: "border border-green-500 bg-green-900 text-green-300",
                connecting: "border border-yellow-500 bg-yellow-900 text-yellow-300",
                error: "border border-red-500 bg-red-900 text-red-300",
                closed: "border border-gray-500 bg-gray-700 text-gray-300",
              }[status]
            )}
          >
            WebSocket: {status}
          </span>
        </div>

        {/* sound */}
        <label className="flex items-center mx-3 cursor-pointer">
          <span className="text-xs">音声通知:</span>
          <input
            type="checkbox"
            checked={soundPlay}
            onChange={(e) => toggleSound(e.target.checked)}
            className="mx-2 w-4 h-4"
          />
        </label>

        {/* 通知震度設定 */}
        <div className="flex items-center mx-3">
          <span className="text-xs mr-2">通知震度:</span>
          <select
            value={notificationThreshold}
            onChange={(e) => setNotificationThreshold(Number(e.target.value))}
            className="text-xs px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded"
          >
            <option value={0}>震度0以上</option>
            <option value={1}>震度1以上</option>
            <option value={2}>震度2以上</option>
            <option value={3}>震度3以上</option>
            <option value={4}>震度4以上</option>
            <option value={5.0}>震度5弱以上</option>
            <option value={5.5}>震度5強以上</option>
            <option value={6.0}>震度6弱以上</option>
            <option value={6.5}>震度6強以上</option>
            <option value={7}>震度7のみ</option>
          </select>
        </div>

        {/* テストモード */}
        <div className="flex items-center mx-3">
          <button
            className={cn(
              "mx-1 px-3 py-1 border rounded transition-colors text-xs font-medium",
              testMode 
                ? "border-yellow-500 bg-yellow-900 text-yellow-300" 
                : "border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300"
            )}
            onClick={toggleTestMode}
          >
            テストモード {testMode ? "ON" : "OFF"}
          </button>
          {testMode && (
            <button
              className="mx-1 px-3 py-1 border border-blue-500 rounded bg-blue-900 hover:bg-blue-800 text-blue-300 transition-colors text-xs"
              onClick={runTestSimulation}
            >
              地震シミュレーション実行
            </button>
          )}
        </div>

        {/* データベース管理 */}
        <div className="flex items-center mx-3">
          <span className="text-xs mr-2">DB:</span>
          <button
            className="mx-1 px-2 py-1 border border-blue-500 rounded bg-blue-900 hover:bg-blue-800 text-blue-300 transition-colors text-xs"
            onClick={cleanupDatabase}
          >
            古いデータ削除
          </button>
          <button
            className="mx-1 px-2 py-1 border border-red-500 rounded bg-red-900 hover:bg-red-800 text-red-300 transition-colors text-xs"
            onClick={clearDatabase}
          >
            全削除
          </button>
        </div>

        <div className="flex-grow" />

        {/* package 情報 */}
        <div className="flex items-center mx-3 text-xs text-gray-400">
          <a href="https://github.com/pdmdss/app-etcm" target="_blank" className="flex items-center hover:text-gray-300">
            <img
              src="/assets/github.png"
              alt="github"
              className="h-5 w-5 mr-2 rounded bg-white p-0.5"
            />
            <span>anpikakunin v0.1.0</span>
          </a>
        </div>
      </div>

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
              console.log("New earthquake event:", newEvent);
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

