// プログレッシブ地震シミュレーションサービス
// 1つのイベントで段階的に情報を更新

import { EventItem } from "../types/EventItem";
import { getRandomSimulationIntensity } from "./simulationUtils";

export interface ProgressiveSimulationCallbacks {
  onEventUpdate: (event: EventItem) => void;
  onMapSimulation: () => void;
}

// 地震の進展段階
interface EarthquakePhase {
  phase: string;
  maxInt: string;
  magnitude: number;
  hypocenter: {
    name: string;
    depth: number;
  };
  updateDelay: number; // 次の更新までの時間（ms）
}

// シミュレーション用の地震進展パターン
const createEarthquakeProgression = (): EarthquakePhase[] => {
  const locations = [
    { name: "石狩湾", depth: 40 },
    { name: "胆振地方中東部", depth: 35 },
    { name: "十勝沖", depth: 60 },
    { name: "釧路沖", depth: 45 },
    { name: "宗谷地方北部", depth: 20 },
  ];
  
  // 一つの地震イベント全体で同じ震源地を使用
  const selectedLocation = locations[Math.floor(Math.random() * locations.length)];
  const baseDepth = selectedLocation.depth;
  
  return [
    {
      phase: "初期検知",
      maxInt: "3",
      magnitude: 3.8,
      hypocenter: {
        name: `テスト震源（${selectedLocation.name}）`,
        depth: baseDepth + Math.floor(Math.random() * 10) - 5,
      },
      updateDelay: 3000, // 3秒後
    },
    {
      phase: "情報更新1",
      maxInt: "4",
      magnitude: 4.5,
      hypocenter: {
        name: `テスト震源（${selectedLocation.name}）`,
        depth: baseDepth + Math.floor(Math.random() * 6) - 3,
      },
      updateDelay: 4000, // 4秒後
    },
    {
      phase: "情報更新2",
      maxInt: getRandomSimulationIntensity(),
      magnitude: 4.8 + Math.random() * 1.5,
      hypocenter: {
        name: `テスト震源（${selectedLocation.name}）`,
        depth: baseDepth + Math.floor(Math.random() * 4) - 2,
      },
      updateDelay: 5000, // 5秒後
    },
    {
      phase: "最終報",
      maxInt: getRandomSimulationIntensity(),
      magnitude: 5.0 + Math.random() * 2.0,
      hypocenter: {
        name: `テスト震源（${selectedLocation.name}）`,
        depth: baseDepth,
      },
      updateDelay: 0, // 最終
    },
  ];
};

// プログレッシブシミュレーション実行
export const runProgressiveSimulation = (callbacks: ProgressiveSimulationCallbacks) => {
  const eventId = `test-progressive-${Date.now()}`;
  const baseTime = new Date();
  const progression = createEarthquakeProgression();
  
  let cumulativeDelay = 0;
  
  progression.forEach((phase, index) => {
    setTimeout(() => {
      const isFirst = index === 0;
      const isFinal = index === progression.length - 1;
      
      // イベント情報を更新
      const updatedEvent: EventItem = {
        eventId,
        arrivalTime: new Date(baseTime.getTime() + cumulativeDelay).toISOString(),
        originTime: new Date(baseTime.getTime() - 120000 + cumulativeDelay).toISOString(),
        maxInt: phase.maxInt,
        magnitude: { value: Math.round(phase.magnitude * 10) / 10 },
        hypocenter: {
          name: phase.hypocenter.name,
          depth: { value: phase.hypocenter.depth },
        },
        isTest: true,
      };
      
      // イベント情報を更新
      callbacks.onEventUpdate(updatedEvent);
      
      // 最初だけマップシミュレーションも実行
      if (isFirst) {
        setTimeout(() => {
          callbacks.onMapSimulation();
        }, 1000); // マップアニメーションは1秒後に開始
      }
      
      console.log(`地震情報更新 - ${phase.phase}:`, {
        震度: phase.maxInt,
        マグニチュード: phase.magnitude,
        震源: phase.hypocenter.name,
        深さ: phase.hypocenter.depth,
      });
      
    }, cumulativeDelay);
    
    cumulativeDelay += phase.updateDelay;
  });
  
  return eventId;
};

// テスト用の単発イベント生成（プログレッシブではない）
export const generateSingleTestEvent = (): EventItem => {
  const locations = [
    { name: "石狩湾", depth: 40 },
    { name: "胆振地方中東部", depth: 35 },
    { name: "十勝沖", depth: 60 },
  ];
  
  const location = locations[Math.floor(Math.random() * locations.length)];
  
  return {
    eventId: `test-single-${Date.now()}`,
    arrivalTime: new Date().toISOString(),
    originTime: new Date(Date.now() - Math.random() * 300000).toISOString(),
    maxInt: getRandomSimulationIntensity(),
    magnitude: { value: Math.round((4.0 + Math.random() * 3.0) * 10) / 10 },
    hypocenter: {
      name: location.name,
      depth: { value: location.depth + Math.floor(Math.random() * 20) - 10 },
    },
    isTest: true,
  };
};