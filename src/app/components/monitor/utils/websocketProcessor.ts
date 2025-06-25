// WebSocketメッセージ処理ユーティリティ

import { EventItem } from "../types/EventItem";
import { ApiService } from "@/app/api/ApiService";
import { oauth2 } from "@/app/api/Oauth2Service";

// DMDATA WebSocketメッセージの型定義
interface WebSocketMessage {
  id?: string;
  classification?: string;
  type?: string;
  error?: string;
  code?: number;
  close?: boolean;
  passing?: Array<{
    name: string;
    time: string;
  }>;
  head?: {
    type: string;
    author: string;
    time: string;
    designation?: string;
    test?: boolean;
  };
  xmlReport?: {
    control?: {
      title?: string;
      dateTime?: string;
      status?: string;
      editorialOffice?: string;
      publishingOffice?: string;
    };
    head?: {
      title?: string;
      reportDateTime?: string;
      targetDateTime?: string;
      eventId?: string;
      infoType?: string;
      infoKind?: string;
      infoKindVersion?: string;
      headline?: {
        text?: string;
        information?: Array<{
          type?: string;
          item?: Array<{
            kind?: {
              name?: string;
              code?: string;
            };
            areas?: {
              codeType?: string;
              area?: Array<{
                name?: string;
                code?: string;
                maxInt?: string;
                revise?: string;
              }>;
            };
          }>;
        }>;
      };
    };
    body?: {
      earthquake?: Array<{
        arrivalTime?: string;
        originTime?: string;
        hypocenter?: {
          area?: {
            name?: string;
            code?: string;
            coordinate?: Array<{
              value?: string;
              description?: string;
            }>;
          };
          depth?: {
            value?: string;
            condition?: string;
          };
        };
        magnitude?: {
          value?: string;
          condition?: string;
        };
      }>;
      intensity?: {
        observation?: Array<{
          maxInt?: string;
          prefecture?: Array<{
            name?: string;
            code?: string;
            maxInt?: string;
            area?: Array<{
              name?: string;
              code?: string;
              maxInt?: string;
              city?: Array<{
                name?: string;
                code?: string;
                maxInt?: string;
                intensityStation?: Array<{
                  name?: string;
                  code?: string;
                  int?: string;
                  revise?: string;
                }>;
              }>;
            }>;
          }>;
        }>;
      };
    };
  };
}

// 震度文字列を正規化する関数
const normalizeIntensity = (intensity: string): string => {
  if (!intensity) return "0";
  
  const intensityMap: { [key: string]: string } = {
    "1": "1",
    "2": "2", 
    "3": "3",
    "4": "4",
    "5-": "5弱",
    "5+": "5強",
    "6-": "6弱", 
    "6+": "6強",
    "7": "7"
  };
  
  return intensityMap[intensity] || intensity;
};

// 最大震度を取得する関数
const getMaxIntensity = (message: WebSocketMessage): string => {
  try {
    // 観測震度から最大震度を取得
    const observations = message.xmlReport?.body?.intensity?.observation;
    if (observations && observations.length > 0) {
      const maxInt = observations[0].maxInt;
      if (maxInt) {
        return normalizeIntensity(maxInt);
      }
    }
    
    // フォールバック: 都道府県別の最大震度を確認
    const prefectures = message.xmlReport?.body?.intensity?.observation?.[0]?.prefecture || [];
    let maxIntensity = "0";
    
    prefectures.forEach(pref => {
      if (pref.maxInt) {
        const normalized = normalizeIntensity(pref.maxInt);
        if (compareIntensity(normalized, maxIntensity) > 0) {
          maxIntensity = normalized;
        }
      }
    });
    
    return maxIntensity;
  } catch (error) {
    console.error("Error getting max intensity:", error);
    return "0";
  }
};

// 震度を比較する関数 (a > b なら正の値を返す)
const compareIntensity = (a: string, b: string): number => {
  const intensityValues: { [key: string]: number } = {
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5弱": 5.0,
    "5強": 5.5,
    "6弱": 6.0,
    "6強": 6.5,
    "7": 7.0
  };
  
  return (intensityValues[a] || 0) - (intensityValues[b] || 0);
};

