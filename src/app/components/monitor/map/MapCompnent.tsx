"use client";

import { useEffect } from "react";
import { initMap } from "./services/map.service";
import styles from "./map.module.scss";

export default function MapComponent() {
  useEffect(() => {
    initMap();
  }, []);

  return <div id="map" className={styles.map} />;
}
