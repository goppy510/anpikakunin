"use client";

import L from 'leaflet';

type LayerGroups = {
  [key: string]: L.LayerGroup;
};

export class MapService {
  private map?: L.Map;
  private layerGroups: LayerGroups = {};

  initMap(elementId: string) {
    if (this.map) return this.map;
    
    const map = L.map(elementId, {
      center: [36.5, 137.5],
      zoom: 5,
      layers: [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        })
      ]
    });
    
    this.map = map;
    return map;
  }

  addLayer(layer: L.Layer, groupName: string) {
    if (!this.map) return;
    
    if (!this.layerGroups[groupName]) {
      this.layerGroups[groupName] = L.layerGroup().addTo(this.map);
    }
    
    this.layerGroups[groupName].addLayer(layer);
  }

  clearLayers(groupName: string) {
    if (this.layerGroups[groupName]) {
      this.layerGroups[groupName].clearLayers();
    }
  }

  fitBounds(bounds: L.LatLngBounds, options?: L.FitBoundsOptions) {
    this.map?.fitBounds(bounds, options);
  }

  setZoom(zoom: number) {
    this.map?.setZoom(zoom);
  }
}
