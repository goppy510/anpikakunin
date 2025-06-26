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
import { useEffect, useState } from "react";
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
}

export default function MapComponent({
  onEarthquakeUpdate,
  runSimulation = false,
  onSimulationComplete,
  testMode = false,
  earthquakeEvents = [],
  connectionStatus = "closed",
  serverTime = "",
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
      ...stationsWithDistance.map((item) => item.earthquakeData.intensity)
    );
    const totalDuration = 500 + maxDistance * 100 + maxIntensity * 400 + 1000;

    setTimeout(() => {
      setAnimatingEarthquake(false);
    }, totalDuration);
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

  // 日本の境界（北海道を含むように調整）
  const japanBounds: [[number, number], [number, number]] = [
    [33, 125], // 南西
    [45, 180], // 北東（北海道を含む）
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

  return (
    <div className={styles.map}>
      <MapContainer
        center={[38, 120]} // 北海道が見えるように南寄りに調整
        zoom={6}
        maxZoom={10}
        minZoom={2}
        maxBounds={japanBounds}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
        attributionControl={true}
      >
        {/* 濃いグレーの地図 */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />

        {/* 都道府県境界線（白色） */}
        {prefectureData && (
          <GeoJSON
            data={prefectureData}
            style={{
              color: "#ffffff",
              weight: 0.3,
              opacity: 0.7,
              fillOpacity: 0,
            }}
          />
        )}

        {/* ネイティブLeafletマーカー */}
        {markersVisible && <CustomMarkers />}
      </MapContainer>

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
            }}
          >
            {animatingEarthquake ? "アニメーション中..." : "北海道テストデータ"}
          </button>
        </div>
      )}

      {/* 震度スケール凡例 */}
      <IntensityScale />

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
          />
        </div>
      )}
    </div>
  );
}
