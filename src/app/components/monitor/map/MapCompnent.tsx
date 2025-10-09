"use client";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useEffect, useState, useMemo, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./map.module.scss";
import type { FeatureCollection } from "geojson";
import { Oauth2Service } from "@/app/api/Oauth2Service";
import { CurrentTime } from "../components/CurrentTime";
import { IntensityScale } from "../components/IntensityScale";

interface EarthquakeStation {
  name: string;
  code: string;
  lat: string;
  lon: string;
}

interface EarthquakeData {
  code: string;
  intensity: number | string;
  arrivalTime: string;
}

import { EventItem } from "../types/EventItem";
import { TsunamiWarning, TSUNAMI_COLORS, TSUNAMI_BORDER_COLORS, TSUNAMI_COASTAL_AREAS } from "../types/TsunamiTypes";

interface MapComponentProps {
  onEarthquakeUpdate?: (event: {
    eventId: string;
    arrivalTime: string;
    maxInt?: string;
    magnitude?: { value?: number };
    hypocenter?: { name?: string };
  }) => void;
  runSimulation?: boolean;
  onSimulationComplete?: () => void;
  testMode?: boolean;
  earthquakeEvents?: EventItem[]; // 地図表示用のイベントデータ
  connectionStatus?: "open" | "connecting" | "closed" | "error";
  serverTime?: string;
  lastMessageType?: string;
  tsunamiWarnings?: TsunamiWarning[]; // 津波警報データ
  onTsunamiSimulation?: (warning: TsunamiWarning) => void; // 津波シミュレーション用
}

