// 地震シミュレーション関連のユーティリティ

import { EventItem } from "../types/EventItem";

// シミュレーション用のサンプル地震データ生成
export const generateTestEarthquakeEvent = (): EventItem => {
  const magnitude = 4.0 + Math.random() * 3.0; // 4.0-7.0のランダム
  const intensities = ["3", "4", "5弱", "5強", "6弱", "6強"];
  const maxInt = intensities[Math.floor(Math.random() * intensities.length)];
  
  const locations = [
    { name: "石狩湾", depth: 40 },
    { name: "胆振地方中東部", depth: 35 },
    { name: "十勝沖", depth: 60 },
    { name: "釧路沖", depth: 45 },
    { name: "宗谷地方北部", depth: 20 },
  ];
  
  const location = locations[Math.floor(Math.random() * locations.length)];
  
  return {
    eventId: `simulation-${Date.now()}`,
    arrivalTime: new Date().toISOString(),
    originTime: new Date(Date.now() - Math.random() * 300000).toISOString(), // 0-5分前
    maxInt,
    magnitude: { value: Math.round(magnitude * 10) / 10 },
    hypocenter: { 
      name: location.name, 
      depth: { value: location.depth + Math.floor(Math.random() * 20) - 10 } // ±10km
    },
    isTest: true,
  };
};

// 北海道地震シミュレーション用の観測点データ
export const getHokkaidoSimulationData = () => {
  const sampleStations = [
    { code: "0110100", intensity: "6強" }, // 札幌中央区北２条（震源に最も近い）
    { code: "0110140", intensity: "6弱" }, // 札幌中央区南４条
    { code: "0110220", intensity: "5強" }, // 札幌北区太平
    { code: "0123500", intensity: "5弱" }, // 石狩市花川
    { code: "0123522", intensity: 4 }, // 石狩市花畔
    { code: "0130320", intensity: 3 }, // 当別町白樺
    { code: "0130431", intensity: 2 }, // 新篠津村第４７線（最も遠い）
  ];
  
  const epicenter = {
    lat: 43.2,
    lon: 141.0,
  };
  
  return {
    epicenter,
    stations: sampleStations,
  };
};

// シミュレーション強度のバリエーション
export const getRandomSimulationIntensity = (): string => {
  const intensities = ["3", "4", "5弱", "5強", "6弱", "6強", "7"];
  const weights = [0.3, 0.25, 0.2, 0.15, 0.07, 0.025, 0.005]; // 重み付け
  
  const random = Math.random();
  let cumulative = 0;
  
  for (let i = 0; i < intensities.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) {
      return intensities[i];
    }
  }
  
  return "4"; // フォールバック
};