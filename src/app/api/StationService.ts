import { apiService } from "@/app/api/ApiService";

const endpoint = {
  area: "/assets/earthquake/area.json",
};

export type EarthquakeArea = {
  name: string;
  code: string;
  latitude: string;
  longitude: string;
};

class StationService {
  private earthquakeStations = new Map<string, [number, number]>();
  private earthquakeAreas = new Map<string, [number, number]>();
  private loadingFlags = { stations: false, areas: false };

  async init() {
    await Promise.all([
      this.requestEarthquakeStationList(),
      this.requestEarthquakeAreasList(),
    ]);
  }

  isLoaded(): boolean {
    return this.loadingFlags.stations && this.loadingFlags.areas;
  }

  getEarthquakeStation(code: string): [number, number] | null {
    return this.earthquakeStations.get(code) ?? null;
  }

  getEarthquakeArea(code: string): [number, number] | null {
    return this.earthquakeAreas.get(code) ?? null;
  }

  private async requestEarthquakeStationList(): Promise<void> {
    try {
      const res = await apiService.parameterEarthquakeStation();
      const map = new Map<string, [number, number]>();

      res.items.forEach(
        (r: { code: string; latitude: string; longitude: string }) => {
          map.set(r.code, [parseFloat(r.latitude), parseFloat(r.longitude)]);
        }
      );

      this.earthquakeStations = map;
      this.loadingFlags.stations = true;
    } catch (err) {
      console.error("Failed to load earthquake stations:", err);
    }
  }

  private async requestEarthquakeAreasList(): Promise<void> {
    try {
      const res = await fetch(endpoint.area);
      const json: EarthquakeArea[] = await res.json();
      const map = new Map<string, [number, number]>();

      json.forEach((r) => {
        map.set(r.code, [parseFloat(r.latitude), parseFloat(r.longitude)]);
      });

      this.earthquakeAreas = map;
      this.loadingFlags.areas = true;
    } catch (err) {
      console.error("Failed to load earthquake areas:", err);
    }
  }
}

export const stationService = new StationService();
