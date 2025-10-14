"use strict";
/**
 * DMData.jp API レスポンスから地震情報を抽出
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIntensity = normalizeIntensity;
exports.extractEarthquakeInfo = extractEarthquakeInfo;
exports.extractMultipleEarthquakeInfo = extractMultipleEarthquakeInfo;
/**
 * 震度を正規化（"5-" -> "5弱", "5+" -> "5強"）
 */
function normalizeIntensity(intensity) {
    const map = {
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
function extractEarthquakeInfo(item) {
    try {
        const info = {
            eventId: item.head?.eventID || item.xmlReport?.head?.eventID || item.id,
            type: item.head?.type || "",
            infoType: item.xmlReport?.head?.infoType || "",
            title: item.xmlReport?.head?.headline?.text || item.xmlReport?.control?.title || item.xmlReport?.head?.title || "",
            occurrenceTime: item.xmlReport?.head?.targetDateTime || undefined,
            occurredAt: item.xmlReport?.head?.targetDateTime || undefined,
            arrivalTime: item.xmlReport?.head?.reportDateTime || undefined,
            serialNo: parseInt(item.xmlReport?.head?.serial || "1", 10),
            receivedAt: item.receivedTime,
        };
        // VXSE51: 震度速報（震源情報なし）
        // VXSE53: 震源・震度に関する情報
        const body = item.xmlReport?.body;
        if (!body) {
            return info;
        }
        // 震源情報（VXSE53のみ）
        if (body.earthquake?.hypocenter) {
            const hypocenter = body.earthquake.hypocenter;
            info.epicenter = hypocenter.name || undefined;
            if (hypocenter.magnitude?.value) {
                info.magnitude = parseFloat(hypocenter.magnitude.value);
            }
            if (hypocenter.depth?.value) {
                const depthValue = hypocenter.depth.value;
                const condition = hypocenter.depth.condition;
                if (condition === "ごく浅い") {
                    info.depth = "ごく浅い";
                }
                else if (depthValue) {
                    const depthKm = parseInt(depthValue) / 1000; // メートルをキロメートルに変換
                    info.depth = `約${depthKm}km`;
                }
            }
        }
        // 発生時刻
        if (body.earthquake?.originTime) {
            info.occurrenceTime = body.earthquake.originTime;
            info.occurredAt = body.earthquake.originTime;
        }
        // 到達時刻（震度速報の場合）
        if (body.earthquake?.arrivalTime) {
            info.arrivalTime = body.earthquake.arrivalTime;
        }
        // 最大震度
        if (body.intensity?.observation?.maxInt) {
            info.maxIntensity = normalizeIntensity(body.intensity.observation.maxInt);
        }
        // 都道府県別震度
        const prefectures = body.intensity?.observation?.prefectures?.pref;
        if (Array.isArray(prefectures)) {
            info.prefectureObservations = prefectures
                .filter((pref) => pref.name && pref.maxInt)
                .map((pref) => ({
                prefecture: pref.name,
                maxIntensity: normalizeIntensity(pref.maxInt || ""),
            }));
        }
        // VXSE51(震度速報)の場合、headlineから震度を抽出
        if (item.head?.type === "VXSE51") {
            const headline = item.xmlReport?.head?.headline;
            if (headline && typeof headline === 'object') {
                // information配列から震度情報を抽出
                const information = Array.isArray(headline.information) ? headline.information : [headline.information];
                const intensityInfos = [];
                let maxIntensity = "";
                for (const info of information) {
                    if (!info || info.type !== "震度速報")
                        continue;
                    const items = Array.isArray(info.Item) ? info.Item : [info.Item];
                    for (const infoItem of items) {
                        if (!infoItem?.Kind?.Name)
                            continue;
                        const intensity = infoItem.Kind.Name; // e.g. "震度３"
                        const normalizedIntensity = normalizeIntensity(intensity.replace("震度", ""));
                        if (!maxIntensity || normalizedIntensity > maxIntensity) {
                            maxIntensity = normalizedIntensity;
                        }
                        // 地域情報
                        const areas = Array.isArray(infoItem.Areas) ? infoItem.Areas : [infoItem.Areas];
                        for (const areaGroup of areas) {
                            if (!areaGroup)
                                continue;
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
    }
    catch (error) {
        console.error("Failed to extract earthquake info:", error);
        return null;
    }
}
/**
 * 複数のTelegramItemから地震情報を抽出
 */
function extractMultipleEarthquakeInfo(items) {
    return items
        .map((item) => extractEarthquakeInfo(item))
        .filter((info) => info !== null);
}