// WebSocketメッセージを EventItem に変換する関数
export const processWebSocketMessage = (message: WebSocketMessage): EventItem | null => {
  try {
    console.log("Processing WebSocket message:", message);
    
    // エラーメッセージの場合
    if (message.type === 'error') {
      console.error("WebSocket error message:", {
        error: message.error,
        code: message.code,
        close: message.close
      });
      return null;
    }
    
    // ping/pongメッセージなどの制御メッセージをスキップ
    if (message.type === 'ping' || message.type === 'pong' || message.type === 'start') {
      console.log(`Control message (${message.type}), skipping`);
      return null;
    }
    
    // classification が存在しない場合はスキップ
    if (!message.classification) {
      console.log("No classification in message, skipping");
      return null;
    }
    
    // 地震情報以外はスキップ
    if (!message.classification.includes("earthquake") && !message.classification.includes("telegram.earthquake")) {
      console.log("Non-earthquake message, skipping");
      return null;
    }
    
    const xmlReport = message.xmlReport;
    if (!xmlReport) {
      console.log("No XML report in message, skipping");
      return null;
    }
    
    const earthquake = xmlReport.body?.earthquake?.[0];
    const head = xmlReport.head;
    
    // イベントIDを取得 (優先順位: head.eventId > message.id)
    const eventId = head?.eventId || message.id;
    
    // 震源情報を取得
    const hypocenter = earthquake?.hypocenter;
    const hypoName = hypocenter?.area?.name || "震源不明";
    const hypoDepth = hypocenter?.depth?.value ? 
      parseInt(hypocenter.depth.value) : undefined;
    
    // マグニチュード情報を取得
    const magnitudeValue = earthquake?.magnitude?.value ? 
      parseFloat(earthquake.magnitude.value) : undefined;
    
    // 時刻情報を取得
    const arrivalTime = earthquake?.arrivalTime || message.head.time;
    const originTime = earthquake?.originTime;
    
    // 最大震度を取得
    const maxInt = getMaxIntensity(message);
    
    // テストかどうかを判定
    const isTest = message.head.test || false;
    
    const eventItem: EventItem = {
      eventId,
      arrivalTime,
      originTime,
      maxInt,
      magnitude: magnitudeValue ? { value: magnitudeValue } : undefined,
      hypocenter: {
        name: hypoName,
        depth: hypoDepth ? { value: hypoDepth } : undefined,
      },
      isTest,
    };
    
    console.log("Processed earthquake event:", eventItem);
    return eventItem;
    
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
    return null;
  }
};

