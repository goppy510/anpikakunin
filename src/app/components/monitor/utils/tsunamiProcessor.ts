// 津波情報処理ユーティリティ

import {
  TsunamiWarning,
  TsunamiArea,
  TsunamiHeight,
  TSUNAMI_COASTAL_AREAS,
} from "../types/TsunamiTypes";
import { WebSocketMessage } from "../types/WebSocketTypes";

// 津波情報をWebSocketメッセージから抽出する関数
export const processTsunamiMessage = (
  message: WebSocketMessage
): TsunamiWarning | null => {
  try {

    // 津波関連メッセージかチェック
    if (
      !message.classification?.includes("tsunami") &&
      !message.classification?.includes("telegram.tsunami")
    ) {
      return null;
    }


    // メッセージボディをデコード
    let decodedData = null;
    try {
      if (message.body && message.encoding === "base64") {
        const binaryString = atob(message.body);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }

        if (message.compression === "gzip") {
          const pako = require("pako");
          const decompressed = pako.inflate(uint8Array, { to: "string" });
          decodedData = JSON.parse(decompressed);
        } else {
          decodedData = JSON.parse(new TextDecoder().decode(uint8Array));
        }
      }
    } catch (error) {
    }

    const xmlReport = message.xmlReport || decodedData?.xmlReport;
    if (!xmlReport) {
      return null;
    }

    // 津波情報の基本データを抽出
    const head = xmlReport.head;
    const body = xmlReport.body;

    if (!head || !body) {
      return null;
    }

    // 津波警報の種別を判定
    const infoKind = head.infoKind || "";
    const title = head.title || "";
    const headline = head.headline || "";


    let warningType: "major_warning" | "warning" | "advisory" | "forecast" =
      "forecast";

    if (infoKind.includes("大津波警報") || title.includes("大津波警報")) {
      warningType = "major_warning";
    } else if (infoKind.includes("津波警報") || title.includes("津波警報")) {
      warningType = "warning";
    } else if (
      infoKind.includes("津波注意報") ||
      title.includes("津波注意報")
    ) {
      warningType = "advisory";
    } else if (infoKind.includes("津波予報") || title.includes("津波予報")) {
      warningType = "forecast";
    }

    // 解除情報の判定
    const isCancel =
      headline.includes("解除") ||
      headline.includes("取消") ||
      title.includes("解除");

    // 津波到達予想時刻
    const expectedArrival =
      body.tsunami?.expectedArrival || body.tsunami?.arrivalTime;

    // 対象地域の抽出
    const areas: TsunamiArea[] = [];
    const tsunamiAreas = body.tsunami?.areas || body.tsunami?.area || [];

    if (Array.isArray(tsunamiAreas)) {
      tsunamiAreas.forEach((area: any) => {
        const areaCode = area.code || area.areaCode;
        const areaName = area.name || area.areaName;
        const prefecture =
          area.prefecture || extractPrefectureFromName(areaName);

        // 沿岸部座標の取得
        const coordinates = getCoastalCoordinates(areaCode, areaName);

        // 津波高情報
        const maxHeight = extractTsunamiHeight(area);

        areas.push({
          code: areaCode || `area-${Date.now()}-${Math.random()}`,
          name: areaName || "不明地域",
          prefecture: prefecture,
          warning_type: warningType,
          coordinates: coordinates,
          expectedArrival: area.expectedArrival || expectedArrival,
          maxHeight: maxHeight,
        });
      });
    }

    const tsunamiWarning: TsunamiWarning = {
      id: `tsunami-${Date.now()}`,
      eventId: head.eventId || message.id || `event-${Date.now()}`,
      issueTime: head.time || new Date().toISOString(),
      type: warningType,
      areas: areas,
      isCancel: isCancel,
      expectedArrival: expectedArrival,
      maxHeight: extractTsunamiHeight(body.tsunami),
    };


    return tsunamiWarning;
  } catch (error) {
    return null;
  }
};

// 地域名から都道府県名を抽出
const extractPrefectureFromName = (areaName: string): string => {
  const prefectures = [
    "北海道",
    "青森県",
    "岩手県",
    "宮城県",
    "秋田県",
    "山形県",
    "福島県",
    "茨城県",
    "栃木県",
    "群馬県",
    "埼玉県",
    "千葉県",
    "東京都",
    "神奈川県",
    "新潟県",
    "富山県",
    "石川県",
    "福井県",
    "山梨県",
    "長野県",
    "岐阜県",
    "静岡県",
    "愛知県",
    "三重県",
    "滋賀県",
    "京都府",
    "大阪府",
    "兵庫県",
    "奈良県",
    "和歌山県",
    "鳥取県",
    "島根県",
    "岡山県",
    "広島県",
    "山口県",
    "徳島県",
    "香川県",
    "愛媛県",
    "高知県",
    "福岡県",
    "佐賀県",
    "長崎県",
    "熊本県",
    "大分県",
    "宮崎県",
    "鹿児島県",
    "沖縄県",
  ];

  for (const pref of prefectures) {
    if (areaName.includes(pref.replace(/[都道府県]$/, ""))) {
      return pref;
    }
  }

  return "不明";
};

// 沿岸部座標の取得
const getCoastalCoordinates = (
  areaCode: string,
  areaName: string
): [number, number][] | undefined => {
  // コードで直接検索
  if (
    areaCode &&
    TSUNAMI_COASTAL_AREAS[areaCode as keyof typeof TSUNAMI_COASTAL_AREAS]
  ) {
    return TSUNAMI_COASTAL_AREAS[areaCode as keyof typeof TSUNAMI_COASTAL_AREAS]
      .coordinates;
  }

  // 名前で検索
  for (const [code, area] of Object.entries(TSUNAMI_COASTAL_AREAS)) {
    if (area.name === areaName || areaName.includes(area.name)) {
      return area.coordinates;
    }
  }

  return undefined;
};

// 津波高情報の抽出
const extractTsunamiHeight = (tsunamiData: any): TsunamiHeight | undefined => {
  if (!tsunamiData) return undefined;

  const height = tsunamiData.height || tsunamiData.maxHeight;
  if (!height) return undefined;

  let category: "giant" | "high" | "medium" | "low" | "slight" = "slight";
  let text = "不明";
  let value: number | undefined;

  if (typeof height === "string") {
    text = height;
    if (height.includes("巨大")) {
      category = "giant";
    } else if (height.includes("高い")) {
      category = "high";
    } else if (height.includes("中程度")) {
      category = "medium";
    } else if (height.includes("低い")) {
      category = "low";
    }
  } else if (typeof height === "number") {
    value = height;
    text = `${height}m`;

    if (height >= 10) {
      category = "giant";
    } else if (height >= 3) {
      category = "high";
    } else if (height >= 1) {
      category = "medium";
    } else if (height >= 0.2) {
      category = "low";
    } else {
      category = "slight";
    }
  } else if (height.value) {
    value = parseFloat(height.value);
    text = height.text || `${value}m`;
    category = height.category || "medium";
  }

  return {
    value: value,
    category: category,
    text: text,
  };
};
