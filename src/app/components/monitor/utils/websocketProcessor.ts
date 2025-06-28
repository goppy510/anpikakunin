// WebSocketメッセージ処理ユーティリティ

import { EventItem } from "../types/EventItem";
import { ApiService } from "@/app/api/ApiService";
import { oauth2 } from "@/app/api/Oauth2Service";
import * as pako from "pako";
import { WebSocketMessage, getMessageType } from "../types/WebSocketTypes";


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

// WebSocketメッセージのbodyをデコードする関数
const decodeMessageBody = (message: any): any => {
  try {
    console.log("=== Decoding Message Body ===");
    console.log("Message encoding:", message.encoding);
    console.log("Message compression:", message.compression);
    console.log("Message format:", message.format);
    console.log("Message body exists:", !!message.body);
    console.log("Message body type:", typeof message.body);
    
    if (!message.body) {
      console.log("No message body to decode");
      return null;
    }
    
    let decodedBody = message.body;
    
    // base64デコード
    if (message.encoding === "base64") {
      console.log("Decoding base64 data...");
      const binaryString = atob(decodedBody);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      
      // gzip展開
      if (message.compression === "gzip") {
        console.log("Decompressing gzip data...");
        const decompressed = pako.inflate(uint8Array, { to: 'string' });
        decodedBody = decompressed;
        console.log("Gzip decompression successful, length:", decompressed.length);
      } else {
        decodedBody = new TextDecoder().decode(uint8Array);
        console.log("Base64 decode successful, length:", decodedBody.length);
      }
    }
    
    // JSON解析
    if (message.format === "json") {
      console.log("Parsing JSON data...");
      const parsed = JSON.parse(decodedBody);
      console.log("JSON parsing successful");
      return parsed;
    }
    
    console.log("Returning raw decoded body");
    return decodedBody;
  } catch (error) {
    console.error("Failed to decode message body:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    return null;
  }
};

// 最大震度を取得する関数
const getMaxIntensity = (message: WebSocketMessage): string => {
  try {
    console.log("=== getMaxIntensity: Starting ===");
    
    // まずデコードされたbodyから震度を取得を試行
    const decodedBody = decodeMessageBody(message);
    console.log("Decoded body for intensity extraction:", decodedBody);
    
    // 新しいDMDATAフォーマットの場合
    if (decodedBody?.body?.intensity?.maxInt) {
      const maxInt = decodedBody.body.intensity.maxInt;
      console.log("Found maxInt in decoded body.body.intensity:", maxInt);
      return normalizeIntensity(maxInt);
    }
    
    // レガシーフォーマットの場合
    if (decodedBody?.Body?.Intensity?.Observation) {
      const observations = decodedBody.Body.Intensity.Observation;
      console.log("Found observations in decoded body:", observations);
      
      if (Array.isArray(observations) && observations.length > 0) {
        const maxInt = observations[0].MaxInt;
        if (maxInt) {
          console.log("Max intensity from decoded body:", maxInt);
          return normalizeIntensity(maxInt);
        }
      }
      
      // 都道府県別の震度確認
      if (Array.isArray(observations)) {
        let maxIntensity = "0";
        observations.forEach(obs => {
          if (obs.Pref && Array.isArray(obs.Pref)) {
            obs.Pref.forEach(pref => {
              if (pref.MaxInt) {
                const normalized = normalizeIntensity(pref.MaxInt);
                if (compareIntensity(normalized, maxIntensity) > 0) {
                  maxIntensity = normalized;
                }
              }
            });
          }
        });
        if (maxIntensity !== "0") {
          console.log("Max intensity from prefecture data:", maxIntensity);
          return maxIntensity;
        }
      }
    }
    
    // フォールバック: xmlReportから取得
    const observations = message.xmlReport?.body?.intensity?.observation;
    if (observations && observations.length > 0) {
      const maxInt = observations[0].maxInt;
      if (maxInt) {
        console.log("Max intensity from xmlReport:", maxInt);
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
    
    if (maxIntensity !== "0") {
      console.log("Max intensity from xmlReport prefectures:", maxIntensity);
    }
    
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
    console.log("=== Processing WebSocket Message ===");
    console.log("Message type:", message.type);
    console.log("Message classification:", message.classification);
    console.log("Full message keys:", Object.keys(message));
    
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
    
    console.log("=== Earthquake Message Detected ===");
    console.log("Checking for xmlReport...");
    
    // 情報種別を確認
    const infoKind = message.xmlReport?.head?.infoKind;
    console.log("Info kind:", infoKind);
    
    // 情報種別による処理分岐
    const isHypocenterInfo = infoKind === "震源速報";
    const isIntensityInfo = infoKind === "震度速報" || infoKind?.includes("震度") || infoKind === "地震情報";
    
    // まずはxmlReportをチェック
    let xmlReport = message.xmlReport;
    let decodedData = null;
    
    // 常にbodyをデコードしてみる（詳細な地震データが含まれている可能性）
    console.log("Attempting to decode message body...");
    decodedData = decodeMessageBody(message);
    
    // 確定状態の判定（複数の条件をチェック）- decodedData初期化後に実行
    const infoType = message.xmlReport?.head?.infoType || decodedData?.infoType;
    const serial = message.xmlReport?.head?.serial || decodedData?.serialNo;
    const headline = message.xmlReport?.head?.headline || decodedData?.headline;
    
    console.log("Info kind:", infoKind);
    console.log("Info type:", infoType);
    console.log("Serial number:", serial);
    console.log("Headline:", headline);
    console.log("Is hypocenter info (震源速報):", isHypocenterInfo);
    console.log("Is intensity info (震度速報/地震情報):", isIntensityInfo);
    
    // 確定状態の詳細判定
    const isFinalReport = headline?.includes("最終") || headline?.includes("確定") || 
                         infoType === "最終発表" || infoType === "確定";
    const hasSerialNumber = serial && serial !== "1"; // 1より大きい連番は続報
    
    console.log("Is final report (headline/infoType):", isFinalReport);
    console.log("Has serial number > 1:", hasSerialNumber);
    
    if (decodedData) {
      console.log("Decoded data structure:", Object.keys(decodedData));
      
      // デコードされたデータをxmlReportにマージまたは置換
      if (decodedData.Body && decodedData.Head) {
        console.log("Found complete earthquake data in decoded body");
        xmlReport = {
          head: xmlReport?.head || decodedData.Head,
          body: decodedData.Body,
          control: xmlReport?.control
        };
      } else if (decodedData.xmlReport) {
        xmlReport = decodedData.xmlReport;
        console.log("Found xmlReport in decoded data");
      } else {
        console.log("Decoded data contents:", JSON.stringify(decodedData, null, 2));
      }
    }
    
    if (!xmlReport && !decodedData) {
      console.log("No XML report or decodable data in message, skipping");
      return null;
    }
    
    console.log("Using xmlReport structure:", xmlReport ? Object.keys(xmlReport) : 'null');
    
    // デコードされたデータを優先的に使用
    const earthquake = decodedData?.body?.earthquake || xmlReport?.body?.earthquake?.[0];
    const head = xmlReport?.head;
    
    console.log("Earthquake data source check:");
    console.log("- decodedData?.body?.earthquake:", decodedData?.body?.earthquake);
    console.log("- xmlReport?.body?.earthquake?.[0]:", xmlReport?.body?.earthquake?.[0]);
    console.log("- Final earthquake:", earthquake);
    
    // イベントIDを取得 (優先順位: decodedData.eventId > head.eventId > message.id)
    const eventId = decodedData?.eventId || head?.eventId || message.id || `event-${Date.now()}`;
    console.log("Event ID:", eventId);
    
    // 震源情報を取得（デコードデータを優先）
    const hypocenter = earthquake?.hypocenter;
    console.log("Hypocenter object:", hypocenter);
    const hypoName = hypocenter?.name || hypocenter?.area?.name || "震源不明";
    const hypoDepth = hypocenter?.depth?.value ? 
      parseInt(hypocenter.depth.value) : undefined;
    console.log("Extracted hypocenter name:", hypoName, "Depth:", hypoDepth);
    
    // マグニチュード情報を取得（デコードデータを優先）
    const magnitudeValue = earthquake?.magnitude?.value ? 
      parseFloat(earthquake.magnitude.value) : undefined;
    console.log("Magnitude:", magnitudeValue);
    
    // 時刻情報を取得（デコードデータを優先）
    const arrivalTime = earthquake?.arrivalTime || decodedData?.reportDateTime || message.head?.time || new Date().toISOString();
    const originTime = earthquake?.originTime;
    console.log("Arrival time:", arrivalTime, "Origin time:", originTime);
    
    // 最大震度を取得
    console.log("=== Getting Max Intensity ===");
    let maxInt = getMaxIntensity(message);
    console.log("Extracted max intensity:", maxInt);
    
    // 震源速報の場合は確認中として扱う
    if (isHypocenterInfo && maxInt === "0") {
      maxInt = "-"; // 確認中
      console.log("震源速報のため震度を確認中（-）に設定");
    }
    
    console.log("Final max intensity:", maxInt);
    
    // テストかどうかを判定
    const isTest = message.head?.test || false;
    console.log("Is test:", isTest);
    
    // 確定状態の判定：地震情報（震源・震度）なら確定
    let isConfirmed = false; // デフォルトは未確定
    
    const title = message.xmlReport?.control?.title || decodedData?.type;
    console.log("Report title:", title);
    
    if (title?.includes("震源・震度") || infoKind === "地震情報") {
      // 「震源・震度に関する情報」または「地震情報」なら確定
      console.log("✅ Confirmed: Final earthquake report (震源・震度情報)");
      isConfirmed = true;
    } else if (isHypocenterInfo) {
      // 震源速報は未確定
      console.log("⚠️ Unconfirmed: Hypocenter information only");
      isConfirmed = false;
    } else if (infoKind?.includes("震度")) {
      // 震度速報は未確定（震源・震度の詳細情報を待つ）
      console.log("⚠️ Unconfirmed: Intensity information only");
      isConfirmed = false;
    } else if (hypoName !== "震源不明" && maxInt !== "0") {
      // 震源地と震度がある場合は確定
      console.log("✅ Confirmed: Has both hypocenter and intensity");
      isConfirmed = true;
    }
    
    const eventItem: EventItem = {
      eventId,
      arrivalTime,
      originTime,
      maxInt,
      currentMaxInt: isHypocenterInfo ? "-" : maxInt, // 震源速報は確認中
      magnitude: magnitudeValue ? { value: magnitudeValue } : undefined,
      hypocenter: {
        name: hypoName,
        depth: hypoDepth ? { value: hypoDepth } : undefined,
      },
      isTest,
      isConfirmed,
    };
    
    console.log("=== Final Processed Event Item ===");
    console.log("Event item:", JSON.stringify(eventItem, null, 2));
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
  private onTimeUpdate: ((serverTime: string, messageType: string) => void) | null = null;
  private apiService: ApiService;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  
  constructor(
    onMessage: (event: EventItem) => void,
    onStatusChange: (status: "open" | "connecting" | "closed" | "error") => void,
    onTimeUpdate?: (serverTime: string, messageType: string) => void
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
        
        // 利用可能な分類も確認
        try {
          const classifications = await this.apiService.telegramList({});
          console.log("Available telegram classifications:", classifications);
          
          // 地震関連の分類のみを抽出して表示
          const earthquakeClassifications = classifications.items?.filter(item => 
            item.id.includes('earthquake') || item.id.includes('seismic') || item.id.includes('eew')
          );
          console.log("Earthquake-related classifications:", earthquakeClassifications);
        } catch (classError) {
          console.warn("Could not fetch telegram classifications (continuing anyway):", classError);
          // Continue with WebSocket connection even if classification fetch fails
        }
      } catch (contractError) {
        console.error("Failed to get contracts:", contractError);
        // 契約確認に失敗した場合でも続行を試みる
      }
      
      // WebSocket接続前に強力なクリーンアップを実行
      console.log("=== WebSocket Connection ===");
      console.log("Performing AGGRESSIVE connection cleanup before new connection...");
      
      try {
        // 複数回の試行で確実にクリーンアップ
        for (let attempt = 1; attempt <= 2; attempt++) {
          console.log(`Pre-connection cleanup attempt ${attempt}/2`);
          
          const socketList = await this.apiService.socketList();
          console.log(`Found ${socketList.items?.length || 0} existing connections`);
          
          if (!socketList.items || socketList.items.length === 0) {
            console.log("No connections to clean up");
            break;
          }
          
          console.log("Aggressively cleaning up ALL existing connections...");
          const closePromises = socketList.items.map(async (socket) => {
            console.log(`Force closing socket ${socket.id} (status: ${socket.status})`);
            try {
              await this.apiService.socketClose(socket.id);
              console.log(`✅ Force closed socket ${socket.id}`);
            } catch (error) {
              console.error(`❌ Failed to force close socket ${socket.id}:`, error);
            }
          });
          
          await Promise.all(closePromises);
          
          // 次の試行前に待機
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log("Aggressive pre-connection cleanup completed");
        
        // より長い待機時間でサーバー側の処理完了を待つ
        await new Promise(resolve => setTimeout(resolve, 2500));
        
      } catch (cleanupError) {
        console.warn("Aggressive pre-connection cleanup failed (continuing anyway):", cleanupError.message);
        // 失敗時はさらに長く待つ
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // WebSocket接続開始（詳細ログ付き）
      console.log("Attempting socket start with classifications:", [
        "telegram.earthquake"
      ]);
      
      const socketResponse = await this.apiService.socketStart([
        "telegram.earthquake"
      ], "anpikakunin");
      
      console.log("Socket response:", socketResponse);
      console.log("Socket URL:", socketResponse.websocket?.url);
      console.log("Socket classifications:", socketResponse.classifications);
      console.log("Socket expiration:", socketResponse.websocket?.expiration);
      
      if (!socketResponse.websocket?.url) {
        throw new Error("No WebSocket URL in response");
      }
      
      console.log("Connecting to WebSocket:", socketResponse.websocket.url);
      
      this.ws = new WebSocket(socketResponse.websocket.url);
      
      this.ws.onopen = () => {
        console.log("WebSocket connected successfully");
        console.log("WebSocket readyState:", this.ws?.readyState);
        console.log("WebSocket URL:", this.ws?.url);
        this.onStatusChange?.("open");
        
        // 接続成功時は再接続タイマーをクリア
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        
        // 接続直後にテストメッセージを送信（必要に応じて）
        console.log("WebSocket is ready to receive messages");
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          // 受信メッセージの詳細ログ（デバッグ用）
          console.log("=== WebSocket Message Received ===");
          console.log("Message type:", message.type);
          console.log("Classification:", message.classification);
          console.log("Head:", message.head);
          if (message.xmlReport?.head) {
            console.log("XML Report head:", message.xmlReport.head);
          }
          console.log("Full message:", JSON.stringify(message, null, 2));
          
          // サーバー時刻を抽出してコールバック実行
          this.extractAndUpdateServerTime(message);
          
          // pingメッセージにはpongで応答
          if (message.type === 'ping') {
            console.log(`Received ping (${message.pingId}), sending pong response`);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              const pongResponse = {
                type: 'pong',
                pingId: message.pingId
              };
              this.ws.send(JSON.stringify(pongResponse));
              console.log(`Sent pong response:`, pongResponse);
            }
            return;
          }
          
          // エラーメッセージで close=true の場合、接続を閉じる
          if (message.type === 'error' && message.close) {
            console.error("Server requested connection close due to error:", message.error);
            this.ws?.close();
            
            // 最大接続数エラーの場合、緊急クリーンアップを実行
            if (message.error?.includes('maximum number of simultaneous connections')) {
              console.log("Maximum connections error detected, performing emergency cleanup...");
              this.handleMaxConnectionsError();
            }
            return;
          }
          
          const eventItem = processWebSocketMessage(message);
          
          console.log("=== WebSocketManager: Event Processing Result ===");
          console.log("Event item created:", !!eventItem);
          if (eventItem) {
            console.log("Event item details:", JSON.stringify(eventItem, null, 2));
            console.log("Calling onMessage callback...");
            if (this.onMessage) {
              this.onMessage(eventItem);
              console.log("✅ onMessage callback called successfully");
            } else {
              console.error("❌ No onMessage callback registered!");
            }
          } else {
            console.log("❌ No event item created - processWebSocketMessage returned null");
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
          const status = (error as any).response.status;
          const responseData = (error as any).response.data;
          
          console.error("HTTP Status:", status);
          console.error("Response data:", responseData);
          console.error("Full response data JSON:", JSON.stringify(responseData, null, 2));
          
          // 409エラー（最大接続数）の場合、緊急クリーンアップを実行
          if (status === 409 && responseData?.error?.message?.includes('maximum number of simultaneous connections')) {
            console.log("409 Maximum connections error detected during connection, performing emergency cleanup...");
            this.handleMaxConnectionsError();
            return; // 通常の再接続処理をスキップ
          }
          
          // エラーオブジェクトの詳細を表示
          if (responseData?.error) {
            console.error("Detailed error:", JSON.stringify(responseData.error, null, 2));
          }
          
          // メッセージがある場合も表示
          if (responseData?.message) {
            console.error("Error message:", responseData.message);
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

      return event;

    } catch (error) {
      console.error("Error processing EEW data:", error);
      return null;
    }
  }

  // WebSocketメッセージ受信時の時刻を更新
  private extractAndUpdateServerTime(message: WebSocketMessage): void {
    try {
      // ping/pongメッセージや地震データなど、すべてのWebSocketメッセージ受信時に
      // 受信時のローカル時刻を「サーバー時刻」として扱う
      if (this.onTimeUpdate) {
        const receptionTime = new Date().toISOString();
        const messageType = getMessageType(message);
        this.onTimeUpdate(receptionTime, messageType);
      }

      // 従来の時刻抽出ロジックはコメントアウト（必要に応じて後で復活可能）
      /*
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
      */
    } catch (error) {
      // 時刻抽出エラーは静かに処理（メイン機能に影響させない）
      console.debug("Server time extraction failed:", error);
    }
  }
}