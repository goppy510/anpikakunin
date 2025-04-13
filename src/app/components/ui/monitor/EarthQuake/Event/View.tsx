"use client";

import { useCallback, useEffect, useState } from "react";
import { Observable } from "rxjs";
import { EarthquakeInformation } from "@dmdata/telegram-json-types";
import { latLngBounds, marker, Icon, icon } from "leaflet";
import { stationService } from "@/app/api/StationService";
import { MapService } from "@/app/components/ui/monitor/map/MapService";
import styles from "./View.module.css";

const seismicIcons = new Map<number, Icon>();
const hypocenterIcon = icon({
  iconUrl: '/assets/earthquake/image/hypocenter.png',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

for (let i = 1; i < 10; i++) {
  seismicIcons.set(i, icon({
    iconUrl: `/assets/earthquake/image/S${i}.png`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  }));
}

const intensityInitMap = () => [
  ['1', []],
  ['2', []],
  ['3', []],
  ['4', []],
  ['5-', []],
  ['5+', []],
  ['6-', []],
  ['6+', []],
  ['7', []]
] as [string, string[]][];

type EventViewProps = {
  eventData$: Observable<{ data: EarthquakeInformation.Latest.Main; latestInformation: boolean }>;
};

export default function EventView({ eventData$ }: EventViewProps) {
  const [eventData, setEventData] = useState<any>(null);
  const [mapService] = useState<MapService>(() => new MapService());

  useEffect(() => {
    const subscription = eventData$.subscribe(event => {
      view(event.data, event.latestInformation);
    });
    
    return () => subscription.unsubscribe();
  }, [eventData$]);

  const view = useCallback((data: EarthquakeInformation.Latest.Main, latestInformation: boolean) => {
    if (data.infoType === '取消') {
      return;
    }

    const title = data.title;
    const dateTime = data.pressDateTime;
    const eventId = data.eventId;
    
    if (!eventId || !dateTime) {
      return;
    }

    const newEventData = {
      eventId,
      latestInformation,
      dateTime,
      author: data.editorialOffice,
      comment: {}
    };

    if ('comments' in data.body) {
      if (data.body.comments.var) {
        newEventData.comment.var = data.body.comments.var.text;
      }
      if (data.body.comments.forecast) {
        newEventData.comment.forecast = data.body.comments.forecast.text;
      }
      if (data.body.comments.free) {
        newEventData.comment.free = data.body.comments.free;
      }
    }

    const intensity = 'intensity' in data.body ? data.body.intensity : null;
    const bounds = latLngBounds([]);
    
    const earthquake = 'earthquake' in data.body ? data.body.earthquake : null;
    const coordinate = earthquake?.hypocenter?.coordinate;

    if (coordinate && coordinate.latitude && coordinate.longitude) {
      mapService.clearLayers('earthquake');
      
      const latitude = coordinate.latitude;
      const longitude = coordinate.longitude;
      const center: [number, number] = [
        +latitude.value,
        +longitude.value
      ];

      mapService.addLayer(
        marker(center, {
          icon: hypocenterIcon,
          zIndexOffset: 90000000
        }),
        'earthquake'
      );
      
      bounds.extend(center);
    }

    newEventData.intensity = {};
    
    if (intensity) {
      const obsStations = 'stations' in intensity ? intensity.stations : null;
      const obsAreas = intensity?.regions;

      if (obsStations && obsStations.length > 0) {
        mapService.clearLayers('point');
        
        const cityInt = new Map<string, string[]>(intensityInitMap());
        
        obsStations.forEach(obsStation => {
          const int = 'maxInt' in obsStation ? obsStation.maxInt : 'int' in obsStation ? obsStation.int : null;
          const code = obsStation.code;
          const name = obsStation.name;

          if (!int || !code || !name) {
            return;
          }

          const location = stationService.getEarthquakeStation(code) ?? stationService.getEarthquakeArea(code);

          if (!location) {
            return;
          }

          const intNumber = int2number(int);

          if (intNumber === 0) {
            return;
          }

          bounds.extend(location);

          cityInt.get(int)?.push(name.replace('＊', ''));

          mapService.addLayer(
            marker(location, {
              icon: seismicIcons.get(intNumber),
              title: `${name}\n震度:${int}`,
              zIndexOffset: +`${intNumber}${code}`
            }),
            'point'
          );
        });

        newEventData.intensity.city = [...cityInt].reverse();
      } else if (obsAreas && obsAreas.length > 0) {
        mapService.clearLayers('point');
        
        const areaInt = new Map<string, string[]>(intensityInitMap());
        
        obsAreas.forEach(obsArea => {
          const int = 'maxInt' in obsArea ? obsArea.maxInt : 'int' in obsArea ? obsArea.int : null;
          const code = obsArea.code;
          const name = obsArea.name;

          if (!int || !code || !name) {
            return;
          }

          const location = stationService.getEarthquakeArea(code);

          if (!location) {
            return;
          }

          const intNumber = int2number(int);

          if (intNumber === 0) {
            return;
          }

          bounds.extend(location);

          areaInt.get(int)?.push(name.replace('＊', ''));

          mapService.addLayer(
            marker(location, {
              icon: seismicIcons.get(intNumber),
              title: `${name}\n震度:${int}`,
              zIndexOffset: +`${intNumber}${code}`
            }),
            'point'
          );
        });

        newEventData.intensity.area = [...areaInt].reverse();
      }
    }

    mapService.fitBounds(bounds, { maxZoom: 7 });

    if (title === '遠地地震に関する情報') {
      mapService.setZoom(3);
    }

    setEventData(newEventData);
  }, [mapService]);

  if (!eventData) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.eventView}>
      <div className={styles.header}>
        <div className={styles.dateTime}>{eventData.dateTime}</div>
        <div className={styles.author}>{eventData.author}</div>
      </div>
      
      <div className={styles.map} id="map"></div>
      
      <div className={styles.information}>
        {eventData.comment.forecast && (
          <div className={styles.comment}>
            <div className={styles.title}>警戒等の呼びかけ</div>
            <div className={styles.text}>{eventData.comment.forecast}</div>
          </div>
        )}
        
        {eventData.comment.var && (
          <div className={styles.comment}>
            <div className={styles.title}>その他の情報</div>
            <div className={styles.text}>{eventData.comment.var}</div>
          </div>
        )}
        
        {eventData.comment.free && (
          <div className={styles.comment}>
            <div className={styles.title}>自由形式</div>
            <div className={styles.text}>{eventData.comment.free}</div>
          </div>
        )}
        
        {eventData.intensity && (
          <div className={styles.intensitySection}>
            <div className={styles.title}>震度観測点</div>
            
            {eventData.intensity.city && eventData.intensity.city.map(([int, areas]) => (
              areas.length > 0 && (
                <div key={int} className={styles.intensityGroup}>
                  <div className={styles.intensityLevel}>震度{int}</div>
                  <div className={styles.intensityAreas}>
                    {areas.join('　')}
                  </div>
                </div>
              )
            ))}
            
            {eventData.intensity.area && eventData.intensity.area.map(([int, areas]) => (
              areas.length > 0 && (
                <div key={int} className={styles.intensityGroup}>
                  <div className={styles.intensityLevel}>震度{int}</div>
                  <div className={styles.intensityAreas}>
                    {areas.join('　')}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function int2number(str: string): number {
  if (str === '7') return 9;
  if (str === '6+') return 8;
  if (str === '6-') return 7;
  if (str === '5+') return 6;
  if (str === '5-') return 5;
  if (str === '!5-') return 0;
  return +str;
}
