"use client";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
} from "react-leaflet";
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
  intensity: number;
  arrivalTime: string;
}

export default function MapComponent() {
  const [prefectureData, setPrefectureData] =
    useState<FeatureCollection | null>(null);
  const [stationData, setStationData] = useState<EarthquakeStation[]>([]);
  const [earthquakeData, setEarthquakeData] = useState<Map<string, EarthquakeData>>(new Map());
  const [wsStatus, setWsStatus] = useState<'closed' | 'connecting' | 'open' | 'error'>('closed');
  const [oauth2Service] = useState(() => new Oauth2Service());
  const [isClient, setIsClient] = useState(false);

  // クライアントサイドであることを確認
  useEffect(() => {
    setIsClient(true);
  }, []);

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
      setWsStatus('connecting');
      try {
        // OAuth2認証を確認
        await oauth2Service.ensureInitialized();
        
        const isAuthenticated = await oauth2Service.refreshTokenCheck();
        if (!isAuthenticated) {
          console.log('No authentication available for WebSocket');
          setWsStatus('error');
          return;
        }
        
        // OAuth2インスタンスからアクセストークンを取得
        const oauth2Instance = oauth2Service.oauth2Instance;
        if (!oauth2Instance) {
          console.log('OAuth2 instance not available');
          setWsStatus('error');
          return;
        }
        
        // WebSocketチケットを取得（クライアントサイドで直接）
        console.log('Getting WebSocket ticket directly from client...');
        let ticket: string;
        try {
          // OAuth2インスタンスからアクセストークンを取得
          let accessToken: string;
          try {
            // @dmdata/oauth2-clientの正しいメソッドを使用
            const authorization = await oauth2Instance.getAuthorization();
            accessToken = authorization.replace('Bearer ', '');
            console.log('Access token obtained:', !!accessToken);
          } catch (tokenError) {
            console.error('Failed to get access token:', tokenError);
            throw new Error('Failed to get access token');
          }
          
          // 複数のエンドポイントを試す
          const possibleEndpoints = [
            'https://api.dmdata.jp/v2/socket',
            'https://api.dmdata.jp/v2/socket/start', 
            'https://api.dmdata.jp/v2/websocket',
            'https://api.dmdata.jp/v2/websocket/start'
          ];
          
          const requestBody = {
            classifications: ['telegram.earthquake'],
            appName: 'anpikakunin-app',
            formatMode: 'json'
          };
          
          let ticketResponse: Response | null = null;
          let successfulUrl = '';
          
          for (const apiUrl of possibleEndpoints) {
            console.log('Trying endpoint:', apiUrl);
            
            try {
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
              });
              
              console.log('Response status for', apiUrl, ':', response.status);
              
              if (response.ok) {
                ticketResponse = response;
                successfulUrl = apiUrl;
                break;
              } else if (response.status === 409) {
                // 409エラー（最大接続数）の場合は一時的にスキップ
                const errorText = await response.text();
                console.log('Connection limit reached for', apiUrl, ':', errorText);
                console.log('Waiting 2 seconds before trying next endpoint...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              } else if (response.status !== 404) {
                // 404以外のエラーは記録して続ける
                const errorText = await response.text();
                console.log('Non-404 error for', apiUrl, ':', errorText);
                ticketResponse = response;
                successfulUrl = apiUrl;
                break;
              }
            } catch (fetchError) {
              console.log('Fetch error for', apiUrl, ':', fetchError);
            }
          }
          
          if (!ticketResponse) {
            throw new Error('All DMDATA API endpoints failed');
          }
          
          console.log('Using endpoint:', successfulUrl);
          
          if (!ticketResponse.ok) {
            // Responseがすでに読まれている可能性があるのでチェック
            let errorText = 'Unknown error';
            try {
              if (!ticketResponse.bodyUsed) {
                errorText = await ticketResponse.text();
              } else {
                errorText = `HTTP ${ticketResponse.status} ${ticketResponse.statusText}`;
              }
            } catch (readError) {
              console.error('Failed to read error response:', readError);
              errorText = `HTTP ${ticketResponse.status} ${ticketResponse.statusText}`;
            }
            
            console.error('DMDATA API error:', ticketResponse.status, errorText);
            throw new Error(`DMDATA API error: ${ticketResponse.status} ${errorText}`);
          }
          
          const ticketData = await ticketResponse.json();
          console.log('WebSocket ticket response:', ticketData);
          
          if (!ticketData.ticket) {
            throw new Error('No ticket received from API');
          }
          
          ticket = ticketData.ticket;
          console.log('WebSocket ticket obtained successfully');
        } catch (error) {
          console.error('Failed to get WebSocket ticket:', error);
          setWsStatus('error');
          return;
        }
        
        // DMDATA WebSocketエンドポイント（チケット付き）
        const wsUrl = `wss://ws.api.dmdata.jp/v2/websocket?ticket=${ticket}`;
        console.log('Connecting to WebSocket with ticket...');
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected successfully with ticket authentication');
          setWsStatus('open');
          
          // チケット認証で接続済みのため、追加の認証メッセージは不要
          console.log('WebSocket is ready to receive earthquake data');
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:');
            console.log('Message type:', data.type);
            console.log('Full message:', data);
            
            // DMDATAのWebSocketメッセージ形式に対応
            if (data.type === 'data' && data.body) {
              const body = data.body;
              
              // 地震情報の処理
              if (body.earthquake && body.earthquake.intensity) {
                const newEarthquakeData = new Map(earthquakeData);
                
                // 震度情報を処理
                if (body.earthquake.intensity.observation) {
                  body.earthquake.intensity.observation.forEach((obs: any) => {
                    if (obs.areas) {
                      obs.areas.forEach((area: any) => {
                        if (area.stations) {
                          area.stations.forEach((station: any) => {
                            newEarthquakeData.set(station.code, {
                              code: station.code,
                              intensity: station.intensity || obs.maxInt || 0,
                              arrivalTime: body.eventTime || new Date().toISOString()
                            });
                          });
                        }
                      });
                    }
                  });
                }
                
                setEarthquakeData(newEarthquakeData);
              }
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error occurred:');
          console.error('Error details:', error);
          console.error('WebSocket readyState:', ws?.readyState);
          console.error('WebSocket URL:', ws?.url);
          setWsStatus('error');
        };
        
        ws.onclose = (event) => {
          console.log('WebSocket disconnected');
          console.log('Close code:', event.code);
          console.log('Close reason:', event.reason);
          console.log('Was clean close:', event.wasClean);
          
          // 一般的なWebSocketクローズコードの意味
          const closeCodeMeanings: Record<number, string> = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data type',
            1006: 'Abnormal closure',
            1007: 'Invalid data',
            1008: 'Policy violation',
            1009: 'Message too large',
            1011: 'Server error',
            1012: 'Service restart',
            1013: 'Try again later',
            1014: 'Bad gateway',
            1015: 'TLS handshake failure'
          };
          
          console.log('Close meaning:', closeCodeMeanings[event.code] || 'Unknown');
          setWsStatus('closed');
          
          // 409エラー（接続制限）の場合は長めの待機時間
          // その他のエラーは短い待機時間で再接続
          if (event.code !== 1008 && event.code !== 1007 && event.code !== 1002) {
            const waitTime = event.code === 1005 ? 10000 : 5000; // 1005は10秒待機
            console.log(`Scheduling reconnection in ${waitTime/1000} seconds...`);
            setTimeout(connectWebSocket, waitTime);
          } else {
            console.log('Not reconnecting due to authentication/policy error');
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        setWsStatus('error');
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

        {/* 地震観測点マーカー */}
        {stationData.map((station) => {
          const lat = parseFloat(station.lat);
          const lng = parseFloat(station.lon);

          if (isNaN(lat) || isNaN(lng)) return null;

          // リアルタイム地震データを取得
          const earthquakeInfo = earthquakeData.get(station.code);
          
          // 震度によって色を変更
          const getMarkerColor = (intensity?: number) => {
            if (!intensity) return '#0d33ff'; // デフォルト青
            if (intensity >= 7) return '#dc2626'; // 震度7以上: 赤
            if (intensity >= 6) return '#ea580c'; // 震度6: オレンジ
            if (intensity >= 5) return '#eab308'; // 震度5: 黄
            if (intensity >= 4) return '#22c55e'; // 震度4: 緑
            return '#0d33ff'; // 震度3以下: 青
          };

          return (
            <CircleMarker
              key={station.code}
              center={[lat, lng]}
              radius={earthquakeInfo ? 5 : 2}
              fillColor={getMarkerColor(earthquakeInfo?.intensity)}
              color="#ffffff"
              weight={0}
              opacity={0.8}
              fillOpacity={0.8}
            >
              <Popup>
                <div>
                  <strong>{station.name}</strong>
                  <br />
                  コード: {station.code}
                  <br />
                  座標: {lat.toFixed(4)}, {lng.toFixed(4)}
                  <br />
                  {earthquakeInfo && (
                    <>
                      <strong>震度: {earthquakeInfo.intensity}</strong><br />
                      到達時刻: {new Date(earthquakeInfo.arrivalTime).toLocaleString()}
                    </>
                  )}
                  {!earthquakeInfo && <span>震度データなし</span>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      
      {/* WebSocketステータス表示（クライアントサイドのみ） */}
      {isClient && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          WebSocket: <span style={{
            color: wsStatus === 'open' ? '#22c55e' : 
                  wsStatus === 'connecting' ? '#eab308' : 
                  wsStatus === 'error' ? '#dc2626' : '#6b7280'
          }}>{wsStatus}</span><br />
          地震データ: {earthquakeData.size}件
        </div>
      )}
    </div>
  );
}