import { create } from "zustand";
import type { EarthQuakeMonitor } from "@/app/components/monitor/earthQuake/type";

export const useMonitorStore = create<EarthQuakeMonitor>((set) => ({
  eventList: [],
  soundPlay: false,

  setEventList: (list) => set({ eventList: list }),
  selectEvent: (event) =>
    set({ currentEvent: event, currentEventId: event.eventId }),
  toggleSound: (val) => set({ soundPlay: val }),
}));
