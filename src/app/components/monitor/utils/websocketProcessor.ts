// WebSocketメッセージ処理ユーティリティ

import { EventItem } from "../types/EventItem";
import { ApiService } from "@/app/api/ApiService";
import { oauth2 } from "@/app/api/Oauth2Service";
import * as pako from "pako";
import { WebSocketMessage, getMessageType } from "../types/WebSocketTypes";
import { TsunamiWarning } from "../types/TsunamiTypes";
import { processTsunamiMessage } from "./tsunamiProcessor";

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
    "7": "7",
  };

  return intensityMap[intensity] || intensity;
};

// WebSocketメッセージのbodyをデコードする関数
const decodeMessageBody = (message: any): any => {
  try {

    if (!message.body) {
      return null;
    }

    let decodedBody = message.body;

    // base64デコード
    if (message.encoding === "base64") {
      const binaryString = atob(decodedBody);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // gzip展開
      if (message.compression === "gzip") {
        const decompressed = pako.inflate(uint8Array, { to: "string" });
        decodedBody = decompressed;
      } else {
        decodedBody = new TextDecoder().decode(uint8Array);
      }
    }

    // JSON解析
    if (message.format === "json") {
      const parsed = JSON.parse(decodedBody);
      return parsed;
    }

    return decodedBody;
  } catch (error) {
    return null;
  }
};

