"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Subject } from "rxjs";
import { EarthquakeData } from "./EarthQuake/EarthQuakeData.store";
import { EarthquakeEvent } from "@/app/types/earthquake-event";
import { msgUpdateService } from "@/app/api/MsgUpdateService";
import { EarthquakeInformation } from "@dmdata/telegram-json-types";
import { apiService } from "@/app/api/ApiService";
import { Settings } from "@/app/lib/db/settings";

type TelegramItem = {
  id: string;
  head: {
    type: string;
  };
};

export function useWebSocketService() {
  const [eventIdList, setEventIdList] = useState<string[]>([]);
  const [viewEventId, setViewEventId] = useState<string | undefined>(undefined);
  const [soundPlay, setSoundPlay] = useState(false);
  const [webSocketStatus, setWebSocketStatus] = useState<string | null>(null);
  
  const eventSelectSubject = useRef(new Subject<{ data: EarthquakeInformation.Latest.Main; latestInformation: boolean }>()).current;

  const toEvent = useCallback((eventId: string) => {
    if (viewEventId === eventId) return;
    
    setViewEventId(eventId);
    
    apiService.gdEarthquakeEvent(eventId)
      .then(event => {
        const telegram = event.event.telegrams.find((telegram: TelegramItem) => 
          /^VXSE5[1-3]$/.test(telegram.head.type)
        );
        if (telegram) {
          return apiService.telegramGet(telegram.id);
        }
        return null;
      })
      .then(data => {
        if (data) {
          eventSelectSubject.next({
            data,
            latestInformation: eventIdList.indexOf(eventId) === (eventIdList.length - 1)
          });
        }
      });
  }, [viewEventId, eventIdList, eventSelectSubject]);

  useEffect(() => {
    apiService.gdEarthquakeList({ limit: 100 })
      .then(response => {
        const events = response.items.reverse();
        const ids = events.map((item: any) => {
          EarthquakeData.set(item as unknown as EarthquakeEvent);
          return item.eventId;
        });
        setEventIdList(ids);
        if (ids.length > 0) {
          toEvent(ids[0]);
        }
      });

    const checkStatus = setInterval(() => {
      setWebSocketStatus(msgUpdateService.getWebSocketStatus());
    }, 1000);

    msgUpdateService.onNewTelegram(data => {
      const earthquake = 'earthquake' in data.body ? data.body.earthquake : null;
      
      if (soundPlay) {
      }

      const eventData: Partial<EarthquakeEvent> = {
        eventId: data.eventId || '',
        arrivalTime: earthquake?.arrivalTime ?? data.targetDateTime,
        originTime: earthquake?.originTime,
        maxInt: 'intensity' in data.body ? data.body.intensity?.maxInt : undefined,
        maxLgInt: undefined
      };
      
      if (earthquake?.hypocenter) {
        eventData.hypocenter = earthquake.hypocenter as unknown as EarthquakeEvent['hypocenter'];
      }
      
      if (earthquake?.magnitude) {
        eventData.magnitude = earthquake.magnitude as unknown as EarthquakeEvent['magnitude'];
      }
      
      EarthquakeData.set(eventData as EarthquakeEvent);

      setEventIdList(prevIds => {
        const newIds = [...prevIds];
        if (!newIds.includes(data.eventId)) {
          newIds.push(data.eventId);
        }
        if (newIds.length > 100) {
          newIds.shift();
        }
        return newIds;
      });

      if (data._schema.type === 'earthquake-information') {
        eventSelectSubject.next({
          data,
          latestInformation: true
        });
      } else {
        toEvent(data.eventId);
      }
    });

    Settings.get('soundPlayAutoActivation').then(value => {
      setSoundPlay(value ?? false);
    });

    return () => {
      clearInterval(checkStatus);
    };
  }, [toEvent, soundPlay, eventSelectSubject]);

  const toggleSoundPlay = useCallback(() => {
    const newValue = !soundPlay;
    setSoundPlay(newValue);
    Settings.set('soundPlayAutoActivation', newValue);
  }, [soundPlay]);

  const webSocketStart = useCallback(() => {
    msgUpdateService.webSocketStart();
  }, []);

  const webSocketClose = useCallback(() => {
    msgUpdateService.webSocketClose();
  }, []);

  const webSocketIsStartingOK = useCallback(() => {
    return [null, 'closed', 'error'].includes(webSocketStatus);
  }, [webSocketStatus]);

  const openPanel = useCallback((name: string) => {
    if (name === 'earthquake-history') {
    }
  }, []);

  const eventList = useCallback(() => {
    return [...eventIdList].reverse()
      .map(eventId => EarthquakeData.get(eventId))
      .filter(Boolean) as EarthquakeEvent[];
  }, [eventIdList]);

  const selectEventObservable = useCallback(() => {
    return eventSelectSubject.asObservable();
  }, [eventSelectSubject]);

  return {
    eventList,
    viewEventId,
    selectEventObservable,
    toEvent,
    openPanel,
    webSocketStart,
    webSocketClose,
    webSocketStatus,
    webSocketIsStartingOK,
    soundPlay,
    toggleSoundPlay
  };
}
