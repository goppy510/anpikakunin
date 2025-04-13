import { useEffect, useState } from "react";
import { LatLngTuple } from "leaflet";
import { apiService } from "@/app/api/ApiService";

export function useStation() {
  const [stations, setStations] = useState<Map<string, LatLngTuple>>(new Map());
  const [areas, setAreas] = useState<Map<string, LatLngTuple>>(new Map());

  useEffect(() => {
    apiService.parameterEarthquakeStation().then((res) => {
      const map = new Map<string, LatLngTuple>();
      res.items.forEach(
        (r: {
          code: string;
          latitude: string | number;
          longitude: string | number;
        }) => map.set(r.code, [+r.latitude, +r.longitude])
      );
      setStations(map);
    });

    fetch("/earthquake/area.json")
      .then((res) => res.json())
      .then((json) => {
        const map = new Map<string, LatLngTuple>();
        json.forEach(
          (r: { code: string; latitude: string; longitude: string }) => {
            map.set(r.code, [+r.latitude, +r.longitude]);
          }
        );
        setAreas(map);
      });
  }, []);

  return {
    getEarthquakeStation(code: string): LatLngTuple | null {
      return stations.get(code) ?? null;
    },
    getEarthquakeArea(code: string): LatLngTuple | null {
      return areas.get(code) ?? null;
    },
  };
}
