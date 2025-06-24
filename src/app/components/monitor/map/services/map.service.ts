import L from "leaflet";
import "leaflet.vectorgrid";

let map: L.Map | undefined;
const groups = new Map<string, L.LayerGroup>();

export function initMap() {
  if (map) return;

  // 本家の設定に合わせる
  map = L.map("map", {
    center: [35, 135], // 本家と同じ中心点
    zoom: 5, // 本家と同じズーム
    maxZoom: 9, // 本家と同じ最大ズーム
    minZoom: 2, // 本家と同じ最小ズーム
    renderer: L.canvas(), // 本家と同じレンダラー
  });

  for (const group of groups.values()) {
    group.addTo(map);
  }

  // 本家のベクタータイルを使用（CORS問題が解決されるまで一時的にOSMを使用）
  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  });

  map.addLayer(tileLayer);

  console.log("Map initialized");
}

export function destroyMap() {
  map?.remove();
  map = undefined;
  groups.clear();
}

export function addLayer(layer: L.Layer, name = "default") {
  if (!map) return;

  if (!groups.has(name)) {
    const group = new L.LayerGroup();
    groups.set(name, group);
    map.addLayer(group);
  }

  groups.get(name)?.addLayer(layer);
}

export function clearLayers(name = "default") {
  groups.get(name)?.clearLayers();
}

export function fitBounds(bounds: L.LatLngBoundsExpression) {
  map?.fitBounds(bounds, { animate: false });
}

export function setZoom(zoom: number) {
  map?.setZoom(zoom, { animate: false });
}