// 最大震度を取得する関数
const getMaxIntensity = (message: WebSocketMessage): string => {
  try {

    // まずデコードされたbodyから震度を取得を試行
    const decodedBody = decodeMessageBody(message);

    // 新しいDMDATAフォーマットの場合
    if (decodedBody?.body?.intensity?.maxInt) {
      const maxInt = decodedBody.body.intensity.maxInt;
      return normalizeIntensity(maxInt);
    }

    // レガシーフォーマットの場合
    if (decodedBody?.Body?.Intensity?.Observation) {
      const observations = decodedBody.Body.Intensity.Observation;

      if (Array.isArray(observations) && observations.length > 0) {
        const maxInt = observations[0].MaxInt;
        if (maxInt) {
          return normalizeIntensity(maxInt);
        }
      }

      // 都道府県別の震度確認
      if (Array.isArray(observations)) {
        let maxIntensity = "0";
        observations.forEach((obs) => {
          if (obs.Pref && Array.isArray(obs.Pref)) {
            obs.Pref.forEach((pref) => {
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
          return maxIntensity;
        }
      }
    }

    // フォールバック: xmlReportから取得
    const observations = message.xmlReport?.body?.intensity?.observation;
    if (observations && observations.length > 0) {
      const maxInt = observations[0].maxInt;
      if (maxInt) {
        return normalizeIntensity(maxInt);
      }
    }

    // フォールバック: 都道府県別の最大震度を確認
    const prefectures =
      message.xmlReport?.body?.intensity?.observation?.[0]?.prefecture || [];
    let maxIntensity = "0";

    prefectures.forEach((pref) => {
      if (pref.maxInt) {
        const normalized = normalizeIntensity(pref.maxInt);
        if (compareIntensity(normalized, maxIntensity) > 0) {
          maxIntensity = normalized;
        }
      }
    });

    if (maxIntensity !== "0") {
    }

    return maxIntensity;
  } catch (error) {
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
    "7": 7.0,
  };

  return (intensityValues[a] || 0) - (intensityValues[b] || 0);
};

// WebSocketメッセージを EventItem に変換する関数
export const processWebSocketMessage = (
  message: WebSocketMessage
): EventItem | null => {
  try {

    // エラーメッセージの場合
    if (message.type === "error") {
      return null;
    }

    // ping/pongメッセージなどの制御メッセージをスキップ
    if (
      message.type === "ping" ||
      message.type === "pong" ||
      message.type === "start"
    ) {
      return null;
    }

    // classification が存在しない場合はスキップ
    if (!message.classification) {
      return null;
    }

    // 地震情報以外はスキップ
    if (
      !message.classification.includes("earthquake") &&
      !message.classification.includes("telegram.earthquake")
    ) {
      return null;
    }


    // 情報種別を確認
    const infoKind = message.xmlReport?.head?.infoKind;

    // 情報種別による処理分岐
    const isHypocenterInfo = infoKind === "震源速報";
    const isIntensityInfo =
      infoKind === "震度速報" ||
      infoKind?.includes("震度") ||
      infoKind === "地震情報";

    // まずはxmlReportをチェック
    let xmlReport = message.xmlReport;
    let decodedData = null;

    // 常にbodyをデコードしてみる（詳細な地震データが含まれている可能性）
    decodedData = decodeMessageBody(message);

    // 確定状態の判定（複数の条件をチェック）- decodedData初期化後に実行
    const infoType = message.xmlReport?.head?.infoType || decodedData?.infoType;
    const serial = message.xmlReport?.head?.serial || decodedData?.serialNo;
    const headline = message.xmlReport?.head?.headline || decodedData?.headline;


    // 確定状態の詳細判定
    const isFinalReport =
      headline?.includes("最終") ||
      headline?.includes("確定") ||
      infoType === "最終発表" ||
      infoType === "確定";
    const hasSerialNumber = serial && serial !== "1"; // 1より大きい連番は続報


    if (decodedData) {

      // デコードされたデータをxmlReportにマージまたは置換
      if (decodedData.Body && decodedData.Head) {
        xmlReport = {
          head: xmlReport?.head || decodedData.Head,
          body: decodedData.Body,
          control: xmlReport?.control,
        };
      } else if (decodedData.xmlReport) {
        xmlReport = decodedData.xmlReport;
      } else {
          "Decoded data contents:",
          JSON.stringify(decodedData, null, 2)
        );
      }
    }

    if (!xmlReport && !decodedData) {
      return null;
    }

      "Using xmlReport structure:",
      xmlReport ? Object.keys(xmlReport) : "null"
    );

    // デコードされたデータを優先的に使用
    const earthquake =
      decodedData?.body?.earthquake || xmlReport?.body?.earthquake?.[0];
    const head = xmlReport?.head;

      "- decodedData?.body?.earthquake:",
      decodedData?.body?.earthquake
    );
      "- xmlReport?.body?.earthquake?.[0]:",
      xmlReport?.body?.earthquake?.[0]
    );

    // イベントIDを取得 (優先順位: decodedData.eventId > head.eventId > message.id)
    const eventId =
      decodedData?.eventId ||
      head?.eventId ||
      message.id ||
      `event-${Date.now()}`;

    // 震源情報を取得（デコードデータを優先）
    const hypocenter = earthquake?.hypocenter;
    const hypoName = hypocenter?.name || hypocenter?.area?.name || "震源不明";
    const hypoDepth = hypocenter?.depth?.value
      ? parseInt(hypocenter.depth.value)
      : undefined;

    // マグニチュード情報を取得（デコードデータを優先）
    const magnitudeValue = earthquake?.magnitude?.value
      ? parseFloat(earthquake.magnitude.value)
      : undefined;

    // 時刻情報を取得（デコードデータを優先）
    const arrivalTime =
      earthquake?.arrivalTime ||
      decodedData?.reportDateTime ||
      message.head?.time ||
      new Date().toISOString();
    const originTime = earthquake?.originTime;

    // 最大震度を取得
    let maxInt = getMaxIntensity(message);

    // 震源速報の場合は震源調査中として扱う
    if (isHypocenterInfo && maxInt === "0") {
      maxInt = "-"; // 震源調査中
    }


    // テストかどうかを判定
    const isTest = message.head?.test || false;

    // 確定状態の判定：地震情報（震源・震度）なら確定
    let isConfirmed = false; // デフォルトは未確定

    const title = message.xmlReport?.control?.title || decodedData?.type;

    if (title?.includes("震源・震度") || infoKind === "地震情報") {
      // 「震源・震度に関する情報」または「地震情報」なら確定
      isConfirmed = true;
    } else if (isHypocenterInfo) {
      // 震源速報は未確定
      isConfirmed = false;
    } else if (infoKind?.includes("震度")) {
      // 震度速報は未確定（震源・震度の詳細情報を待つ）
      isConfirmed = false;
    } else if (hypoName !== "震源不明" && maxInt !== "0") {
      // 震源地と震度がある場合は確定
      isConfirmed = true;
    }

    const eventItem: EventItem = {
      eventId,
      arrivalTime,
      originTime,
      maxInt,
      currentMaxInt: isHypocenterInfo ? "-" : maxInt, // 震源速報は震源調査中
      magnitude: magnitudeValue ? { value: magnitudeValue } : undefined,
      hypocenter: {
        name: hypoName,
        depth: hypoDepth ? { value: hypoDepth } : undefined,
      },
      isTest,
      isConfirmed,
    };

    return eventItem;
  } catch (error) {
    return null;
  }
};

