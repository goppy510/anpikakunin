/* src/app/components/monitor/Monitor.tsx */
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

console.log("Monitor component loaded");
import cn from "classnames";
import { ApiService } from "@/app/api/ApiService";

const MapComponent = dynamic(() => import("./map/MapCompnent"), {
  ssr: false,
});

type EventItem = {
  eventId: string;
  originTime?: string;
  arrivalTime: string;
  maxInt?: string;
  magnitude?: { value?: number; condition?: string };
  hypocenter?: {
    name?: string;
    depth?: { value?: number; condition?: string };
  };
};

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
        <aside className="flex flex-col w-[260px] max-w-[260px]">
          <header className="py-1.5 bg-[#bcd4ee] text-center">
            <h3 className="text-base">地震情報履歴（{events.length}件）</h3>
          </header>

          <ul className="flex-1 overflow-y-scroll m-0 p-0">
            {events.map((ev) => (
              <li
                key={ev.eventId}
                className={cn(
                  "p-1.5 list-none border-b border-gray-200 cursor-pointer animate-[flash_0.65s_ease-in-out_7_alternate] opacity-100",
                  `intensity-s${ev.maxInt ?? ""}`,
                  viewEventId === ev.eventId && "relative view-event"
                )}
                onClick={() => setViewEventId(ev.eventId)}
              >
                {/* 時刻 */}
                <p className="text-lg">
                  {formatJPDateTime(ev.originTime ?? ev.arrivalTime)}
                </p>
                {/* 最大震度 */}
                <p className="text-base px-2 text-right">
                  最大震度 <span className="text-xl">{ev.maxInt ?? "-"}</span>
                </p>
                {/* 震源＋深さ */}
                <p className="px-2 text-right">
                  {ev.hypocenter?.name ?? "震源不明"}&nbsp;
                  {renderDepth(ev.hypocenter?.depth)}
                </p>
              </li>
            ))}
          </ul>
        </aside>

        {/* ---- event-data/map ---- */}
        <main className="flex-1 bg-gray-50">
          <MapComponent />
        </main>
      </div>
    </div>
  );
}

/* ---------- ヘルパ ---------- */
function formatJPDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d
    .getDate()
    .toString()
    .padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function renderDepth(
  depth?: { value?: number; condition?: string } | null
): string {
  if (!depth) return "-";
  if (depth.condition) return depth.condition;
  if (depth.value !== undefined) return `${depth.value}km`;
  return "不明";
}
