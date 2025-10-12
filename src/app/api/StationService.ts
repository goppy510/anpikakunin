import axios from "axios";
// Removed RxJS imports: Subject, of, concatMap, operators

import type { ApiService } from "@/app/api/ApiService";
// Assuming ApiService.parameterEarthquakeStation() now returns Promise<ParameterEarthquakeStationData>
import { ApiParametersEarthQuakeArea } from "@/app/api/types/type";

const endpoint = {
  area: "/assets/earthquake/area.json", // Consider making this configurable
};

export class StationService {
  /**
   * A flag indicating whether both station and area data have been successfully loaded.
   * Becomes true only after the initializationPromise resolves successfully.
   */
  public isInitialized: boolean = false;

  /**
   * A Promise that resolves when both earthquake station and area data loading attempts are complete.
   * Resolves successfully only if BOTH loads succeed. Rejects if EITHER load fails.
   */
  private initializationPromise: Promise<void>;

  private earthquakeStations = new Map<string, [number, number]>();
  private earthquakeAreas = new Map<string, [number, number]>();

  // Flags to track individual load success (mainly for internal logic/debugging)
  private stationsLoaded: boolean = false;
  private areasLoaded: boolean = false;

  constructor(private api: ApiService) {
    // Removed RxJS loading$.subscribe()

    // Start loading both lists immediately and get their promises
    const stationPromise = this.requestEarthquakeStationList();
    const areaPromise = this.requestEarthquakeAreasList();

    // Create a promise that tracks the completion of both loading tasks
    this.initializationPromise = Promise.all([stationPromise, areaPromise])
      .then(() => {
        // This block executes only if BOTH promises resolve successfully
        this.isInitialized = true;
          "StationService initialized successfully (stations and areas loaded)."
        );
        // No return value needed, resolves with void
      })
      .catch((error) => {
        // This block executes if EITHER promise rejects
        this.isInitialized = false; // Ensure status is false on failure
        // Optional: Depending on application needs, you might want to allow partial loading
        // or provide more granular error state.
        // Re-throw the error so callers awaiting initializationPromise are notified of failure.
        throw error;
      });
  }

  /**
   * Returns a Promise that resolves when the service is fully initialized (both datasets loaded),
   * or rejects if initialization failed.
   */
  public async waitUntilReady(): Promise<void> {
    // Simply await the master initialization promise
    await this.initializationPromise;
  }

  /**
   * Synchronously checks if the service has successfully initialized.
   * Best used after awaiting `waitUntilReady` or if you know enough time has passed.
   * @returns boolean True if both datasets are loaded successfully, false otherwise.
   */
  public getIsReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Gets the coordinates for a given earthquake station code.
   * @param code The station code.
   * @returns Coordinates [latitude, longitude] or null if not found or not loaded yet.
   */
  public getEarthquakeStation(code: string): [number, number] | null {
    // Check this.isInitialized or this.stationsLoaded if you want to be strict
    // about returning null before loading is complete. For now, it just checks the map.
    return this.earthquakeStations.get(code) ?? null;
  }

  /**
   * Gets the coordinates for a given earthquake area code.
   * @param code The area code.
   * @returns Coordinates [latitude, longitude] or null if not found or not loaded yet.
   */
  public getEarthquakeArea(code: string): [number, number] | null {
    // Check this.isInitialized or this.areasLoaded if strictness needed.
    return this.earthquakeAreas.get(code) ?? null;
  }

  /**
   * Fetches and processes the earthquake station list from the API.
   * Marked as private as it's primarily for internal initialization.
   * @returns Promise<void> Resolves on success, rejects on failure.
   */
  private async requestEarthquakeStationList(): Promise<void> {
    try {
      // Assumes api.parameterEarthquakeStation() is async and returns Promise<ParameterEarthquakeStationData>
      // ParameterEarthquakeStationData should have an 'items' property according to the original code.
      const res = await this.api.parameterEarthquakeStation();

      // Ensure the response matches the expected structure
      if (!("items" in res) || !Array.isArray(res.items)) {
        throw new Error(
          "Invalid response structure received for earthquake stations."
        );
      }
      const items = res.items.map((item) => ({
        code: item.code,
        latitude: +item.latitude, // Convert latitude to number
        longitude: +item.longitude, // Convert longitude to number
      }));

      // Basic validation of the response structure
      if (!res || !Array.isArray(res.items)) {
        throw new Error(
          "Invalid response structure received for earthquake stations."
        );
      }

      const map = new Map<string, [number, number]>();
      res.items.forEach(
        (r: {
          code: string;
          latitude: string | number | null;
          longitude: string | number | null;
        }) => {
          // Add validation for r.code, r.latitude, r.longitude if necessary
          if (r.code && r.latitude != null && r.longitude != null) {
            map.set(r.code, [+r.latitude, +r.longitude]);
          } else {
          }
        }
      );

      this.earthquakeStations = map;
      this.stationsLoaded = true; // Mark this part as successfully loaded
    } catch (err) {
      this.stationsLoaded = false; // Ensure flag is false on error
      // Re-throw the error so that Promise.all in the constructor catches it
      throw err;
    }
  }

  /**
   * Fetches and processes the earthquake area list from a static JSON file.
   * Marked as private as it's primarily for internal initialization.
   * @returns Promise<void> Resolves on success, rejects on failure.
   */
  private async requestEarthquakeAreasList(): Promise<void> {
    try {
      const res = await axios.get<ApiParametersEarthQuakeArea>(endpoint.area);

      // Basic validation of the response structure
      if (!res || !Array.isArray(res.data)) {
        throw new Error(
          "Invalid response structure received for earthquake areas."
        );
      }

      const map = new Map<string, [number, number]>();
      res.data.forEach((r) => {
        // Add validation for r.code, r.latitude, r.longitude if necessary
        if (r.code && r.latitude != null && r.longitude != null) {
          map.set(r.code, [+r.latitude, +r.longitude]);
        } else {
        }
      });

      this.earthquakeAreas = map;
      this.areasLoaded = true; // Mark this part as successfully loaded
    } catch (err) {
      this.areasLoaded = false; // Ensure flag is false on error
      // Re-throw the error so that Promise.all in the constructor catches it
      throw err;
    }
  }
}