// WebSocket接続の状態を管理するクラス
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private onMessage: ((event: EventItem) => void) | null = null;
  private onStatusChange:
    | ((status: "open" | "connecting" | "closed" | "error") => void)
    | null = null;
  private onTimeUpdate:
    | ((serverTime: string, messageType: string) => void)
    | null = null;
  private onTsunamiWarning: ((warning: TsunamiWarning) => void) | null = null;
  private apiService: ApiService;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  constructor(
    onMessage: (event: EventItem) => void,
    onStatusChange: (
      status: "open" | "connecting" | "closed" | "error"
    ) => void,
    onTimeUpdate?: (serverTime: string, messageType: string) => void,
    onTsunamiWarning?: (warning: TsunamiWarning) => void
  ) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onTimeUpdate = onTimeUpdate || null;
    this.onTsunamiWarning = onTsunamiWarning || null;
    this.apiService = new ApiService();
  }

  async connect(): Promise<void> {
    try {
      this.shouldReconnect = true;
      this.onStatusChange?.("connecting");

      // OAuth2認証状態を詳しく確認
      const oauth2Service = oauth2();

      // デバッグ情報を表示
      await oauth2Service.debugTokenStatus();

      const hasToken = await oauth2Service.refreshTokenCheck();

      if (!hasToken) {
        this.onStatusChange?.("error");
        return;
      }

      // 認証ヘッダーも確認
      const auth = await oauth2Service.oauth2Instance?.getAuthorization();

      // 契約状態も確認
      try {
        const contracts = await this.apiService.contractList();

        // 利用可能な分類も確認
        try {
          const classifications = await this.apiService.telegramList({});

          // 地震関連の分類のみを抽出して表示
          const earthquakeClassifications = classifications.items?.filter(
            (item) =>
              item.id.includes("earthquake") ||
              item.id.includes("seismic") ||
              item.id.includes("eew")
          );
            "Earthquake-related classifications:",
            earthquakeClassifications
          );
        } catch (classError) {
            "Could not fetch telegram classifications (continuing anyway):",
            classError
          );
          // Continue with WebSocket connection even if classification fetch fails
        }
      } catch (contractError) {
        // 契約確認に失敗した場合でも続行を試みる
      }

      // WebSocket接続前に軽量なクリーンアップを実行

      try {
        // 軽量化: 3回試行のみ
        for (let attempt = 1; attempt <= 3; attempt++) {

          const socketList = await this.apiService.socketList();
          const connectionCount = socketList.items?.length || 0;

          if (connectionCount === 0) {
            break;
          }

          // 全接続を並列でクローズ（シンプル版）
          const closePromises = socketList.items!.map(async (socket) => {
            try {
              await this.apiService.socketClose(socket.id);
            } catch (error) {
            }
          });

          await Promise.all(closePromises);

          // 短い待機時間
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }


        // 短い待機時間でサーバー側の処理完了を待つ
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (cleanupError) {
          "🚨 Cleanup failed (continuing anyway):",
          cleanupError.message
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // WebSocket接続開始（詳細ログ付き）
        "telegram.earthquake",
        // "telegram.tsunami" // 403エラーのため無効化（権限なし）
      ]);

      const socketResponse = await this.apiService.socketStart(
        [
          "telegram.earthquake",
          // "telegram.tsunami" // 403エラーのため無効化（権限なし）
        ],
        "anpikakunin"
      );


      if (!socketResponse.websocket?.url) {
        throw new Error("No WebSocket URL in response");
      }


      this.ws = new WebSocket(socketResponse.websocket.url);

      this.ws.onopen = () => {
        this.onStatusChange?.("open");

        // 接続成功時は再接続タイマーをクリア
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }

        // 接続直後にテストメッセージを送信（必要に応じて）
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;

          // ping以外のメッセージの詳細ログ（デバッグ用）
          if (message.type !== "ping" && message.type !== "pong") {
            if (message.xmlReport?.head) {
            }
          }

          // サーバー時刻を抽出してコールバック実行
          this.extractAndUpdateServerTime(message);

          // pingメッセージにはpongで応答
          if (message.type === "ping") {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              const pongResponse = {
                type: "pong",
                pingId: message.pingId,
              };
              this.ws.send(JSON.stringify(pongResponse));
            }
            return;
          }

          // エラーメッセージで close=true の場合、接続を閉じる
          if (message.type === "error" && message.close) {
              "Server requested connection close due to error:",
              message.error
            );
            this.ws?.close();

            // 最大接続数エラーの場合、緊急クリーンアップを実行
            if (
              message.error?.includes(
                "maximum number of simultaneous connections"
              )
            ) {
                "Maximum connections error detected, performing emergency cleanup..."
              );
              this.handleMaxConnectionsError();
            }
            return;
          }

          // 津波情報の処理
          const tsunamiWarning = processTsunamiMessage(message);
          if (tsunamiWarning && this.onTsunamiWarning) {
              "Tsunami warning details:",
              JSON.stringify(tsunamiWarning, null, 2)
            );
            this.onTsunamiWarning(tsunamiWarning);
            return; // 津波情報の場合は地震イベント処理をスキップ
          }

          const eventItem = processWebSocketMessage(message);

          if (eventItem) {
              "Event item details:",
              JSON.stringify(eventItem, null, 2)
            );
            if (this.onMessage) {
              this.onMessage(eventItem);
            } else {
            }
          } else {
              "❌ No event item created - processWebSocketMessage returned null"
            );
          }
        } catch (error) {
        }
      };

      this.ws.onclose = (event) => {
        this.onStatusChange?.("closed");

        // 自動再接続
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.onStatusChange?.("error");
      };
    } catch (error) {

      // 詳細なエラー情報を表示
      if (error instanceof Error) {

        // Axiosエラーの場合、詳細情報を表示
        if ("response" in error && error.response) {
          const status = (error as any).response.status;
          const responseData = (error as any).response.data;

            "Full response data JSON:",
            JSON.stringify(responseData, null, 2)
          );

          // 409エラー（最大接続数）の場合、緊急クリーンアップを実行
          if (
            status === 409 &&
            responseData?.error?.message?.includes(
              "maximum number of simultaneous connections"
            )
          ) {
              "409 Maximum connections error detected during connection, performing emergency cleanup..."
            );
            this.handleMaxConnectionsError();
            return; // 通常の再接続処理をスキップ
          }

          // エラーオブジェクトの詳細を表示
          if (responseData?.error) {
              "Detailed error:",
              JSON.stringify(responseData.error, null, 2)
            );
          }

          // メッセージがある場合も表示
          if (responseData?.message) {
          }

        }

        if ("config" in error && error.config) {
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
      
      // 複数回試行でより確実にクリーンアップ
      for (let attempt = 1; attempt <= 5; attempt++) {
        
        const socketList = await this.apiService.socketList();
        const connectionCount = socketList.items?.length || 0;

        if (connectionCount === 0) {
          break;
        }

        if (socketList.items && socketList.items.length > 0) {
          
          // 順次処理で安全性を高める
          for (const socket of socketList.items) {
            try {
              await this.apiService.socketClose(socket.id);
              // 各クローズ後に短い待機
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
            }
          }
        }

        // 段階的に待機時間を増加
        if (attempt < 5) {
          const waitTime = attempt * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }


      // より長い待機時間で確実にサーバー側処理完了を待つ
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 再接続を試行
      this.connect();
      
    } catch (error) {
        "🚨 Emergency cleanup failed (socket management may require special permissions):",
        error.message
      );

      // socket.list/closeが使えない場合、より長い時間をおいて再接続を試行
      setTimeout(() => {
        this.connect();
      }, 30000); // 30秒後に再試行
    }
  }

  // EEW・リアルタイム震度データの処理
  private processEEWData(message: WebSocketMessage): EventItem | null {
    try {
      if (!message.head) {
        return null;
      }

      const eventId = message.head.designation || `eew-${Date.now()}`;
      const time = message.head.time || new Date().toISOString();

      // EEWデータから基本的なイベント情報を抽出
      const event: EventItem = {
        eventId: eventId,
        arrivalTime: time,
        originTime: time,
        maxInt: "-", // リアルタイムデータは震源調査中として扱う
        currentMaxInt: "1", // 初期値
        magnitude: undefined,
        hypocenter: { name: "震源 調査中" },
        isConfirmed: false,
        isTest: message.head.test || false,
      };

      return event;
    } catch (error) {
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
    }
  }
}