// WebSocket接続の状態を管理するクラス
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private onMessage: ((event: EventItem) => void) | null = null;
  private onStatusChange: ((status: "open" | "connecting" | "closed" | "error") => void) | null = null;
  private onTimeUpdate: ((serverTime: string) => void) | null = null;
  private apiService: ApiService;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  
  constructor(
    onMessage: (event: EventItem) => void,
    onStatusChange: (status: "open" | "connecting" | "closed" | "error") => void,
    onTimeUpdate?: (serverTime: string) => void
  ) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onTimeUpdate = onTimeUpdate || null;
    this.apiService = new ApiService();
  }
  
  async connect(): Promise<void> {
    try {
      this.shouldReconnect = true;
      this.onStatusChange?.("connecting");
      
      // OAuth2認証状態を詳しく確認
      const oauth2Service = oauth2();
      console.log("=== WebSocket Connection Debug ===");
      
      // デバッグ情報を表示
      await oauth2Service.debugTokenStatus();
      
      const hasToken = await oauth2Service.refreshTokenCheck();
      console.log("Token check result:", hasToken);
      
      if (!hasToken) {
        console.log("No valid OAuth token, connection failed");
        this.onStatusChange?.("error");
        return;
      }
      
      // 認証ヘッダーも確認
      const auth = await oauth2Service.oauth2Instance?.getAuthorization();
      console.log("Authorization header:", auth ? "***TOKEN***" : "null");
      
      // 契約状態も確認
      try {
        const contracts = await this.apiService.contractList();
        console.log("Contract list:", contracts);
      } catch (contractError) {
        console.error("Failed to get contracts:", contractError);
        // 契約確認に失敗した場合でも続行を試みる
      }
      
      // 注意: socket.list/socket.closeはDPoP必須の可能性があるため、現在はスキップ
      console.log("=== WebSocket Connection ===");
      console.log("Skipping socket cleanup (DPoP disabled), proceeding with direct connection");
      
      // WebSocket接続開始（詳細ログ付き）
      console.log("Attempting socket start with classifications:", [
        "telegram.earthquake"
      ]);
      
      const socketResponse = await this.apiService.socketStart([
        "telegram.earthquake"
      ], "anpikakunin");
      
      console.log("Socket response:", socketResponse);
      
      if (!socketResponse.websocket?.url) {
        throw new Error("No WebSocket URL in response");
      }
      
      console.log("Connecting to WebSocket:", socketResponse.websocket.url);
      
      this.ws = new WebSocket(socketResponse.websocket.url);
      
      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.onStatusChange?.("open");
        
        // 接続成功時は再接続タイマーをクリア
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          // サーバー時刻を抽出してコールバック実行
          this.extractAndUpdateServerTime(message);
          
          // エラーメッセージで close=true の場合、接続を閉じる
          if (message.type === 'error' && message.close) {
            console.error("Server requested connection close due to error:", message.error);
            this.ws?.close();
            
            // 最大接続数エラーの場合、時間をおいて再接続
            if (message.error?.includes('maximum number of simultaneous connections')) {
              console.log("Max connections reached, will retry in 30 seconds...");
              setTimeout(() => {
                console.log("Retrying connection after timeout...");
                this.connect();
              }, 30000); // 30秒後に再試行
            }
            return;
          }
          
          const eventItem = processWebSocketMessage(message);
          
          if (eventItem && this.onMessage) {
            this.onMessage(eventItem);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        this.onStatusChange?.("closed");
        
        // 自動再接続
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.onStatusChange?.("error");
      };
      
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      
      // 詳細なエラー情報を表示
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        
        // Axiosエラーの場合、詳細情報を表示
        if ('response' in error && error.response) {
          console.error("HTTP Status:", (error as any).response.status);
          console.error("Response data:", (error as any).response.data);
          console.error("Full response data JSON:", JSON.stringify((error as any).response.data, null, 2));
          
          // エラーオブジェクトの詳細を表示
          if ((error as any).response.data?.error) {
            console.error("Detailed error:", JSON.stringify((error as any).response.data.error, null, 2));
          }
          
          // メッセージがある場合も表示
          if ((error as any).response.data?.message) {
            console.error("Error message:", (error as any).response.data.message);
          }
          
          console.error("Response headers:", (error as any).response.headers);
        }
        
        if ('config' in error && error.config) {
          console.error("Request config:", {
            url: (error as any).config.url,
            method: (error as any).config.method,
            headers: (error as any).config.headers,
          });
        }
      }
      
      this.onStatusChange?.("error");
      
      // エラー時も再接続を試行
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log("Attempting to reconnect WebSocket...");
      this.connect();
    }, 5000); // 5秒後に再接続
  }
  
  disconnect(): void {
    this.shouldReconnect = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 1000);
  }
  
  private async handleMaxConnectionsError(): Promise<void> {
    try {
      console.log("=== Emergency Connection Cleanup ===");
      const socketList = await this.apiService.socketList();
      console.log("Found connections during emergency cleanup:", socketList.items?.length || 0);
      
      if (socketList.items && socketList.items.length > 0) {
        console.log("Emergency cleanup: Closing all connections...");
        const closePromises = socketList.items.map(async (socket) => {
          if (socket.status === 'open' || socket.status === 'waiting') {
            console.log(`Emergency cleanup: Closing socket ${socket.id}`);
            try {
              await this.apiService.socketClose(socket.id);
              console.log(`✅ Emergency cleanup: Closed socket ${socket.id}`);
            } catch (error) {
              console.error(`❌ Emergency cleanup: Failed to close socket ${socket.id}:`, error);
            }
          }
        });
        
        await Promise.all(closePromises);
        console.log("Emergency cleanup: All close operations completed");
        
        // 少し待ってから再接続を試行
        setTimeout(() => {
          console.log("Emergency cleanup: Attempting reconnection...");
          this.connect();
        }, 3000);
      }
    } catch (error) {
      console.warn("Emergency cleanup failed (socket management may require special permissions):", error.message);
      
      // socket.list/closeが使えない場合、時間をおいて再接続を試行
      console.log("Falling back to timed reconnection strategy...");
      setTimeout(() => {
        console.log("Timed reconnection attempt...");
        this.connect();
      }, 10000); // 10秒後に再試行
    }
  }

  // EEW・リアルタイム震度データの処理
  private processEEWData(message: WebSocketMessage): EventItem | null {
    try {
      if (!message.head) {
        console.log("No head in EEW message");
        return null;
      }

      const eventId = message.head.designation || `eew-${Date.now()}`;
      const time = message.head.time || new Date().toISOString();

      // EEWデータから基本的なイベント情報を抽出
      const event: EventItem = {
        eventId: eventId,
        arrivalTime: time,
        originTime: time,
        maxInt: "-", // リアルタイムデータは確認中として扱う
        currentMaxInt: "1", // 初期値
        magnitude: undefined,
        hypocenter: { name: "確認中" },
        isConfirmed: false,
        isTest: message.head.test || false
      };

      console.log("Created EEW event:", event);
      return event;

    } catch (error) {
      console.error("Error processing EEW data:", error);
      return null;
    }
  }

  // WebSocketメッセージからサーバー時刻を抽出
  private extractAndUpdateServerTime(message: WebSocketMessage): void {
    try {
      let serverTime: string | null = null;

      // 優先順位でサーバー時刻を抽出
      if (message.head?.time) {
        serverTime = message.head.time;
      } else if (message.xmlReport?.head?.time) {
        serverTime = message.xmlReport.head.time;
      } else if (message.passing && message.passing.length > 0) {
        // 通過時刻から最新のタイムスタンプを取得
        const latestPassing = message.passing.sort((a, b) => 
          new Date(b.time).getTime() - new Date(a.time).getTime()
        )[0];
        serverTime = latestPassing.time;
      }

      // 有効な時刻の場合、コールバックを実行
      if (serverTime && this.onTimeUpdate) {
        const parsedTime = new Date(serverTime);
        if (!isNaN(parsedTime.getTime())) {
          this.onTimeUpdate(serverTime);
        }
      }
    } catch (error) {
      // 時刻抽出エラーは静かに処理（メイン機能に影響させない）
      console.debug("Server time extraction failed:", error);
    }
  }
}