export default function MapComponent({
  onEarthquakeUpdate,
  runSimulation = false,
  onSimulationComplete,
  testMode = false,
  earthquakeEvents = [],
  connectionStatus = "closed",
  serverTime = "",
  lastMessageType = "",
  tsunamiWarnings = [],
  onTsunamiSimulation,
}: MapComponentProps = {}) {
  const [prefectureData, setPrefectureData] =
    useState<FeatureCollection | null>(null);
  const [stationData, setStationData] = useState<EarthquakeStation[]>([]);
  const [earthquakeData, setEarthquakeData] = useState<
    Map<string, EarthquakeData>
  >(new Map());
  const [forceRender, setForceRender] = useState(0);
  const [markersVisible, setMarkersVisible] = useState(true);
  const [animatingEarthquake, setAnimatingEarthquake] = useState(false);
  const [intensityThreshold, setIntensityThreshold] = useState<number>(3); // 震度3以上を表示
  const [activeTsunamiWarnings, setActiveTsunamiWarnings] = useState<Map<string, TsunamiWarning>>(new Map()); // アクティブな津波警報
  const [tsunamiBlinking, setTsunamiBlinking] = useState(true); // 津波警報の点滅状態

  // 震度を数値に変換するヘルパー関数
  const getIntensityValue = (intensity: number | string): number => {
    if (typeof intensity === "string") {
      if (intensity === "5弱" || intensity === "5-") return 5.0;
      if (intensity === "5強" || intensity === "5+") return 5.5;
      if (intensity === "6弱" || intensity === "6-") return 6.0;
      if (intensity === "6強" || intensity === "6+") return 6.5;
      return parseFloat(intensity) || 0;
    }
    return intensity;
  };

  // 震度フィルタリング関数
  const shouldShowIntensity = (intensity: number | string): boolean => {
    return getIntensityValue(intensity) >= intensityThreshold;
  };

  // 数値震度を表示用文字列に変換する関数
  const formatIntensityForDisplay = (intensity: number): string => {
    if (intensity === 5.0) return "5弱";
    if (intensity === 5.5) return "5強";
    if (intensity === 6.0) return "6弱";
    if (intensity === 6.5) return "6強";
    return intensity.toString();
  };

  // 震源地に応じた座標を取得する関数
  const getEpicenterCoordinates = (
    hypocentername: string
  ): [number, number] | null => {
    const hypocenter = hypocentername?.toLowerCase() || "";

    // 主要な震源地の座標定義
    if (hypocenter.includes("トカラ列島") || hypocenter.includes("tokara")) {
      return [29.3, 129.4]; // トカラ列島近海
    }
    if (hypocenter.includes("長野") || hypocenter.includes("nagano")) {
      return [36.2, 138.2]; // 長野県中部
    }
    if (hypocenter.includes("千葉") || hypocenter.includes("東方沖")) {
      return [35.7, 140.8]; // 千葉県東方沖
    }
    if (hypocenter.includes("北海道") || hypocenter.includes("石狩")) {
      return [43.2, 141.0]; // 北海道石狩湾
    }
    if (hypocenter.includes("茨城") || hypocenter.includes("ibaraki")) {
      return [36.3, 140.5]; // 茨城県沖
    }
    if (hypocenter.includes("福島") || hypocenter.includes("fukushima")) {
      return [37.4, 140.9]; // 福島県沖
    }
    if (hypocenter.includes("宮城") || hypocenter.includes("miyagi")) {
      return [38.4, 141.5]; // 宮城県沖
    }
    if (hypocenter.includes("岩手") || hypocenter.includes("iwate")) {
      return [39.7, 141.8]; // 岩手県沖
    }
    if (hypocenter.includes("青森") || hypocenter.includes("aomori")) {
      return [40.8, 141.0]; // 青森県東方沖
    }
    if (hypocenter.includes("熊本") || hypocenter.includes("kumamoto")) {
      return [32.8, 130.7]; // 熊本県
    }
    if (hypocenter.includes("大分") || hypocenter.includes("oita")) {
      return [33.2, 131.6]; // 大分県
    }
    if (hypocenter.includes("鹿児島") || hypocenter.includes("kagoshima")) {
      return [31.6, 130.6]; // 鹿児島県
    }
    if (hypocenter.includes("沖縄") || hypocenter.includes("okinawa")) {
      return [26.2, 127.7]; // 沖縄県
    }

    return null; // 座標が分からない場合
  };

  // カスタムマーカー管理コンポーネント
  const CustomMarkers = () => {
    const map = useMap();

    useEffect(() => {
      // 新しいマーカーを作成
      const newMarkers: L.CircleMarker[] = [];

      // 既存のマーカーをクリア（setLeafletMarkersは使わない）
      map.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
          map.removeLayer(layer);
        }
      });

      // 地震データがない観測点を先に描画（下のレイヤー）
      stationData.forEach((station) => {
        const lat = parseFloat(station.lat);
        const lng = parseFloat(station.lon);

        if (isNaN(lat) || isNaN(lng)) return;

        // 地震データを取得
        const earthquakeInfo = earthquakeData.get(station.code);

        // 地震データがない場合のみマーカーを作成
        if (!earthquakeInfo) {
          const marker = L.circleMarker([lat, lng], {
            radius: 2,
            fillColor: "#0d33ff",
            color: "#0d33ff",
            opacity: 1.0,
            fillOpacity: 0.9,
            weight: 0,
          });

          const popupContent = `
            <div>
              <strong>${station.name}</strong><br/>
              コード: ${station.code}<br/>
              座標: ${lat.toFixed(4)}, ${lng.toFixed(4)}<br/>
              震度データなし
            </div>
          `;
          marker.bindPopup(popupContent);
          marker.addTo(map);
          newMarkers.push(marker);
        }
      });

      // 地震データがある観測点を後に描画（上のレイヤー）
      stationData.forEach((station) => {
        const lat = parseFloat(station.lat);
        const lng = parseFloat(station.lon);

        if (isNaN(lat) || isNaN(lng)) return;

        // 地震データを取得
        const earthquakeInfo = earthquakeData.get(station.code);

        // 地震データがあり、かつ震度フィルタをパスする場合のみマーカーを作成
        if (earthquakeInfo && shouldShowIntensity(earthquakeInfo.intensity)) {
          // 震度0-7のグラデーション色スキーム（青→赤）
          const getMarkerColor = (intensity: number | string) => {
            // 数値または文字列での震度を正規化
            let normalizedIntensity: number;

            if (typeof intensity === "string") {
              // 文字列の場合は震度表記を数値に変換
              if (intensity === "5弱" || intensity === "5-")
                normalizedIntensity = 5.0;
              else if (intensity === "5強" || intensity === "5+")
                normalizedIntensity = 5.5;
              else if (intensity === "6弱" || intensity === "6-")
                normalizedIntensity = 6.0;
              else if (intensity === "6強" || intensity === "6+")
                normalizedIntensity = 6.5;
              else normalizedIntensity = parseFloat(intensity) || 0;
            } else {
              normalizedIntensity = intensity;
            }

            // 震度を0-7の範囲にクランプ
            const clampedIntensity = Math.max(
              0,
              Math.min(7, normalizedIntensity)
            );

            if (clampedIntensity === 0) return "#666666"; // 震度0: グレー
            if (clampedIntensity === 1) return "#888888"; // 震度1: 薄いグレー
            if (clampedIntensity === 2) return "#00ccff"; // 震度2: 水色
            if (clampedIntensity === 3) return "#00ff99"; // 震度3: 緑青
            if (clampedIntensity === 4) return "#66ff33"; // 震度4: 緑
            if (clampedIntensity === 5.0) return "#ffff00"; // 震度5弱: 黄
            if (clampedIntensity === 5.5) return "#ffcc00"; // 震度5強: 濃い黄
            if (clampedIntensity === 6.0) return "#ff9900"; // 震度6弱: オレンジ
            if (clampedIntensity === 6.5) return "#ff6600"; // 震度6強: 濃いオレンジ
            return "#ff0000"; // 震度7: 真っ赤
          };

          const markerColor = getMarkerColor(earthquakeInfo.intensity);

          const marker = L.circleMarker([lat, lng], {
            radius: 3,
            fillColor: markerColor,
            color: markerColor,
            opacity: 1.0,
            fillOpacity: 1.0,
            weight: 0,
          });

          const popupContent = `
            <div>
              <strong>${station.name}</strong><br/>
              コード: ${station.code}<br/>
              座標: ${lat.toFixed(4)}, ${lng.toFixed(4)}<br/>
              <strong>震度: ${earthquakeInfo.intensity}</strong><br/>
              到達時刻: ${new Date(earthquakeInfo.arrivalTime).toLocaleString()}
            </div>
          `;
          marker.bindPopup(popupContent);
          marker.addTo(map);
          newMarkers.push(marker);
        }
      });

      // クリーンアップ関数（newMarkersのみを削除）
      return () => {
        newMarkers.forEach((marker) => {
          map.removeLayer(marker);
        });
      };
    }, [
      map,
      stationData,
      earthquakeData,
      markersVisible,
      forceRender,
      intensityThreshold,
    ]);

    return null;
  };

  // 沖縄用マーカー管理コンポーネント
  const OkinawaMarkers = () => {
    const map = useMap();

    useEffect(() => {
      // 沖縄県の観測点のみをフィルタリングして表示
      const okinawaStations = stationData.filter((station) => {
        const lat = parseFloat(station.lat);
        const lng = parseFloat(station.lon);
        // 沖縄県の緯度経度範囲
        return lat >= 24 && lat <= 28 && lng >= 122 && lng <= 132;
      });

      // 既存のマーカーをクリア
      map.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
          map.removeLayer(layer);
        }
      });

      const newMarkers: L.CircleMarker[] = [];

      okinawaStations.forEach((station) => {
        const lat = parseFloat(station.lat);
        const lng = parseFloat(station.lon);

        if (isNaN(lat) || isNaN(lng)) return;

        // 地震データを取得
        const earthquakeInfo = earthquakeData.get(station.code);

        let marker: L.CircleMarker;

        if (earthquakeInfo && shouldShowIntensity(earthquakeInfo.intensity)) {
          // 震度データがある場合
          const getMarkerColor = (intensity: number | string) => {
            let normalizedIntensity: number;
            if (typeof intensity === "string") {
              if (intensity === "5弱" || intensity === "5-")
                normalizedIntensity = 5.0;
              else if (intensity === "5強" || intensity === "5+")
                normalizedIntensity = 5.5;
              else if (intensity === "6弱" || intensity === "6-")
                normalizedIntensity = 6.0;
              else if (intensity === "6強" || intensity === "6+")
                normalizedIntensity = 6.5;
              else normalizedIntensity = parseFloat(intensity) || 0;
            } else {
              normalizedIntensity = intensity;
            }

            const clampedIntensity = Math.max(
              0,
              Math.min(7, normalizedIntensity)
            );
            if (clampedIntensity === 0) return "#666666";
            if (clampedIntensity === 1) return "#888888";
            if (clampedIntensity === 2) return "#00ccff";
            if (clampedIntensity === 3) return "#00ff99";
            if (clampedIntensity === 4) return "#66ff33";
            if (clampedIntensity === 5.0) return "#ffff00";
            if (clampedIntensity === 5.5) return "#ffcc00";
            if (clampedIntensity === 6.0) return "#ff9900";
            if (clampedIntensity === 6.5) return "#ff6600";
            return "#ff0000";
          };

          const markerColor = getMarkerColor(earthquakeInfo.intensity);
          marker = L.circleMarker([lat, lng], {
            radius: 2,
            fillColor: markerColor,
            color: markerColor,
            opacity: 1.0,
            fillOpacity: 1.0,
            weight: 0,
          });

          const popupContent = `
            <div style="font-size: 10px;">
              <strong>${station.name}</strong><br/>
              震度: ${earthquakeInfo.intensity}
            </div>
          `;
          marker.bindPopup(popupContent);
        } else {
          // 震度データがない場合
          marker = L.circleMarker([lat, lng], {
            radius: 1,
            fillColor: "#0d33ff",
            color: "#0d33ff",
            opacity: 0.7,
            fillOpacity: 0.7,
            weight: 0,
          });
        }

        marker.addTo(map);
        newMarkers.push(marker);
      });

      // クリーンアップ関数
      return () => {
        newMarkers.forEach((marker) => {
          map.removeLayer(marker);
        });
      };
    }, [
      map,
      stationData,
      earthquakeData,
      markersVisible,
      forceRender,
      intensityThreshold,
    ]);

    return null;
  };

  const [wsStatus, setWsStatus] = useState<
    "closed" | "connecting" | "open" | "error"
  >("closed");
  const [oauth2Service] = useState(() => new Oauth2Service());
  const [isClient, setIsClient] = useState(false);

  // クライアントサイドであることを確認
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  // 段階的震度変化をシミュレートする関数
  const simulateIntensityProgression = (
    stationCode: string,
    finalIntensity: number | string,
    distance: number,
    baseDelay: number
  ) => {
    // 距離に基づく遅延計算
    const arrivalDelay = baseDelay + distance * 100; // 距離1kmあたり100ms

    // 最終震度を数値に変換
    let finalIntensityNum: number;
    if (typeof finalIntensity === "string") {
      if (finalIntensity === "5弱" || finalIntensity === "5-")
        finalIntensityNum = 5.0;
      else if (finalIntensity === "5強" || finalIntensity === "5+")
        finalIntensityNum = 5.5;
      else if (finalIntensity === "6弱" || finalIntensity === "6-")
        finalIntensityNum = 6.0;
      else if (finalIntensity === "6強" || finalIntensity === "6+")
        finalIntensityNum = 6.5;
      else finalIntensityNum = parseFloat(finalIntensity) || 0;
    } else {
      finalIntensityNum = finalIntensity;
    }

    // 震度の段階的変化を定義（0から最終震度まで）
    const progressionSteps = [];
    const maxSteps =
      Math.floor(finalIntensityNum) + (finalIntensityNum % 1 > 0 ? 1 : 0);

    for (let step = 0; step <= maxSteps; step++) {
      let intensity: number | string;
      if (step < finalIntensityNum) {
        intensity = step;
      } else {
        intensity = finalIntensity; // 最終段階では元の震度表記を使用
      }
      const stepDelay = arrivalDelay + step * 400; // 震度1段階あたり400ms
      progressionSteps.push({ intensity, delay: stepDelay });
    }

    // 段階的に震度を更新
    progressionSteps.forEach(({ intensity, delay }) => {
      setTimeout(() => {
        setEarthquakeData((prevData) => {
          const newData = new Map(prevData);
          newData.set(stationCode, {
            code: stationCode,
            intensity: intensity,
            arrivalTime: new Date().toISOString(),
          });
          return newData;
        });
        setForceRender((prev) => prev + 1);
      }, delay);
    });
  };

  // 地震波伝播アニメーション関数（段階的震度変化付き）
  const animateEarthquakeWave = (
    epicenterLat: number,
    epicenterLon: number,
    earthquakeIntensityData: Map<string, EarthquakeData>
  ) => {
    if (animatingEarthquake) return;

    setAnimatingEarthquake(true);

    // 震源からの距離でソート
    const stationsWithDistance = stationData
      .filter((station) => earthquakeIntensityData.has(station.code))
      .map((station) => {
        const distance = calculateDistance(
          epicenterLat,
          epicenterLon,
          parseFloat(station.lat),
          parseFloat(station.lon)
        );
        return {
          station,
          distance,
          earthquakeData: earthquakeIntensityData.get(station.code)!,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    if (stationsWithDistance.length === 0) {
      setAnimatingEarthquake(false);
      return;
    }

    // 各観測点で段階的震度変化をシミュレート
    stationsWithDistance.forEach((item) => {
      simulateIntensityProgression(
        item.station.code,
        item.earthquakeData.intensity,
        item.distance,
        500 // 基本遅延500ms
      );
    });

    // アニメーション終了タイマー（最も遠い観測点の完了を待つ）
    const maxDistance = Math.max(
      ...stationsWithDistance.map((item) => item.distance)
    );
    const maxIntensity = Math.max(
      ...stationsWithDistance.map((item) => Number(item.earthquakeData.intensity) || 0)
    );
    const totalDuration = 500 + maxDistance * 100 + maxIntensity * 400 + 1000;

    setTimeout(() => {
      setAnimatingEarthquake(false);
    }, totalDuration);
  };

  // 津波シミュレーション関数
  const addTestTsunamiWarning = () => {
    const testTsunamiWarning: TsunamiWarning = {
      id: `tsunami-test-${Date.now()}`,
      eventId: `earthquake-${Date.now()}`,
      issueTime: new Date().toISOString(),
      type: 'warning', // 津波警報（オレンジ）
      areas: [
        {
          code: '201',
          name: '青森県太平洋沿岸',
          prefecture: '青森県',
          warning_type: 'warning',
          coordinates: (TSUNAMI_COASTAL_AREAS['201']?.coordinates as unknown as [number, number][]) || [[41.0, 141.5], [40.5, 141.8], [40.0, 141.5], [40.2, 141.0]] as [number, number][],
          expectedArrival: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          maxHeight: { value: 2, category: 'medium', text: '2m' }
        },
        {
          code: '202',
          name: '岩手県',
          prefecture: '岩手県',
          warning_type: 'advisory',
          coordinates: (TSUNAMI_COASTAL_AREAS['202']?.coordinates as unknown as [number, number][]) || [[40.2, 141.0], [39.8, 142.0], [39.0, 142.0], [38.8, 141.8]] as [number, number][],
          expectedArrival: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          maxHeight: { value: 1, category: 'low', text: '1m' }
        },
        {
          code: '203',
          name: '宮城県',
          prefecture: '宮城県',
          warning_type: 'major_warning',
          coordinates: TSUNAMI_COASTAL_AREAS['203']?.coordinates || [[38.8, 141.8], [38.3, 141.5], [37.8, 141.0], [37.5, 140.8]],
          expectedArrival: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          maxHeight: { value: 5, category: 'giant', text: '巨巨大' }
        }
      ],
      isCancel: false,
      expectedArrival: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      maxHeight: { value: 5, category: 'giant', text: '巨大' }
    };

    console.log('津波シミュレーションを開始:', testTsunamiWarning);
    
    // アクティブな津波警報に追加
    setActiveTsunamiWarnings(prev => {
      const newWarnings = new Map(prev);
      newWarnings.set(testTsunamiWarning.id, testTsunamiWarning);
      return newWarnings;
    });

    // 親コンポーネントに通知
    if (onTsunamiSimulation) {
      onTsunamiSimulation(testTsunamiWarning);
    }

    // 30秒後に自動解除
    setTimeout(() => {
      setActiveTsunamiWarnings(prev => {
        const newWarnings = new Map(prev);
        newWarnings.delete(testTsunamiWarning.id);
        return newWarnings;
      });
      console.log('津波シミュレーション終了:', testTsunamiWarning.id);
    }, 30000);
  };

  // 手動テストデータ追加関数（アニメーション付き）
  const addTestEarthquakeData = () => {
    if (animatingEarthquake) return;

    // 震源地を設定（石狩湾）
    const epicenterLat = 43.2;
    const epicenterLon = 141.0;

    // 北海道の実際の観測点（震源からの距離順に配置）
    const sampleStations = [
      { code: "0110100", intensity: "6強" }, // 札幌中央区北２条（震源に最も近い）
      { code: "0110140", intensity: "6弱" }, // 札幌中央区南４条
      { code: "0110220", intensity: "5強" }, // 札幌北区太平
      { code: "0123500", intensity: "5弱" }, // 石狩市花川
      { code: "0123522", intensity: 4 }, // 石狩市花畔
      { code: "0130320", intensity: 3 }, // 当別町白樺
      { code: "0130431", intensity: 2 }, // 新篠津村第４７線（最も遠い）
    ];

    const newTestData = new Map<string, EarthquakeData>();

    sampleStations.forEach(({ code, intensity }) => {
      const testData = {
        code: code,
        intensity: intensity,
        arrivalTime: new Date().toISOString(),
      };
      newTestData.set(code, testData);
    });

    // まず空のデータを設定してマーカーをリセット
    setEarthquakeData(new Map());
    setForceRender((prev) => prev + 1);

    // 少し待ってからアニメーション開始
    setTimeout(() => {
      animateEarthquakeWave(epicenterLat, epicenterLon, newTestData);
    }, 1000); // 1秒後にアニメーション開始

    // 親コンポーネントに地震イベントを通知
    if (onEarthquakeUpdate) {
      const maxIntensity = Math.max(
        ...Array.from(newTestData.values()).map((d) =>
          getIntensityValue(d.intensity)
        )
      );
      onEarthquakeUpdate({
        eventId: `manual-test-${Date.now()}`,
        arrivalTime: new Date().toISOString(),
        maxInt: formatIntensityForDisplay(maxIntensity),
        magnitude: { value: 4.5 },
        hypocenter: { name: "手動テスト震源" },
      });
    }
  };

  // 日本の境界（全方向に十分なスクロール範囲を確保）
  const japanBounds: [[number, number], [number, number]] = [
    [20, 96], // 南西（南側を20度まで拡張してフィリピン・東南アジアまで）
    [50, 200], // 北東（北海道を含む）
  ];

  useEffect(() => {
    // 都道府県境界データを取得
    fetch(
      "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"
    )
      .then((response) => response.json())
      .then((data) => setPrefectureData(data))
      .catch((error) =>
        console.error("Failed to load prefecture data:", error)
      );

    // 地震観測点データを取得
    fetch("/assets/earthquake/stations.json")
      .then((response) => response.json())
      .then((data) => setStationData(data))
      .catch((error) => console.error("Failed to load station data:", error));
  }, []);

  // WebSocket接続でリアルタイムデータを取得
  // 注意: WebSocketManagerで接続管理しているため、MapComponentでの独自接続は無効化
  useEffect(() => {
    if (!isClient) return;

    // WebSocket接続はWebSocketManagerで管理されているため、
    // MapComponentでは状態のみ設定
    setWsStatus("open");

    return () => {
      // クリーンアップ（WebSocketManagerで管理されているため何もしない）
    };

    // 以下の元のWebSocket接続コードを無効化
    /*
    let ws: WebSocket | null = null;

    */
  }, [isClient]);

  // 震源地拡大管理コンポーネント
  const EpicenterZoom = ({ events }: { events: any[] }) => {
    const map = useMap();
    const [lastEventTime, setLastEventTime] = useState<number | null>(null);

    // 最新イベントの時刻のみをメモ化
    const latestEventTime = useMemo(() => {
      if (!events || events.length === 0) return null;
      const latestEvent = events[0];
      if (!latestEvent) return null;
      return new Date(latestEvent.arrivalTime).getTime();
    }, [events]);

    // イベント処理ロジックをコールバック化
    const handleEventUpdate = useCallback(() => {
      if (!events || events.length === 0) {
        // 初期表示時は全国地図
        map.setView([38.5, 138], 5.7);
        return;
      }

      const latestEvent = events[0];
      if (!latestEvent || !latestEventTime) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - latestEventTime;

      // 最後のイベントから30秒以上経過していたら全国地図
      if (timeDiff > 30000) {
        map.setView([38.5, 138], 5.7);
        return;
      }

      // 新しいイベントの場合のみ震源地に拡大
      if (lastEventTime === null || latestEventTime > lastEventTime) {
        if (
          latestEvent.hypocenter?.name &&
          latestEvent.currentMaxInt &&
          latestEvent.currentMaxInt !== "-"
        ) {
          const coordinates = getEpicenterCoordinates(
            latestEvent.hypocenter.name
          );
          if (!coordinates) return;

          // 震度に応じたズームレベル設定
          const intensityValue = getIntensityValue(latestEvent.currentMaxInt);
          let zoomLevel = 7; // デフォルト

          if (intensityValue >= 5) {
            zoomLevel = 9; // 震度5以上は詳細表示
          } else if (intensityValue >= 3) {
            zoomLevel = 8; // 震度3-4は中程度表示
          } else {
            zoomLevel = 7; // 震度1-2は広域表示
          }

          // スムーズに震源地に移動
          map.setView(coordinates, zoomLevel, {
            animate: true,
            duration: 1.5,
          });

          // lastEventTimeの更新
          setLastEventTime(latestEventTime);

          // 30秒後に全国地図に戻る
          setTimeout(() => {
            map.setView([38, 120], 6, {
              animate: true,
              duration: 2.0,
            });
          }, 30000); // 30秒後
        }
      }
    }, [map, events, latestEventTime, lastEventTime]);

    // latestEventTimeが変更された時のみ実行
    useEffect(() => {
      handleEventUpdate();
    }, [latestEventTime]); // handleEventUpdateを依存配列から除去

    return null;
  };

  // WebSocketから受信したイベントデータを地図用のデータに変換
  useEffect(() => {
    if (!earthquakeEvents || earthquakeEvents.length === 0) return;

    // currentMaxIntを使って地図データを更新
    const newEarthquakeData = new Map<string, EarthquakeData>();

    earthquakeEvents.forEach((event) => {
      if (event.currentMaxInt && event.currentMaxInt !== "-") {
        // ここでは仮想的な観測点データを作成（実際のAPIからのデータでは観測点コードが含まれる）
        const intensity = parseFloat(event.currentMaxInt) || 0;
        if (intensity > 0) {
          // イベントの震源地に応じた観測点コードを選択
          let testStationCodes: string[];
          if (
            event.isTest ||
            event.hypocenter?.name?.includes("千葉") ||
            event.hypocenter?.name?.includes("東方沖")
          ) {
            // テストイベントまたは千葉県東方沖 → 茨城県の観測点（地理的に近い）
            testStationCodes = ["0820100", "0820101", "0820121"];
          } else if (
            event.hypocenter?.name?.includes("北海道") ||
            event.hypocenter?.name?.includes("石狩")
          ) {
            // 北海道の観測点コード
            testStationCodes = ["0110100", "0121700", "0122400"];
          } else {
            // デフォルト（茨城県沖など）
            testStationCodes = ["0820100", "0820101", "0820121"];
          }
          testStationCodes.forEach((stationCode, index) => {
            const stationIntensity = Math.max(0, intensity - index);
            newEarthquakeData.set(stationCode, {
              code: stationCode,
              intensity: stationIntensity, // 距離に応じて震度を減衰
              arrivalTime: event.arrivalTime,
            });
          });
        }
      }
    });

    if (newEarthquakeData.size > 0) {
      setEarthquakeData(newEarthquakeData);
      setForceRender((prev) => prev + 1);
    }
  }, [earthquakeEvents]);

  // 千葉県東方沖の地震波伝播アニメーション
  const addChibaEarthquakeData = () => {
    if (animatingEarthquake) return;

    // 震源地を設定（千葉県東方沖）
    const epicenterLat = 35.7;
    const epicenterLon = 140.8;

    // 茨城県の観測点（震源からの距離順に配置）
    const sampleStations = [
      { code: "0820100", intensity: 4 }, // 茨城県（震源に近い）
      { code: "0820101", intensity: 3 }, // 茨城県
      { code: "0820121", intensity: 2 }, // 茨城県（震源から遠い）
    ];

    const newTestData = new Map<string, EarthquakeData>();

    sampleStations.forEach(({ code, intensity }) => {
      const testData = {
        code: code,
        intensity: intensity,
        arrivalTime: new Date().toISOString(),
      };
      newTestData.set(code, testData);
    });

    // まず空のデータを設定してマーカーをリセット
    setEarthquakeData(new Map());
    setForceRender((prev) => prev + 1);

    // 少し待ってからアニメーション開始
    setTimeout(() => {
      animateEarthquakeWave(epicenterLat, epicenterLon, newTestData);
    }, 1000); // 1秒後にアニメーション開始
  };

  // 外部からのシミュレーション実行
  useEffect(() => {
    if (runSimulation && !animatingEarthquake) {
      // 現在のイベントに基づいてアニメーションを選択
      const currentEvents = earthquakeEvents || [];
      const hasChiba = currentEvents.some(
        (event) =>
          event.hypocenter?.name?.includes("千葉") ||
          event.hypocenter?.name?.includes("東方沖")
      );

      if (hasChiba) {
        addChibaEarthquakeData();
      } else {
        addTestEarthquakeData(); // デフォルトは北海道
      }

      onSimulationComplete?.();
    }
  }, [runSimulation, earthquakeEvents]);

  // tsunamiWarnings propsの変更を監視
  useEffect(() => {
    if (tsunamiWarnings && tsunamiWarnings.length > 0) {
      const newWarnings = new Map();
      tsunamiWarnings.forEach(warning => {
        if (!warning.isCancel) {
          newWarnings.set(warning.id, warning);
        }
      });
      setActiveTsunamiWarnings(prev => {
        // 既存の手動シミュレーションと外部からの津波警報をマージ
        const merged = new Map(prev);
        newWarnings.forEach((warning, id) => {
          merged.set(id, warning);
        });
        return merged;
      });
    } else {
      // tsunamiWarningsが空の場合はアクティブな警報をクリア
      setActiveTsunamiWarnings(new Map());
    }
  }, [tsunamiWarnings]);
  
  // 津波警報の点滅アニメーション
  useEffect(() => {
    let blinkInterval: NodeJS.Timeout;
    
    if (activeTsunamiWarnings.size > 0 && testMode) {
      // テストモードかつ警報がある場合のみ1秒間隔で点滅
      blinkInterval = setInterval(() => {
        setTsunamiBlinking(prev => !prev);
      }, 1000);
    } else {
      setTsunamiBlinking(true);
    }
    
    return () => {
      if (blinkInterval) {
        clearInterval(blinkInterval);
      }
    };
  }, [activeTsunamiWarnings.size, testMode]);

  return (
    <div className={styles.map}>
      <MapContainer
        center={[38.5, 138]} // さらに南寄りに調整
        zoom={5.7}
        maxZoom={10}
        minZoom={2}
        maxBounds={japanBounds}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
        attributionControl={true}
        zoomControl={false} // ズームコントロールボタンを非表示
        zoomSnap={0.25} // ズーム感度を細かく（デフォルト1→0.25）
        zoomDelta={0.25} // ズーム変化量を細かく
        wheelPxPerZoomLevel={120} // マウスホイールの感度調整
      >
        {/* 濃いグレーの地図 */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />

        {/* 都道府県境界線（津波警報時は地域全体を色で塗りつぶし） */}
        {prefectureData && (
          <GeoJSON
            data={prefectureData}
            style={(feature) => {
              // 津波警報が発令されている地域の色表示設定
              let borderColor = '#ffffff';
              let borderWeight = 0.3;
              let borderOpacity = 0.7;
              let fillColor = 'transparent';
              let fillOpacity = 0;
              
              if (activeTsunamiWarnings.size > 0) {
                const prefName = feature?.properties?.name_ja || feature?.properties?.nam_ja || '';
                
                // 沿岸部の都道府県かどうかをチェック
                const coastalPrefectures = [
                  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
                  '茨城県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県',
                  '福井県', '静岡県', '愛知県', '三重県', '京都府', '大阪府', '兵庫県',
                  '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
                  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
                  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
                ];
                
                const isCoastal = coastalPrefectures.some(pref => prefName.includes(pref.replace(/[都道府県]$/, '')));
                
                if (isCoastal) {
                  // 沿岸部の場合は津波警報に応じて地域全体を色で塗りつぶし表示
                  for (const warning of activeTsunamiWarnings.values()) {
                    for (const area of warning.areas) {
                      if (area.prefecture === prefName || prefName.includes(area.prefecture.replace(/[都道府県]$/, ''))) {
                        // 津波警報レベルに応じた色設定
                        fillColor = TSUNAMI_COLORS[area.warning_type];
                        borderColor = TSUNAMI_BORDER_COLORS[area.warning_type];
                        
                        // 大津波警報は特に太く表示
                        borderWeight = area.warning_type === 'major_warning' ? 4.0 : 2.5;
                        borderOpacity = tsunamiBlinking ? 1.0 : 0.6;
                        
                        // 地域全体の塗りつぶし透明度（点滅効果）
                        fillOpacity = tsunamiBlinking ? 0.7 : 0.3;
                        break;
                      }
                    }
                    if (fillOpacity > 0) break;
                  }
                }
              }
              
              return {
                color: borderColor,
                weight: borderWeight,
                opacity: borderOpacity,
                fillColor: fillColor,
                fillOpacity: fillOpacity,
              };
            }}
          />
        )}

        {/* ネイティブLeafletマーカー */}
        {markersVisible && <CustomMarkers />}

        {/* 震源地自動拡大 */}
        <EpicenterZoom events={earthquakeEvents || []} />
      </MapContainer>

      {/* 沖縄ミニマップ */}
      <div
        style={{
          position: "absolute",
          top: "50px", // ヘッダーの下に移動
          left: "500px", // さらに右に移動
          width: "370px",
          height: "270px",
          border: "2px solid #fff",
          borderRadius: "5px",
          overflow: "hidden",
          zIndex: 1000,
          backgroundColor: "rgba(0,0,0,0.8)",
        }}
      >
        <MapContainer
          center={[10, 130.7]} // 沖縄県の中心
          zoom={5.5} // 本州と同じ縮尺に変更（8から6に）
          maxZoom={10}
          minZoom={2}
          maxBounds={[
            [23.5, 126], // 沖縄の南西
            [41, 127], // 沖縄の北東
          ]}
          maxBoundsViscosity={1.0}
          style={{ height: "100%", width: "100%" }}
          attributionControl={false}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          {/* 沖縄用の地図タイル */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution=""
          />

          {/* 沖縄の都道府県境界線（津波警報時は地域全体を色で塗りつぶし） */}
          {prefectureData && (
            <GeoJSON
              data={prefectureData}
              style={(feature) => {
                // 沖縄の津波警報時色表示設定
                let borderColor = '#ffffff';
                let borderWeight = 0.5;
                let borderOpacity = 0.8;
                let fillColor = 'transparent';
                let fillOpacity = 0;
                
                if (activeTsunamiWarnings.size > 0) {
                  const prefName = feature?.properties?.name_ja || feature?.properties?.nam_ja || '';
                  
                  // 沖縄は沿岸部なので津波警報に応じて地域全体を色で塗りつぶし表示
                  if (prefName.includes('沖縄')) {
                    for (const warning of activeTsunamiWarnings.values()) {
                      for (const area of warning.areas) {
                        if (area.prefecture === prefName || prefName.includes(area.prefecture.replace(/[都道府県]$/, ''))) {
                          // 津波警報レベルに応じた色設定
                          fillColor = TSUNAMI_COLORS[area.warning_type];
                          borderColor = TSUNAMI_BORDER_COLORS[area.warning_type];
                          
                          // 大津波警報は特に太く表示
                          borderWeight = area.warning_type === 'major_warning' ? 4.0 : 2.5;
                          borderOpacity = tsunamiBlinking ? 1.0 : 0.6;
                          
                          // 地域全体の塗りつぶし透明度（点滅効果）
                          fillOpacity = tsunamiBlinking ? 0.7 : 0.3;
                          break;
                        }
                      }
                      if (fillOpacity > 0) break;
                    }
                  }
                }
                
                return {
                  color: borderColor,
                  weight: borderWeight,
                  opacity: borderOpacity,
                  fillColor: fillColor,
                  fillOpacity: fillOpacity,
                };
              }}
            />
          )}

          {/* 沖縄用マーカー */}
          {markersVisible && <OkinawaMarkers />}
        </MapContainer>

        {/* 沖縄ラベル */}
        <div
          style={{
            position: "absolute",
            bottom: "2px",
            left: "5px",
            color: "white",
            fontSize: "10px",
            fontWeight: "bold",
            textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
            zIndex: 1001,
          }}
        >
          沖縄県
        </div>
      </div>

      {/* WebSocketステータス表示（テストモード時のみ） */}
      {isClient && testMode && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "5px 10px",
            borderRadius: "5px",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          WebSocket:{" "}
          <span
            style={{
              color:
                wsStatus === "open"
                  ? "#22c55e"
                  : wsStatus === "connecting"
                  ? "#eab308"
                  : wsStatus === "error"
                  ? "#dc2626"
                  : "#6b7280",
            }}
          >
            {wsStatus}
          </span>
          <br />
          地震データ: {earthquakeData.size}件
          <br />
          震度フィルタ:
          <select
            value={intensityThreshold}
            onChange={(e) => setIntensityThreshold(Number(e.target.value))}
            style={{
              marginLeft: "5px",
              padding: "1px 3px",
              fontSize: "11px",
              background: "#333",
              color: "white",
              border: "1px solid #555",
              borderRadius: "3px",
            }}
          >
            <option value={0}>震度0以上</option>
            <option value={1}>震度1以上</option>
            <option value={2}>震度2以上</option>
            <option value={3}>震度3以上</option>
            <option value={4}>震度4以上</option>
            <option value={5}>震度5弱以上</option>
            <option value={5.5}>震度5強以上</option>
            <option value={6}>震度6弱以上</option>
            <option value={6.5}>震度6強以上</option>
            <option value={7}>震度7のみ</option>
          </select>
          <br />
          <button
            onClick={addTestEarthquakeData}
            disabled={animatingEarthquake}
            style={{
              marginTop: "5px",
              padding: "2px 8px",
              fontSize: "11px",
              background: animatingEarthquake ? "#666" : "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: animatingEarthquake ? "not-allowed" : "pointer",
              display: "block",
              width: "100%",
              marginBottom: "3px"
            }}
          >
            {animatingEarthquake ? "アニメーション中..." : "北海道テストデータ"}
          </button>
          <button
            onClick={addTestTsunamiWarning}
            style={{
              padding: "2px 8px",
              fontSize: "11px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              display: "block",
              width: "100%",
            }}
          >
            津波テストデータ
          </button>
          {activeTsunamiWarnings.size > 0 && (
            <div style={{ marginTop: "5px", fontSize: "10px", color: "#fbbf24" }}>
              津波警報: {activeTsunamiWarnings.size}件
            </div>
          )}
        </div>
      )}

      {/* 震度スケール凡例 */}
      <IntensityScale />
      
      {/* 津波警報凡例 */}
      {activeTsunamiWarnings.size > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "11px",
            zIndex: 1000,
            minWidth: "150px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>津波警報</div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "2px" }}>
            <div style={{ width: "15px", height: "15px", backgroundColor: TSUNAMI_COLORS.major_warning, marginRight: "5px" }}></div>
            <span>大津波警報</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "2px" }}>
            <div style={{ width: "15px", height: "15px", backgroundColor: TSUNAMI_COLORS.warning, marginRight: "5px" }}></div>
            <span>津波警報</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "2px" }}>
            <div style={{ width: "15px", height: "15px", backgroundColor: TSUNAMI_COLORS.advisory, marginRight: "5px" }}></div>
            <span>津波注意報</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: "15px", height: "15px", backgroundColor: TSUNAMI_COLORS.forecast, marginRight: "5px" }}></div>
            <span>津波予報</span>
          </div>
        </div>
      )}

      {/* 現在時刻表示（震度スケールの隣） */}
      {isClient && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "140px", // 震度スケールの左隣
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "11px",
            zIndex: 1000,
            minWidth: "140px",
          }}
        >
          <CurrentTime
            connectionStatus={connectionStatus}
            serverTime={serverTime}
            lastMessageType={lastMessageType}
          />
        </div>
      )}
    </div>
  );
}
