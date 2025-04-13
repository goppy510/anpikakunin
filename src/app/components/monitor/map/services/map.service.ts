import L from "leaflet";
import "leaflet.vectorgrid";

let map: L.Map | undefined;
const groups = new Map<string, L.LayerGroup>();

export function initMap() {
  if (map) return;

  map = L.map("map", {
    center: [35, 135],
    zoom: 5,
    maxZoom: 9,
    minZoom: 2,
    renderer: L.canvas(),
    zoomControl: false,
  });

  for (const group of groups.values()) {
    group.addTo(map);
  }

  const gridPref = L.vectorGrid.protobuf(
    "https://soshi1822.jp/map/tile/prefectures/{z}/{x}/{y}.pbf",
    {
      maxNativeZoom: 12,
      minNativeZoom: 2,
      rendererFactory: L.canvas.tile,
      vectorTileLayerStyles: {
        prefectures: {
          weight: 2,
          fill: true,
          fillOpacity: 1,
          fillColor: "#eaeaea",
          color: "#696969",
        },
      },
    }
  );

  const gridWorld = L.vectorGrid.protobuf(
    "https://soshi1822.jp/map/tile/world/{z}/{x}/{y}.pbf",
    {
      zIndex: 4,
      maxNativeZoom: 10,
      minNativeZoom: 2,
      rendererFactory: L.canvas.tile,
      vectorTileLayerStyles: {
        world: {
          weight: 2,
          color: "#696969",
          fillColor: "#ece8e8",
          fillOpacity: 1,
          fill: true,
          bubblingMouseEvents: false,
        },
      },
    }
  );

  map.addLayer(gridPref);
  map.addLayer(gridWorld);
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
