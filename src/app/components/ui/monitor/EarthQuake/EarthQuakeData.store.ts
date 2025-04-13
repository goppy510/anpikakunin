import { EarthquakeEvent } from "@/app/types/earthquake-event";

export class EarthquakeData {
  private static events = new Map<string, EarthquakeEvent>();

  static get(eventId: string) {
    return this.events.get(eventId);
  }

  static set(event: EarthquakeEvent) {
    const ev = this.get(event.eventId) ?? event;

    if (event.originTime) {
      ev.originTime = event.originTime;
    }
    if (event.arrivalTime) {
      ev.arrivalTime = event.arrivalTime;
    }
    if (event.hypocenter) {
      ev.hypocenter = event.hypocenter;
    }
    if (event.magnitude) {
      ev.magnitude = event.magnitude;
    }
    if (event.maxInt) {
      ev.maxInt = event.maxInt;
    }
    if (event.maxLgInt) {
      ev.maxLgInt = event.maxLgInt;
    }

    this.events.set(event.eventId, ev);
  }

  static delete(eventId: string) {
    return this.events.delete(eventId);
  }

  static eventIds() {
    return this.events.keys();
  }
}
