import L from "leaflet";
import { Map } from 'react-leaflet';

// React Leaflet用に更新されたマップサービス
let mapRef: L.Map | null = null;
const groups = new Map<string, L.LayerGroup>();

// React Leafletのマップインスタンスを登録
export function setMapInstance(map: L.Map) {
  mapRef = map;
  
  // 既存のグループを追加
  for (const group of groups.values()) {
    group.addTo(map);
  }
}

export function getMapInstance(): L.Map | null {
  return mapRef;
}

export function addLayer(layer: L.Layer, name = "default") {
  if (!mapRef) return;

  if (!groups.has(name)) {
    const group = new L.LayerGroup();
    groups.set(name, group);
    mapRef.addLayer(group);
  }

  groups.get(name)?.addLayer(layer);
}

export function clearLayers(name = "default") {
  groups.get(name)?.clearLayers();
}

export function fitBounds(bounds: L.LatLngBoundsExpression) {
  mapRef?.fitBounds(bounds, { animate: false });
}

export function setZoom(zoom: number) {
  mapRef?.setZoom(zoom, { animate: false });
}

// クリーンアップ
export function cleanup() {
  mapRef = null;
  groups.clear();
}
