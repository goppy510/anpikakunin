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
            eventId: item.head.eventID || item.id,
            type: item.head.type,
            title: item.xmlReport?.control?.title || item.xmlReport?.head?.title || "",
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
