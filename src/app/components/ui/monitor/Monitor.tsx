"use client";

import { useEffect, useState } from "react";
import { useWebSocketService } from "./use-websocket-service";
import EventView from "./EarthQuake/Event/View";
import styles from "./Monitor.module.css";

export default function Monitor() {
  const {
    eventList,
    viewEventId,
    selectEventObservable,
    toEvent,
    webSocketStart,
    webSocketClose,
    webSocketStatus,
    webSocketIsStartingOK,
    soundPlay,
    toggleSoundPlay
  } = useWebSocketService();

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);
    
    if (webSocketIsStartingOK()) {
      webSocketStart();
    }
    
    return () => {
      webSocketClose();
    };
  }, [webSocketIsStartingOK, webSocketStart, webSocketClose]);

  if (!isInitialized) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.monitorContainer}>
      <div className={styles.header}>
        <h1>地震情報</h1>
        <div className={styles.controls}>
          <div className={styles.status}>
            WebSocket: {webSocketStatus || "未接続"}
          </div>
          <button 
            className={styles.button}
            onClick={webSocketIsStartingOK() ? webSocketStart : webSocketClose}
          >
            {webSocketIsStartingOK() ? "接続" : "切断"}
          </button>
          <button 
            className={`${styles.button} ${soundPlay ? styles.active : ''}`}
            onClick={toggleSoundPlay}
          >
            {soundPlay ? "サウンドON" : "サウンドOFF"}
          </button>
        </div>
      </div>
      
      <div className={styles.content}>
        <div className={styles.eventList}>
          <h2>地震リスト</h2>
          <div className={styles.list}>
            {eventList().map(event => (
              <div 
                key={event.eventId}
                className={`${styles.eventItem} ${viewEventId === event.eventId ? styles.active : ''}`}
                onClick={() => toEvent(event.eventId)}
              >
                <div className={styles.eventTime}>
                  {event.arrivalTime ? new Date(event.arrivalTime).toLocaleString('ja-JP') : '不明'}
                </div>
                <div className={styles.eventInfo}>
                  <div className={styles.eventLocation}>
                    {event.hypocenter?.name || '不明'}
                  </div>
                  <div className={styles.eventDetails}>
                    {event.magnitude && `M${event.magnitude.value}`}
                    {event.maxInt && ` 最大震度${event.maxInt}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className={styles.eventView}>
          <EventView eventData$={selectEventObservable()} />
        </div>
      </div>
    </div>
  );
}
