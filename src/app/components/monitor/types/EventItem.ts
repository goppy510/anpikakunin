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
};