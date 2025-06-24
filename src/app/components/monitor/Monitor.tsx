/* src/app/components/monitor/Monitor.tsx */
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

console.log("Monitor component loaded");
import cn from "classnames";
import { ApiService } from "@/app/api/ApiService";
import { EventItem } from "./types/EventItem";
import { LatestEventCard } from "./ui/LatestEventCard";
import { RegularEventCard } from "./ui/RegularEventCard";

const MapComponent = dynamic(() => import("./map/MapCompnent"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
      }}
    >
      地図を読み込み中...
    </div>
  ),
});


const dummyEvents: EventItem[] = [
  {
    eventId: "20250428120000",
    arrivalTime: "2025-04-28T12:00:00+09:00",
    originTime: "2025-04-28T11:58:10+09:00",
    maxInt: "4",
    magnitude: { value: 5.8 },
    hypocenter: { name: "茨城県沖", depth: { value: 50 } },
  },
  // …モックデータ続く
];

export default function Monitor() {
  const [status, setStatus] = useState<
    "open" | "connecting" | "closed" | "error"
  >("closed");
  const [soundPlay, setSoundPlay] = useState(false);
  const [events, setEvents] = useState<EventItem[]>(dummyEvents);
  const [viewEventId, setViewEventId] = useState<string | null>(null);


  /* ---------- UIハンドラ例 ---------- */
  const openWs = () => setStatus("connecting");
  const closeWs = () => setStatus("closed");
  const toggleSound = (v: boolean) => setSoundPlay(v);

  return (
    <div className="flex flex-col flex-wrap w-screen h-screen max-h-screen">
      {/* settings bar ------------------------------------------------ */}
      <div className="flex text-white text-sm leading-[30px] min-h-[30px] bg-[#677a98]">
        {/* WebSocket 操作 */}
        <div className="flex mx-1.5">
          {status !== "open" && (
            <button
              className="mx-0.5 px-0.5 border border-[#063e7c] rounded bg-[#1c528d]"
              onClick={openWs}
            >
              Open
            </button>
          )}
          {status === "open" && (
            <button
              className="mx-0.5 px-0.5 border border-[#063e7c] rounded bg-[#1c528d]"
              onClick={closeWs}
            >
              to&nbsp;Close
            </button>
          )}
          <span
            className={cn(
              "mx-0.5 px-0.5 rounded text-black",
              {
                open: "border border-green-400 bg-green-200",
                connecting: "border border-yellow-400 bg-yellow-200",
                error: "border border-red-700 bg-red-600 text-white",
                closed: "border border-gray-400 bg-gray-300",
              }[status]
            )}
          >
            {status}
          </span>
        </div>

        {/* sound */}
        <label className="mx-1.5">
          <span>音声通知:</span>
          <input
            type="checkbox"
            checked={soundPlay}
            onChange={(e) => toggleSound(e.target.checked)}
            className="mx-0.5 align-middle"
          />
        </label>

        {/* パネル呼び出し例 */}
        <div className="flex mx-1.5">
          <button
            className="mx-0.5 px-0.5 border border-[#063e7c] rounded bg-[#1c528d]"
            onClick={() => console.log("地震情報検索を開く")}
          >
            地震情報検索
          </button>
        </div>

        <div className="flex-grow" />

        {/* package 情報 */}
        <div className="text-xs mx-1.5 flex items-center gap-1">
          <a href="https://github.com/pdmdss/app-etcm" target="_blank">
            <img
              src="/assets/github.png"
              alt="github"
              className="h-6 p-0.5 rounded bg-white"
            />
          </a>
          <span>pdmdss / app-etcm v0.0.0</span>
        </div>
      </div>

      {/* main -------------------------------------------------------- */}
      <div className="z-[5] flex flex-1 max-h-full overflow-hidden">
        {/* ---- event list ---- */}
        <aside className="flex flex-col w-[380px] max-w-[380px]">
          <header className="py-1 bg-red-600 text-center border-b-2 border-red-700">
            <h3 className="text-xs font-bold text-white tracking-wide leading-tight">
              地震情報 [{events.length}]
            </h3>
          </header>

          <ul className="flex-1 overflow-y-scroll m-0 p-2 bg-black">
            {events.map((ev, index) => {
              const isLatest = index === 0;
              const isSelected = viewEventId === ev.eventId;
              
              return isLatest ? (
                <LatestEventCard
                  key={ev.eventId}
                  event={ev}
                  isSelected={isSelected}
                  onClick={() => setViewEventId(ev.eventId)}
                />
              ) : (
                <RegularEventCard
                  key={ev.eventId}
                  event={ev}
                  isSelected={isSelected}
                  onClick={() => setViewEventId(ev.eventId)}
                />
              );
            })}
          </ul>
        </aside>

        {/* ---- event-data/map ---- */}
        <main className="flex-1 bg-gray-50">
          <MapComponent
            onEarthquakeUpdate={(newEvent) => {
              console.log("New earthquake event:", newEvent);
              setEvents((prevEvents) => [newEvent, ...prevEvents.slice(0, 9)]); // 最新10件まで保持
            }}
          />
        </main>
      </div>
    </div>
  );
}

