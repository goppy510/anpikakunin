// WebSocket関連の型定義

export interface WebSocketMessage {
  type?: string;
  pingId?: string;
  close?: boolean;
  error?: string;
  classification?: string;
  format?: string;
  encoding?: string;
  compression?: string;
  body?: string;
  passing?: Array<{
    name?: string;
    time?: string;
    test?: boolean;
  }>;
  head?: {
    title?: string;
    time?: string;
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
      serial?: string;
      headline?: string;
      time?: string;
    };
    body?: {
      earthquake?: {
        originTime?: string;
        arrivalTime?: string;
        condition?: string;
        hypocenter?: {
          name?: string;
          code?: string;
          coordinate?: {
            latitude?: {
              text?: string;
              value?: string;
            };
            longitude?: {
              text?: string;
              value?: string;
            };
            height?: {
              type?: string;
              unit?: string;
              value?: string;
            };
          };
        };
        magnitude?: {
          type?: string;
          unit?: string;
          value?: string;
          condition?: string;
        };
      };
      intensity?: {
        observation?: {
          maxInt?: string;
          prefectures?: {
            pref?: Array<{
              name?: string;
              code?: string;
              maxInt?: string;
              areas?: {
                area?: Array<{
                  name?: string;
                  code?: string;
                  maxInt?: string;
                  cities?: {
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
                  };
                }>;
              };
            }>;
          };
        };
      };
    };
  };
}

// メッセージタイプとその日本語表記のマッピング
export const MESSAGE_TYPE_MAP: Record<string, string> = {
  // 基本的な制御メッセージ
  'ping': 'ping',
  'pong': 'pong',
  'start': '接続開始',
  'error': 'エラー',
  
  // 地震関連の分類
  'earthquake': '地震データ',
  'telegram.earthquake': '地震電文',
  'eew.forecast': '緊急地震速報（予報）',
  'eew.warning': '緊急地震速報（警報）',
  
  // その他のデフォルト
  'unknown': '不明',
  'data': 'データ受信',
  'message': 'メッセージ'
};

// メッセージタイプを判別する関数
export function getMessageType(message: WebSocketMessage): string {
  // 基本的なtypeフィールドをチェック
  if (message.type && MESSAGE_TYPE_MAP[message.type]) {
    return MESSAGE_TYPE_MAP[message.type];
  }
  
  // classificationフィールドをチェック
  if (message.classification) {
    // 完全一致をチェック
    if (MESSAGE_TYPE_MAP[message.classification]) {
      return MESSAGE_TYPE_MAP[message.classification];
    }
    
    // 部分一致をチェック（地震関連）
    if (message.classification.includes('earthquake')) {
      return MESSAGE_TYPE_MAP['earthquake'];
    }
    
    // その他のデータ
    return MESSAGE_TYPE_MAP['data'];
  }
  
  return MESSAGE_TYPE_MAP['unknown'];
}