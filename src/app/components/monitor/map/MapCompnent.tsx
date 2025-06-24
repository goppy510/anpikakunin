"use client";

import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import styles from "./map.module.scss";

export default function MapComponent() {
  return (
    <div className={styles.map}>
      <MapContainer
        center={[35, 135]}
        zoom={5}
        maxZoom={9}
        minZoom={2}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap contributors'
        />
      </MapContainer>
    </div>
  );
}
