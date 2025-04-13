"use client";

import { useEffect, useState } from "react";
import { useWebSocketService } from "./use-websocket-service";
import { useSoundControl } from "./use-sound-control";
import { intColor } from "@/app/utils/int-color";
import EventView from "./EarthQuake/Event/View";
import styles from "./Monitor.module.css";

export default function Monitor() {
  const {
    eventList,
    viewEventId,
    selectEventObservable,
    toEvent,
    openPanel,
    webSocketStart,
    webSocketClose,
    webSocketStatus,
    webSocketIsStartingOK,
  } = useWebSocketService();

  const { soundPlay, toggleSoundPlay, soundPlayEnabled } = useSoundControl();
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
    <div className={styles.monitor}>
      <div className={styles.earthquake}>
        <div className={styles.eventList}>
          <div className={styles.eventHeader}>
            <h3>地震情報履歴（100件）</h3>
          </div>
          <ul>
            {eventList().map((row) => (
              <li
                key={row.eventId}
                onClick={() => toEvent(row.eventId)}
                className={`intensity-s${intColor(row.maxInt)} ${
                  row.eventId === viewEventId ? styles.viewEvent : ""
                }`}
              >
                <div className={styles.eventTime}>
                  {new Date(row.originTime || row.arrivalTime).toLocaleString(
                    "ja-JP",
                    {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </div>
                <div className={styles.eventMaxint}>
                  最大震度 <span>{row.maxInt || "-"}</span>
                </div>
                <div className={styles.eventRegion}>
                  <span>{row.hypocenter?.name || "震源不明"}</span>
                  {(row.maxInt ||
                    row.hypocenter?.depth?.condition !== "不明") && (
                    <>
                      <span>&nbsp;</span>
                      {row.hypocenter?.depth?.condition ? (
                        <span>{row.hypocenter.depth.condition}</span>
                      ) : row.hypocenter?.depth?.value ? (
                        <span>{row.hypocenter.depth.value}km</span>
                      ) : (
                        <span>不明</span>
                      )}
                    </>
                  )}
                </div>
                <div className={styles.eventMagnitude}>
                  {row.magnitude ? (
                    (row.magnitude as any).condition ? (
                      <span>{(row.magnitude as any).condition}</span>
                    ) : (row.magnitude as any).value ? (
                      <span>M {(row.magnitude as any).value}</span>
                    ) : (
                      <span>M不明</span>
                    )
                  ) : (
                    <span>M不明</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.eventData}>
          <EventView eventData$={selectEventObservable()} />
        </div>
      </div>

      <div className={styles.settings}>
        <div className={styles.websocket}>
          <div>WebSocket:</div>
          {webSocketIsStartingOK() && (
            <div className={styles.websocketStart} onClick={webSocketStart}>
              Open
            </div>
          )}
          <div className={`${styles.websocketStatus} ${webSocketStatus}`}>
            {webSocketStatus}
          </div>
          {webSocketStatus === "open" && (
            <div className={styles.websocketClose} onClick={webSocketClose}>
              to Close
            </div>
          )}
        </div>
        <div className={styles.sound}>
          <label>
            <span>音声通知:</span>
            <input
              type="checkbox"
              checked={soundPlay}
              onChange={toggleSoundPlay}
            />
          </label>
        </div>
        <div className={styles.panes}>
          <div
            onClick={() => openPanel("earthquake-history")}
            className={styles.panel}
          >
            地震情報検索
          </div>
        </div>
        <div className={styles.spacer}></div>
        <div className={styles.package}>
          <span>
            <a href="https://github.com/pdmdss/app-etcm" target="_blank">
              <img
                src="/assets/github.png"
                alt="github"
                className={styles.logoGithub}
              />
            </a>
          </span>
          <span>{`DMDATA.JP / ETCM v1.0.0`}</span>
        </div>
      </div>
    </div>
  );
}
