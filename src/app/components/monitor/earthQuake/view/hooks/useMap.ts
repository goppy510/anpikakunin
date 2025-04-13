import { useEffect, useRef } from "react";
import { Map as LeafletMap, Layer } from "leaflet";

export function useMap() {
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<Record<string, Layer[]>>({});

  useEffect(() => {
    return () => {
      const layers = { ...layersRef.current };
      Object.values(layers)
        .flat()
        .forEach((l) => {
          if (mapRef.current?.hasLayer(l)) {
            mapRef.current.removeLayer(l);
          }
        });
    };
  }, []);

  return {
    setMap(map: LeafletMap) {
      mapRef.current = map;
    },
    getMap(): LeafletMap | null {
      return mapRef.current;
    },
    addLayer(layer: Layer, type: string) {
      const map = mapRef.current;
      if (!map) return;

      if (!layersRef.current[type]) {
        layersRef.current[type] = [];
      }
      layersRef.current[type].push(layer);
      layer.addTo(map);
    },
    clearLayers(type: string) {
      const map = mapRef.current;
      if (!map) return;

      const layers = layersRef.current[type] ?? [];
      layers.forEach((l) => {
        if (map.hasLayer(l)) {
          map.removeLayer(l);
        }
      });
      layersRef.current[type] = [];
    },
    fitBounds(
      bounds: Parameters<LeafletMap["fitBounds"]>[0],
      options?: Parameters<LeafletMap["fitBounds"]>[1]
    ) {
      mapRef.current?.fitBounds(bounds, options);
    },
    setZoom(zoom: number) {
      mapRef.current?.setZoom(zoom);
    },
  };
}
