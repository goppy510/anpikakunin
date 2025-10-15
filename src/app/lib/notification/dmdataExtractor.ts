/**
 * DMData.jp API レスポンスから地震情報を抽出
 */

export interface EarthquakeInfo {
  eventId: string;
  type: string; // VXSE51 or VXSE53
  infoType: string; // 情報タイプ
  title: string;
  epicenter?: string; // 震源地
  magnitude?: number; // マグニチュード
  depth?: string; // 震源の深さ
  maxIntensity?: string; // 最大震度
  occurredAt?: string; // 発生時刻
  occurrenceTime?: string; // 発生時刻（後方互換）
  arrivalTime?: string; // 情報発表時刻
  serialNo: number; // 電文番号
  receivedAt: string; // 受信時刻
  prefectureObservations?: Record<string, any>; // 都道府県別観測情報
  rawData: any; // 元のTelegramItem全体
}

/**
 * /v2/telegram APIのレスポンスアイテム
 */
export interface TelegramItem {
  id: string;
  classification: string;
  head: {
    type: string;
    author: string;
    time: string;
    designation?: string;
    test?: boolean;
    eventID?: string;
  };
  receivedTime: string;
  xmlReport?: {
    control: {
      title: string;
      dateTime: string;
      status: string;
      editorialOffice: string;
      publishingOffice: string;
    };
    head: {
      title: string;
      reportDateTime: string;
      targetDateTime?: string;
      eventID?: string;
      infoType: string;
      serial?: string;
      infoKind: string;
      infoKindVersion?: string;
      headline?: {
        text?: string;
        information?: any;
      };
    };
    body?: {
      earthquake?: {
        originTime?: string;
        arrivalTime?: string;
        hypocenter?: {
          name?: string;
          coordinate?: {
            value?: string;
            description?: string;
          };
          depth?: {
            value?: string;
            condition?: string;
          };
          magnitude?: {
            value?: string;
            condition?: string;
          };
        };
      };
      intensity?: {
        observation?: {
          maxInt?: string;
          prefectures?: {
            pref?: Array<{
              name: string;
              code: string;
              maxInt?: string;
            }>;
          };
        };
      };
      text?: string;
      comments?: any;
    };
  };
}

/**
 * 震度を正規化（"5-" -> "5弱", "5+" -> "5強"）
 */
export function normalizeIntensity(intensity: string): string {
  const map: Record<string, string> = {
    "5-": "5弱",
    "5+": "5強",
    "6-": "6弱",
    "6+": "6強",
  };
  return map[intensity] || intensity;
}

/**
 * TelegramItemから地震情報を抽出
 */
