// 津波情報関連の型定義

export interface TsunamiWarning {
  id: string;
  eventId: string; // 地震イベントとの関連付け
  issueTime: string; // 発表時刻
  type: 'major_warning' | 'warning' | 'advisory' | 'forecast'; // 大津波警報 | 津波警報 | 津波注意報 | 津波予報
  areas: TsunamiArea[]; // 対象地域
  isCancel?: boolean; // 解除情報
  expectedArrival?: string; // 津波到達予想時刻
  maxHeight?: TsunamiHeight; // 予想津波高
}

export interface TsunamiArea {
  code: string; // 地域コード
  name: string; // 地域名（例：北海道太平洋沿岸東部）
  prefecture: string; // 都道府県名
  warning_type: 'major_warning' | 'warning' | 'advisory' | 'forecast';
  coordinates?: [number, number][]; // 沿岸部の座標配列
  expectedArrival?: string; // この地域の到達予想時刻
  maxHeight?: TsunamiHeight; // この地域の予想津波高
}

export interface TsunamiHeight {
  value?: number; // 数値（メートル）
  category: 'giant' | 'high' | 'medium' | 'low' | 'slight'; // 巨大 | 高い | 中程度 | 低い | わずか
  text: string; // 表示用テキスト（例：「巨大」「3m」「1m」）
}

// 津波警報レベルの色定義
export const TSUNAMI_COLORS = {
  major_warning: '#8b00ff', // 大津波警報：紫
  warning: '#ff6600',       // 津波警報：オレンジ
  advisory: '#ffcc00',      // 津波注意報：黄色
  forecast: '#00ccff',      // 津波予報：水色
  none: 'transparent'       // 警報なし：透明
} as const;

// 沿岸部境界線用の色定義（明るく目立つ色）
export const TSUNAMI_BORDER_COLORS = {
  major_warning: '#aa00ff', // 大津波警報：明るい紫
  warning: '#ff6600',       // 津波警報：明るいオレンジ
  advisory: '#ffcc00',      // 津波注意報：明るい黄色
  forecast: '#00ccff',      // 津波予報：明るい水色
  none: '#ffffff'           // 警報なし：白
} as const;

