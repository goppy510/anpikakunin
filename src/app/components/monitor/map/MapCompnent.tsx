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

interface MapComponentProps {
  onEarthquakeUpdate?: (event: {
    eventId: string;
    arrivalTime: string;
    maxInt?: string;
    magnitude?: { value?: number };
    hypocenter?: { name?: string };
  }) => void;
}

export default function MapComponent({
  onEarthquakeUpdate,
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

        // 地震データがある場合のみマーカーを作成
        if (earthquakeInfo) {
          // 震度0-7のグラデーション色スキーム（青→赤）
          const getMarkerColor = (intensity: number | string) => {
            // 数値または文字列での震度を正規化
            let normalizedIntensity: number;
            
            if (typeof intensity === 'string') {
              // 文字列の場合は震度表記を数値に変換
              if (intensity === '5弱' || intensity === '5-') normalizedIntensity = 5.0;
              else if (intensity === '5強' || intensity === '5+') normalizedIntensity = 5.5;
              else if (intensity === '6弱' || intensity === '6-') normalizedIntensity = 6.0;
              else if (intensity === '6強' || intensity === '6+') normalizedIntensity = 6.5;
              else normalizedIntensity = parseFloat(intensity) || 0;
            } else {
              normalizedIntensity = intensity;
            }
            
            // 震度を0-7の範囲にクランプ
            const clampedIntensity = Math.max(0, Math.min(7, normalizedIntensity));
            
            if (clampedIntensity === 0) return "#0066ff"; // 震度0: 真っ青
            if (clampedIntensity === 1) return "#0080ff"; // 震度1: 青
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
    }, [map, stationData, earthquakeData, markersVisible, forceRender]);

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
  const simulateIntensityProgression = (stationCode: string, finalIntensity: number | string, distance: number, baseDelay: number) => {
    // 距離に基づく遅延計算
    const arrivalDelay = baseDelay + (distance * 100); // 距離1kmあたり100ms
    
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
        setEarthquakeData((prevData) => {
          const newData = new Map(prevData);
          newData.set(stationCode, {
            code: stationCode,
            intensity: intensity,
            arrivalTime: new Date().toISOString()
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

    console.log('地震波伝播アニメーション開始（段階的震度変化）:');
    console.log('総観測点数:', stationData.length);
    console.log('マッチした観測点数:', stationsWithDistance.length);
    
    if (stationsWithDistance.length === 0) {
      console.log('観測点が見つかりません。利用可能な観測点コードを確認中...');
      // 利用可能な観測点コードの最初の10個を表示
      stationData.slice(0, 10).forEach(station => {
        console.log(`利用可能: ${station.code} - ${station.name}`);
      });
      setAnimatingEarthquake(false);
      return;
    }
    
    // 各観測点で段階的震度変化をシミュレート
    stationsWithDistance.forEach((item) => {
      console.log(`${item.station.name}: 距離${item.distance.toFixed(1)}km, 最終震度${item.earthquakeData.intensity}`);
      simulateIntensityProgression(
        item.station.code, 
        item.earthquakeData.intensity, 
        item.distance, 
        500 // 基本遅延500ms
      );
    });
    
    // アニメーション終了タイマー（最も遠い観測点の完了を待つ）
    const maxDistance = Math.max(...stationsWithDistance.map(item => item.distance));
    const maxIntensity = Math.max(...stationsWithDistance.map(item => item.earthquakeData.intensity));
    const totalDuration = 500 + (maxDistance * 100) + (maxIntensity * 400) + 1000;
    
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

    sampleStations.forEach(({code, intensity}) => {
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
        ...Array.from(newTestData.values()).map((d) => d.intensity)
      );
      onEarthquakeUpdate({
        eventId: `manual-test-${Date.now()}`,
        arrivalTime: new Date().toISOString(),
        maxInt: maxIntensity.toString(),
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
  useEffect(() => {
    // クライアントサイドでのみ実行
    if (!isClient) return;

    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      setWsStatus("connecting");
      try {
        // OAuth2認証を確認
        await oauth2Service.ensureInitialized();

        const isAuthenticated = await oauth2Service.refreshTokenCheck();
        if (!isAuthenticated) {
          console.log("No authentication available for WebSocket");
          setWsStatus("error");
          return;
        }

        // OAuth2インスタンスからアクセストークンを取得
        const oauth2Instance = oauth2Service.oauth2Instance;
        if (!oauth2Instance) {
          console.log("OAuth2 instance not available");
          setWsStatus("error");
          return;
        }

        // WebSocketチケットを取得（クライアントサイドで直接）
        console.log("Getting WebSocket ticket directly from client...");
        let ticket: string;
        try {
          // OAuth2インスタンスからアクセストークンを取得
          let accessToken: string;
          try {
            // @dmdata/oauth2-clientの正しいメソッドを使用
            const authorization = await oauth2Instance.getAuthorization();
            accessToken = authorization.replace("Bearer ", "");
            console.log("Access token obtained:", !!accessToken);
          } catch (tokenError) {
            console.error("Failed to get access token:", tokenError);
            throw new Error("Failed to get access token");
          }

          // 複数のエンドポイントを試す
          const possibleEndpoints = [
            "https://api.dmdata.jp/v2/socket",
            "https://api.dmdata.jp/v2/socket/start",
            "https://api.dmdata.jp/v2/websocket",
            "https://api.dmdata.jp/v2/websocket/start",
          ];

          const requestBody = {
            classifications: ["telegram.earthquake"],
            appName: "anpikakunin-app",
            formatMode: "json",
          };

          let ticketResponse: Response | null = null;
          let successfulUrl = "";

          for (const apiUrl of possibleEndpoints) {
            console.log("Trying endpoint:", apiUrl);

            try {
              const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
              });

              console.log("Response status for", apiUrl, ":", response.status);

              if (response.ok) {
                ticketResponse = response;
                successfulUrl = apiUrl;
                break;
              } else if (response.status === 409) {
                // 409エラー（最大接続数）の場合は一時的にスキップ
                const errorText = await response.text();
                console.log(
                  "Connection limit reached for",
                  apiUrl,
                  ":",
                  errorText
                );
                console.log("Waiting 2 seconds before trying next endpoint...");
                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
              } else if (response.status !== 404) {
                // 404以外のエラーは記録して続ける
                const errorText = await response.text();
                console.log("Non-404 error for", apiUrl, ":", errorText);
                ticketResponse = response;
                successfulUrl = apiUrl;
                break;
              }
            } catch (fetchError) {
              console.log("Fetch error for", apiUrl, ":", fetchError);
            }
          }

          if (!ticketResponse) {
            throw new Error("All DMDATA API endpoints failed");
          }

          console.log("Using endpoint:", successfulUrl);

          if (!ticketResponse.ok) {
            // Responseがすでに読まれている可能性があるのでチェック
            let errorText = "Unknown error";
            try {
              if (!ticketResponse.bodyUsed) {
                errorText = await ticketResponse.text();
              } else {
                errorText = `HTTP ${ticketResponse.status} ${ticketResponse.statusText}`;
              }
            } catch (readError) {
              console.error("Failed to read error response:", readError);
              errorText = `HTTP ${ticketResponse.status} ${ticketResponse.statusText}`;
            }

            console.error(
              "DMDATA API error:",
              ticketResponse.status,
              errorText
            );
            throw new Error(
              `DMDATA API error: ${ticketResponse.status} ${errorText}`
            );
          }

          const ticketData = await ticketResponse.json();
          console.log("WebSocket ticket response:", ticketData);

          if (!ticketData.ticket) {
            throw new Error("No ticket received from API");
          }

          ticket = ticketData.ticket;
          console.log("WebSocket ticket obtained successfully");
        } catch (error) {
          console.error("Failed to get WebSocket ticket:", error);
          setWsStatus("error");
          return;
        }

        // DMDATA WebSocketエンドポイント（チケット付き）
        const wsUrl = `wss://ws.api.dmdata.jp/v2/websocket?ticket=${ticket}`;
        console.log("Connecting to WebSocket with ticket...");
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log(
            "WebSocket connected successfully with ticket authentication"
          );
          setWsStatus("open");

          // チケット認証で接続済みのため、追加の認証メッセージは不要
          console.log("WebSocket is ready to receive earthquake data");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // すべてのメッセージタイプをログ出力
            if (data.type === "ping") {
              return;
            }

            if (data.type === "start") {
              // 動作確認用のテストデータを追加（5秒後）
              setTimeout(() => {
                // サンプル観測点にテストデータを追加
                const sampleStations = ["0110100", "0121700", "0122400"]; // 札幌、江別、千歳
                const newTestData = new Map<string, EarthquakeData>();

                sampleStations.forEach((stationCode, index) => {
                  const testData = {
                    code: stationCode,
                    intensity: 3 + index, // 震度3、4、5
                    arrivalTime: new Date().toISOString(),
                  };
                  newTestData.set(stationCode, testData);
                });

                setEarthquakeData(newTestData);

                // マーカーを一度非表示にしてから再表示
                setForceRender((prev) => prev + 1);

                // 親コンポーネントに地震イベントを通知
                if (onEarthquakeUpdate) {
                  const maxIntensity = Math.max(
                    ...Array.from(newTestData.values()).map((d) => d.intensity)
                  );
                  onEarthquakeUpdate({
                    eventId: `test-${Date.now()}`,
                    arrivalTime: new Date().toISOString(),
                    maxInt: maxIntensity.toString(),
                    magnitude: { value: 4.5 },
                    hypocenter: { name: "テスト震源" },
                  });
                }
              }, 5000);

              return;
            }

            if (data.type === "error") {
              console.error("WebSocket error message:", data);
              return;
            }

            // DMDATAのWebSocketメッセージ形式に対応
            if (data.type === "data") {
              console.log("Data message received!");
              console.log("Data content:", data);

              // 様々なデータ形式を確認
              const body = data.body || data;

              console.log("Processing body:", body);

              // 地震情報の処理 - 様々なパスを試す
              let foundEarthquakeData = false;

              // パターン1: body.earthquake.intensityがある場合
              if (
                body.earthquake &&
                body.earthquake.intensity &&
                body.earthquake.intensity.observation
              ) {
                console.log("Found earthquake intensity data (pattern 1)");
                foundEarthquakeData = true;
                const newEarthquakeData = new Map(earthquakeData);

                body.earthquake.intensity.observation.forEach((obs: any) => {
                  console.log("Processing observation:", obs);
                  if (obs.areas) {
                    obs.areas.forEach((area: any) => {
                      if (area.stations) {
                        area.stations.forEach((station: any) => {
                          console.log("Adding station data:", station);
                          newEarthquakeData.set(station.code, {
                            code: station.code,
                            intensity: station.intensity || obs.maxInt || 0,
                            arrivalTime:
                              body.eventTime || new Date().toISOString(),
                          });
                        });
                      }
                    });
                  }
                });

                setEarthquakeData(newEarthquakeData);
                console.log("Updated earthquake data:", newEarthquakeData);
              }

              // パターン2: 直接震度データがある場合
              if (!foundEarthquakeData && (body.intensity || body.stations)) {
                console.log("Found earthquake intensity data (pattern 2)");
                foundEarthquakeData = true;
                // 単純な震度データの処理を追加
              }

              if (!foundEarthquakeData) {
                console.log(
                  "No earthquake intensity data found in this message"
                );
                console.log("Available properties:", Object.keys(body));
              }
            }

            // その他のメッセージタイプ
            if (
              data.type !== "ping" &&
              data.type !== "start" &&
              data.type !== "error" &&
              data.type !== "data"
            ) {
              console.log("Unknown message type:", data.type);
              console.log("Full unknown message:", data);
            }
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error occurred:");
          console.error("Error details:", error);
          console.error("WebSocket readyState:", ws?.readyState);
          console.error("WebSocket URL:", ws?.url);
          setWsStatus("error");
        };

        ws.onclose = (event) => {
          console.log("WebSocket disconnected");
          console.log("Close code:", event.code);
          console.log("Close reason:", event.reason);
          console.log("Was clean close:", event.wasClean);

          // 一般的なWebSocketクローズコードの意味
          const closeCodeMeanings: Record<number, string> = {
            1000: "Normal closure",
            1001: "Going away",
            1002: "Protocol error",
            1003: "Unsupported data type",
            1006: "Abnormal closure",
            1007: "Invalid data",
            1008: "Policy violation",
            1009: "Message too large",
            1011: "Server error",
            1012: "Service restart",
            1013: "Try again later",
            1014: "Bad gateway",
            1015: "TLS handshake failure",
          };

          console.log(
            "Close meaning:",
            closeCodeMeanings[event.code] || "Unknown"
          );
          setWsStatus("closed");

          // 409エラー（接続制限）の場合は長めの待機時間
          // その他のエラーは短い待機時間で再接続
          if (
            event.code !== 1008 &&
            event.code !== 1007 &&
            event.code !== 1002
          ) {
            const waitTime = event.code === 1005 ? 10000 : 5000; // 1005は10秒待機
            console.log(
              `Scheduling reconnection in ${waitTime / 1000} seconds...`
            );
            setTimeout(connectWebSocket, waitTime);
          } else {
            console.log("Not reconnecting due to authentication/policy error");
          }
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setWsStatus("error");
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [isClient]);

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
              weight: 1.5,
              opacity: 0.9,
              fillOpacity: 0,
            }}
          />
        )}

        {/* ネイティブLeafletマーカー */}
        {markersVisible && <CustomMarkers />}
      </MapContainer>

      {/* WebSocketステータス表示（クライアントサイドのみ） */}
      {isClient && (
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
      {isClient && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "10px",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "11px",
            zIndex: 1000,
            minWidth: "120px"
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "5px", textAlign: "center" }}>震度スケール</div>
          {[
            { intensity: 7, color: "#ff0000", label: "震度7" },
            { intensity: 6.5, color: "#ff6600", label: "震度6強" },
            { intensity: 6, color: "#ff9900", label: "震度6弱" },
            { intensity: 5.5, color: "#ffcc00", label: "震度5強" },
            { intensity: 5, color: "#ffff00", label: "震度5弱" },
            { intensity: 4, color: "#66ff33", label: "震度4" },
            { intensity: 3, color: "#00ff99", label: "震度3" },
            { intensity: 2, color: "#00ccff", label: "震度2" },
            { intensity: 1, color: "#0080ff", label: "震度1" },
            { intensity: 0, color: "#0066ff", label: "震度0" },
          ].map(({ intensity, color, label }) => (
            <div
              key={intensity}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "2px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: color,
                  borderRadius: "50%",
                  marginRight: "8px",
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
