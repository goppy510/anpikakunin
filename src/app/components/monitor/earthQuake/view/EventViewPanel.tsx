import { useEffect } from "react";
import { icon, Icon, LatLngBounds, latLngBounds, marker } from "leaflet";
import type { EarthquakeInformation } from "@dmdata/telegram-json-types";
import { EarthquakeData } from "@/app/components/monitor/earthQuake/store";
import { EventObjectExtend } from "@/app/components/monitor/earthQuake/type";
import { useStation } from "@/app/components/monitor/earthQuake/view/hooks/useStation";
import { useMap } from "@/app/components/monitor/earthQuake/view/hooks/useMap";

const seismicIcon = new Map<number, Icon>();
const hypocenterIcon = icon({
  iconUrl: "/earthquake/image/hypocenter.png",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

for (let i = 1; i < 10; i++) {
  seismicIcon.set(
    i,
    icon({
      iconUrl: `/earthquake/image/S${i}.png`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })
  );
}

const intensityInitMap = (): [string, string[]][] => [
  ["1", []],
  ["2", []],
  ["3", []],
  ["4", []],
  ["5-", []],
  ["5+", []],
  ["6-", []],
  ["6+", []],
  ["7", []],
];

export function useEventView(
  data: EarthquakeInformation.Latest.Main,
  latestInformation: boolean
) {
  const map = useMap();
  const station = useStation();

  useEffect(() => {
    if (data.infoType === "取消") return;

    const title = data.title;
    const dateTime = data.pressDateTime;
    const eventId = data.eventId;
    const base = EarthquakeData.get(eventId);

    if (!eventId || !dateTime || !base) return;

    const eventData: EventObjectExtend = {
      ...base,
      dateTime,
      author: data.editorialOffice,
      latestInformation,
      comment: {},
      intensity: {},
      bounds: latLngBounds([]),
    };

    if ("comments" in data.body) {
      const comments = data.body.comments;
      eventData.comment = {
        var: comments?.var?.text,
        forecast: comments?.forecast?.text,
        free: comments?.free,
      };
    }

    const bounds: LatLngBounds = eventData.bounds;

    const coordinate = eventData.hypocenter?.coordinate;
    if (coordinate?.latitude && coordinate?.longitude) {
      map.clearLayers("earthquake");
      const center: [number, number] = [
        +coordinate.latitude.value,
        +coordinate.longitude.value,
      ];
      map.addLayer(
        marker(center, { icon: hypocenterIcon, zIndexOffset: 90000000 }),
        "earthquake"
      );
      bounds?.extend(center);
    }

    const intensity = "intensity" in data.body ? data.body.intensity : null;

    if (intensity) {
      const obsStations = "stations" in intensity ? intensity.stations : null;
      const obsAreas = intensity?.regions;

      if (obsStations && obsStations?.length) {
        map.clearLayers("point");

        const cityInt = new Map<string, string[]>(intensityInitMap());

        obsStations.forEach((item) =>
          addIntensity(item, bounds, cityInt, station, map)
        );
        eventData.intensity.city = [...cityInt].reverse();
      } else if (obsAreas?.length) {
        map.clearLayers("point");
        const areaInt = new Map<string, string[]>(intensityInitMap());
        obsAreas.forEach((a) => addIntensity(a, bounds, areaInt, station, map));
        eventData.intensity.area = [...areaInt].reverse();
      }
    }

    map.fitBounds(bounds, { maxZoom: 7 });
    if (title === "遠地地震に関する情報") map.setZoom(3);

    EarthquakeData.set(eventData);
  }, [data, latestInformation, map, station]);
}

function addIntensity(
  item: {
    name: string;
    code: string;
    int?: EarthquakeInformation.Latest.IntensityClass | "!5-";
    maxInt?: EarthquakeInformation.Latest.IntensityClass | "!5-";
    revise?: "上方修正" | "追加" | "下方修正";
    condition?: "震度５弱以上未入電";
  },
  bounds: LatLngBounds,
  intLists: Map<string, string[]>,
  station: ReturnType<typeof useStation>,
  map: ReturnType<typeof useMap>
) {
  const int = "maxInt" in item ? item.maxInt : item.int;
  if (!int || !item.code || !item.name) return;

  const location =
    station.getEarthquakeStation(item.code) ||
    station.getEarthquakeArea(item.code);
  if (!location) return;

  const intNumber = int2number(int);
  if (intNumber === 0) return;

  bounds.extend(location);
  intLists.get(int)?.push(item.name.replace("＊", ""));

  map.addLayer(
    marker(location, {
      icon: seismicIcon.get(intNumber),
      title: `${item.name}\n震度:${int}`,
      zIndexOffset: +`${intNumber}${item.code}`,
    }),
    "point"
  );
}

function int2number(str: string): number {
  return (
    {
      "7": 9,
      "6+": 8,
      "6-": 7,
      "5+": 6,
      "5-": 5,
      "!5-": 0,
    }[str] ?? +str
  );
}