// 津波地域マスタデータ（主要沿岸部）
export const TSUNAMI_COASTAL_AREAS = {
  // 北海道
  '101': {
    name: '北海道太平洋沿岸東部',
    prefecture: '北海道',
    coordinates: [
      [45.5, 145.0], [44.0, 145.5], [43.0, 145.0], [42.5, 144.0]
    ]
  },
  '102': {
    name: '北海道太平洋沿岸中部',
    prefecture: '北海道', 
    coordinates: [
      [42.5, 144.0], [42.0, 143.0], [41.5, 142.0], [41.0, 141.5]
    ]
  },
  '103': {
    name: '北海道太平洋沿岸西部',
    prefecture: '北海道',
    coordinates: [
      [41.0, 141.5], [41.5, 140.5], [42.0, 140.0], [42.5, 139.8]
    ]
  },
  '104': {
    name: '北海道日本海沿岸北部',
    prefecture: '北海道',
    coordinates: [
      [45.5, 141.0], [44.0, 140.5], [43.0, 140.0], [42.5, 139.8]
    ]
  },
  '105': {
    name: '北海道日本海沿岸南部',
    prefecture: '北海道',
    coordinates: [
      [42.5, 139.8], [42.0, 139.5], [41.5, 139.8], [41.0, 140.0]
    ]
  },
  '106': {
    name: 'オホーツク海沿岸',
    prefecture: '北海道',
    coordinates: [
      [45.5, 145.0], [45.0, 143.0], [44.5, 142.0], [44.0, 141.5]
    ]
  },
  
  // 東北太平洋沿岸
  '201': {
    name: '青森県太平洋沿岸',
    prefecture: '青森県',
    coordinates: [
      [41.0, 141.5], [40.5, 141.8], [40.0, 141.5], [40.2, 141.0]
    ]
  },
  '202': {
    name: '岩手県',
    prefecture: '岩手県', 
    coordinates: [
      [40.2, 141.0], [39.8, 142.0], [39.0, 142.0], [38.8, 141.8]
    ]
  },
  '203': {
    name: '宮城県',
    prefecture: '宮城県',
    coordinates: [
      [38.8, 141.8], [38.3, 141.5], [37.8, 141.0], [37.5, 140.8]
    ]
  },
  '204': {
    name: '福島県',
    prefecture: '福島県',
    coordinates: [
      [37.5, 140.8], [37.0, 141.0], [36.8, 140.8], [36.5, 140.5]
    ]
  },
  
  // 関東
  '301': {
    name: '茨城県',
    prefecture: '茨城県',
    coordinates: [
      [36.5, 140.5], [36.0, 140.8], [35.8, 140.5], [35.5, 140.3]
    ]
  },
  '302': {
    name: '千葉県九十九里・外房',
    prefecture: '千葉県',
    coordinates: [
      [35.5, 140.3], [35.2, 140.5], [35.0, 140.3], [34.8, 140.0]
    ]
  },
  '303': {
    name: '千葉県内房',
    prefecture: '千葉県',
    coordinates: [
      [35.5, 139.8], [35.2, 139.5], [35.0, 139.8], [34.8, 140.0]
    ]
  },
  '304': {
    name: '東京湾内湾',
    prefecture: '東京都',
    coordinates: [
      [35.8, 139.8], [35.5, 139.5], [35.3, 139.8], [35.0, 139.5]
    ]
  },
  '305': {
    name: '相模湾・三浦半島',
    prefecture: '神奈川県',
    coordinates: [
      [35.3, 139.8], [35.0, 139.5], [34.8, 139.3], [34.5, 139.0]
    ]
  },
  
  // 東海・近畿
  '401': {
    name: '静岡県',
    prefecture: '静岡県',
    coordinates: [
      [35.0, 139.0], [34.5, 138.5], [34.0, 138.0], [34.2, 137.8]
    ]
  },
  '402': {
    name: '愛知県外海',
    prefecture: '愛知県',
    coordinates: [
      [34.8, 137.0], [34.5, 136.8], [34.2, 136.5], [34.0, 136.8]
    ]
  },
  '403': {
    name: '三重県南部',
    prefecture: '三重県',
    coordinates: [
      [34.2, 136.8], [34.0, 136.5], [33.8, 136.0], [33.5, 135.8]
    ]
  },
  
  // 四国・中国
  '501': {
    name: '和歌山県',
    prefecture: '和歌山県',
    coordinates: [
      [34.2, 135.8], [34.0, 135.5], [33.5, 135.2], [33.2, 135.0]
    ]
  },
  '502': {
    name: '徳島県',
    prefecture: '徳島県',
    coordinates: [
      [34.2, 134.8], [33.8, 134.5], [33.5, 134.2], [33.2, 134.0]
    ]
  },
  '503': {
    name: '高知県',
    prefecture: '高知県',
    coordinates: [
      [33.8, 134.0], [33.5, 133.5], [33.0, 133.0], [32.8, 132.8]
    ]
  },
  
  // 九州・沖縄
  '601': {
    name: '宮崎県',
    prefecture: '宮崎県',
    coordinates: [
      [32.5, 131.8], [32.0, 131.5], [31.5, 131.2], [31.0, 131.0]
    ]
  },
  '602': {
    name: '鹿児島県東部',
    prefecture: '鹿児島県',
    coordinates: [
      [31.5, 131.0], [31.0, 130.8], [30.5, 130.5], [30.0, 130.2]
    ]
  },
  '701': {
    name: '沖縄本島地方',
    prefecture: '沖縄県',
    coordinates: [
      [26.8, 128.0], [26.0, 127.5], [25.5, 127.2], [25.0, 127.0]
    ]
  },
  '702': {
    name: '宮古・八重山地方',
    prefecture: '沖縄県',
    coordinates: [
      [25.0, 125.5], [24.5, 125.0], [24.0, 124.5], [23.5, 124.0]
    ]
  }
} as const;