export function extractEarthquakeInfo(item: TelegramItem): EarthquakeInfo | null {
  try {
    // XMLパース時に大文字/小文字どちらも対応
    const xmlReport = item.xmlReport as any;
    const head = xmlReport?.Head || xmlReport?.head;
    const control = xmlReport?.Control || xmlReport?.control;
    const body = xmlReport?.Body || xmlReport?.body;

    const info: EarthquakeInfo = {
      eventId: item.head?.eventID || head?.EventID || head?.eventID || item.id,
      type: item.head?.type || "",
      infoType: head?.InfoType || head?.infoType || "",
      title: head?.Headline?.Text || head?.headline?.text || control?.Title || control?.title || head?.Title || head?.title || "",
      occurrenceTime: head?.TargetDateTime || head?.targetDateTime || undefined,
      occurredAt: head?.TargetDateTime || head?.targetDateTime || undefined,
      arrivalTime: head?.ReportDateTime || head?.reportDateTime || undefined,
      serialNo: parseInt(head?.Serial || head?.serial || "1", 10),
      receivedAt: item.receivedTime,
      rawData: item, // 元のTelegramItem全体を保存
    };

    // VXSE51: 震度速報（震源情報なし）
    // VXSE53: 震源・震度に関する情報

    if (!body) {
      return info;
    }

    // 大文字/小文字両対応
    const earthquake = body.Earthquake || body.earthquake;
    const intensity = body.Intensity || body.intensity;

    // 震源情報（VXSE53のみ）
    const hypocenter = earthquake?.Hypocenter || earthquake?.hypocenter;
    if (hypocenter) {
      const area = hypocenter.Area || hypocenter.area;
      info.epicenter = area?.Name || area?.name || undefined;

      // マグニチュード（jmx_eb:Magnitude または Magnitude）
      const magnitude = earthquake?.['jmx_eb:Magnitude'] || earthquake?.Magnitude || earthquake?.magnitude;
      if (magnitude?._) {
        info.magnitude = parseFloat(magnitude._);
      } else if (magnitude?.value) {
        info.magnitude = parseFloat(magnitude.value);
      }

      // 深さ（jmx_eb:Coordinate または Depth）
      const coordinate = area?.['jmx_eb:Coordinate'] || area?.coordinate;
      if (coordinate?.description) {
        // "北緯３４．９度　東経１３７．４度　深さ　４０ｋｍ" から深さを抽出
        const depthMatch = coordinate.description.match(/深さ\s*([０-９ごく浅いｋｍkm]+)/);
        if (depthMatch) {
          const depthStr = depthMatch[1];
          if (depthStr.includes('ごく浅い')) {
            info.depth = "ごく浅い";
          } else {
            // 全角数字を半角に変換
            const halfWidth = depthStr.replace(/[０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
            const depthKm = halfWidth.replace(/[ｋｍkm]/g, '').trim();
            info.depth = `約${depthKm}km`;
          }
        }
      } else {
        // 従来のDepthフィールドも確認
        const depth = hypocenter.Depth || hypocenter.depth;
        if (depth?.value) {
          const depthValue = depth.value;
          const condition = depth.condition;

          if (condition === "ごく浅い") {
            info.depth = "ごく浅い";
          } else if (depthValue) {
            const depthKm = parseInt(depthValue) / 1000; // メートルをキロメートルに変換
            info.depth = `約${depthKm}km`;
          }
        }
      }
    }

    // 発生時刻
    const originTime = earthquake?.OriginTime || earthquake?.originTime;
    if (originTime) {
      info.occurrenceTime = originTime;
      info.occurredAt = originTime;
    }

    // 到達時刻（震度速報の場合）
    const arrivalTime = earthquake?.ArrivalTime || earthquake?.arrivalTime;
    if (arrivalTime) {
      info.arrivalTime = arrivalTime;
    }

    // 最大震度
    const observation = intensity?.Observation || intensity?.observation;
    const maxInt = observation?.MaxInt || observation?.maxInt;
    if (maxInt) {
      info.maxIntensity = normalizeIntensity(maxInt);
    }

    // 都道府県別震度（大文字/小文字両対応）
    const prefRaw = observation?.Pref || observation?.pref || body.intensity?.observation?.prefectures?.pref;
    const prefectures = Array.isArray(prefRaw) ? prefRaw : (prefRaw ? [prefRaw] : []);

    if (prefectures.length > 0) {
      const prefObservations: Record<string, any> = {};

      for (const pref of prefectures) {
        const prefCode = pref.Code || pref.code;
        const prefName = pref.Name || pref.name;
        const maxInt = pref.MaxInt || pref.maxInt;

        if (prefCode && maxInt) {
          prefObservations[prefCode] = {
            name: prefName,
            maxIntensity: normalizeIntensity(maxInt),
          };
        }
      }

      if (Object.keys(prefObservations).length > 0) {
        info.prefectureObservations = prefObservations;
      }
    }

    // VXSE51(震度速報)の場合、headlineから震度を抽出
    if (item.head?.type === "VXSE51") {
      const headline = item.xmlReport?.head?.headline;

      if (headline && typeof headline === 'object') {
        // information配列から震度情報を抽出
        const information = Array.isArray(headline.information) ? headline.information : [headline.information];
        const intensityInfos: Array<{ prefecture: string; maxIntensity: string }> = [];
        let maxIntensity = "";

        for (const info of information) {
          if (!info || info.type !== "震度速報") continue;
          const items = Array.isArray(info.Item) ? info.Item : [info.Item];

          for (const infoItem of items) {
            if (!infoItem?.Kind?.Name) continue;
            const intensity = infoItem.Kind.Name; // e.g. "震度３"
            const normalizedIntensity = normalizeIntensity(intensity.replace("震度", ""));

            if (!maxIntensity || normalizedIntensity > maxIntensity) {
              maxIntensity = normalizedIntensity;
            }

            // 地域情報
            const areas = Array.isArray(infoItem.Areas) ? infoItem.Areas : [infoItem.Areas];
            for (const areaGroup of areas) {
              if (!areaGroup) continue;
              const areaList = Array.isArray(areaGroup.Area) ? areaGroup.Area : [areaGroup.Area];
              for (const area of areaList) {
                if (area?.Name) {
                  intensityInfos.push({
                    prefecture: area.Name,
                    maxIntensity: normalizedIntensity,
                  });
                }
              }
            }
          }
        }

        if (maxIntensity) {
          info.maxIntensity = maxIntensity;
          info.prefectureObservations = intensityInfos;
        }
      }
    }

    return info;
  } catch (error) {
    console.error("Failed to extract earthquake info:", error);
    return null;
  }
}

/**
 * 複数のTelegramItemから地震情報を抽出
 */
export function extractMultipleEarthquakeInfo(items: TelegramItem[]): EarthquakeInfo[] {
  return items
    .map((item) => extractEarthquakeInfo(item))
    .filter((info): info is EarthquakeInfo => info !== null);
}
