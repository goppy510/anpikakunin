// 地震イベントアイテムの型定義

export type EventItem = {
  eventId: string;
  originTime?: string;
  arrivalTime: string;
  maxInt?: string;
  magnitude?: { value?: number; condition?: string };
  hypocenter?: {
    name?: string;
    depth?: { value?: number; condition?: string };
  };
  isTest?: boolean;
  isConfirmed?: boolean; // 最終確定フラグ
  currentMaxInt?: string; // 現在の最大震度（地図用）
};