import { LatLngBounds } from "leaflet";
import { Components } from "@dmdata/api-types";
import type { EarthquakeInformation } from "@dmdata/telegram-json-types";

export type EarthquakeEvent = Omit<Components.Earthquake.Event, "id">;

export type EventObjectExtend = EarthquakeEvent & {
  dateTime: string;
  author: string;
  comment: {
    forecast?: string;
    var?: string;
    free?: string;
  };
  intensity: {
    area?: [string, string[]][];
    city?: [string, string[]][];
  };
  bounds: LatLngBounds;
  latestInformation: boolean;
};

export type EarthQuakeMonitor = {
  eventList: EarthquakeEvent[];
  currentEvent?: EarthquakeInformation.Latest.Main;
  currentEventId?: string;
  soundPlay: boolean;

  setEventList: (list: EarthquakeEvent[]) => void;
  selectEvent: (event: EarthquakeInformation.Latest.Main) => void;
  toggleSound: (value: boolean) => void;
};
