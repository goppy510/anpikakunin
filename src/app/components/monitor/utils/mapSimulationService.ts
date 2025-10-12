// マップ用地震シミュレーションサービス

import { getHokkaidoSimulationData, getRandomSimulationIntensity } from "./simulationUtils";

export interface EarthquakeData {
  code: string;
  intensity: number | string;
  arrivalTime: string;
}

export interface MapSimulationCallbacks {
  onEarthquakeUpdate?: (event: {
    eventId: string;
    arrivalTime: string;
    maxInt?: string;
    magnitude?: { value?: number };
    hypocenter?: { name?: string };
  }) => void;
}

// 距離計算関数（キロメートル）
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371; // 地球の半径（km）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 震度を数値に変換するヘルパー関数
const getIntensityValue = (intensity: number | string): number => {
  if (typeof intensity === 'string') {
    if (intensity === '5弱' || intensity === '5-') return 5.0;
    if (intensity === '5強' || intensity === '5+') return 5.5;
    if (intensity === '6弱' || intensity === '6-') return 6.0;
    if (intensity === '6強' || intensity === '6+') return 6.5;
    return parseFloat(intensity) || 0;
  }
  return intensity;
};

// 数値震度を表示用文字列に変換する関数
const formatIntensityForDisplay = (intensity: number): string => {
  if (intensity === 5.0) return "5弱";
  if (intensity === 5.5) return "5強";
  if (intensity === 6.0) return "6弱";
  if (intensity === 6.5) return "6強";
  return intensity.toString();
};

// 段階的震度変化をシミュレートする関数
const simulateIntensityProgression = (
  stationCode: string, 
  finalIntensity: number | string, 
  distance: number, 
  baseDelay: number,
  onUpdate: (code: string, data: EarthquakeData) => void
) => {
  // 最終震度を数値に変換
  let finalIntensityNum: number;
  if (typeof finalIntensity === 'string') {
    if (finalIntensity === '5弱' || finalIntensity === '5-') finalIntensityNum = 5.0;
    else if (finalIntensity === '5強' || finalIntensity === '5+') finalIntensityNum = 5.5;
    else if (finalIntensity === '6弱' || finalIntensity === '6-') finalIntensityNum = 6.0;
    else if (finalIntensity === '6強' || finalIntensity === '6+') finalIntensityNum = 6.5;
    else finalIntensityNum = parseFloat(finalIntensity) || 0;
  } else {
    finalIntensityNum = finalIntensity;
  }
  
  // 距離に基づく遅延計算
  const arrivalDelay = baseDelay + (distance * 100); // 距離1kmあたり100ms
  
  // 震度の段階的変化を定義（0から最終震度まで）
  const progressionSteps = [];
  const maxSteps = Math.floor(finalIntensityNum) + (finalIntensityNum % 1 > 0 ? 1 : 0);
  
  for (let step = 0; step <= maxSteps; step++) {
    let intensity: number | string;
    if (step < finalIntensityNum) {
      intensity = step;
    } else {
      intensity = finalIntensity; // 最終段階では元の震度表記を使用
    }
    const stepDelay = arrivalDelay + (step * 400); // 震度1段階あたり400ms
    progressionSteps.push({ intensity, delay: stepDelay });
  }
  
  // 段階的に震度を更新
  progressionSteps.forEach(({ intensity, delay }) => {
    setTimeout(() => {
      onUpdate(stationCode, {
        code: stationCode,
        intensity: intensity,
        arrivalTime: new Date().toISOString()
      });
    }, delay);
  });
};

// 地震波伝播アニメーション関数（段階的震度変化付き）
export const runEarthquakeSimulation = (
  stationData: Array<{ name: string; code: string; lat: string; lon: string }>,
  onDataUpdate: (data: Map<string, EarthquakeData>) => void,
  callbacks: MapSimulationCallbacks = {}
) => {
  const { epicenter, stations } = getHokkaidoSimulationData();
  
  // 新しいテストデータを作成
  const newTestData = new Map<string, EarthquakeData>();
  stations.forEach(({code, intensity}) => {
    const testData = {
      code: code,
      intensity: intensity,
      arrivalTime: new Date().toISOString(),
    };
    newTestData.set(code, testData);
  });

  // まず空のデータを設定してマーカーをリセット
  onDataUpdate(new Map());

  // 震源からの距離でソート
  const stationsWithDistance = stationData
    .filter((station) => newTestData.has(station.code))
    .map((station) => {
      const distance = calculateDistance(
        epicenter.lat,
        epicenter.lon,
        parseFloat(station.lat),
        parseFloat(station.lon)
      );
      return {
        station,
        distance,
        earthquakeData: newTestData.get(station.code)!,
      };
    })
    .sort((a, b) => a.distance - b.distance);


  if (stationsWithDistance.length === 0) {
    return;
  }

  // データ更新用のMap
  const simulationData = new Map<string, EarthquakeData>();

  // 各観測点で段階的震度変化をシミュレート
  stationsWithDistance.forEach((item) => {
    simulateIntensityProgression(
      item.station.code, 
      item.earthquakeData.intensity, 
      item.distance, 
      500, // 基本遅延500ms
      (code, data) => {
        simulationData.set(code, data);
        onDataUpdate(new Map(simulationData));
      }
    );
  });

  // マップシミュレーションでは独自のイベントを作成しない
  // 視覚的なアニメーションのみを実行
};