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

interface EarthquakeStation {
  name: string;
  code: string;
  lat: string;
  lon: string;
}

export default function MapComponent() {
  const [prefectureData, setPrefectureData] =
    useState<FeatureCollection | null>(null);
  const [stationData, setStationData] = useState<EarthquakeStation[]>([]);

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

          return (
            <CircleMarker
              key={station.code}
              center={[lat, lng]}
              radius={2}
              fillColor="#0d33ff"
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
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
