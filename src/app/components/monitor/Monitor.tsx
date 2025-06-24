/* src/app/components/monitor/Monitor.tsx */
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

console.log("Monitor component loaded");
import cn from "classnames";
import { ApiService } from "@/app/api/ApiService";

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

  // 震度に応じた色を取得する関数（マップと同じ色スキーム）
  const getIntensityColor = (intensity: string): string => {
    const normalizedIntensity = parseFloat(intensity) || 0;

    if (intensity === "5弱" || intensity === "5-") return "#ffff00";
    if (intensity === "5強" || intensity === "5+") return "#ffcc00";
    if (intensity === "6弱" || intensity === "6-") return "#ff9900";
    if (intensity === "6強" || intensity === "6+") return "#ff6600";

    if (normalizedIntensity === 0) return "#0066ff";
    if (normalizedIntensity === 1) return "#0080ff";
    if (normalizedIntensity === 2) return "#00ccff";
    if (normalizedIntensity === 3) return "#00ff99";
    if (normalizedIntensity === 4) return "#66ff33";
    if (normalizedIntensity === 5) return "#ffff00";
    if (normalizedIntensity === 6) return "#ff9900";
    if (normalizedIntensity >= 7) return "#ff0000";
    return "#0066ff";
  };

  // 黄色系の色で黒文字が必要かどうかを判定
  const needsDarkText = (intensity: string): boolean => {
    const color = getIntensityColor(intensity);
    // 黄色系の色（明るい色）は黒文字を使用
    return color === "#ffff00" || color === "#ffcc00" || color === "#66ff33";
  };

  // 震度に応じた左ボーダーのTailwindクラスを取得
  const getIntensityBorderClass = (intensity: string): string => {
    const normalizedIntensity = parseFloat(intensity) || 0;

    if (intensity === "5弱" || intensity === "5-") return "border-l-yellow-400";
    if (intensity === "5強" || intensity === "5+") return "border-l-yellow-500";
    if (intensity === "6弱" || intensity === "6-") return "border-l-orange-500";
    if (intensity === "6強" || intensity === "6+") return "border-l-orange-600";

    if (normalizedIntensity === 0) return "border-l-blue-500";
    if (normalizedIntensity === 1) return "border-l-blue-400";
    if (normalizedIntensity === 2) return "border-l-cyan-400";
    if (normalizedIntensity === 3) return "border-l-green-400";
    if (normalizedIntensity === 4) return "border-l-lime-400";
    if (normalizedIntensity === 5) return "border-l-yellow-400";
    if (normalizedIntensity === 6) return "border-l-orange-500";
    if (normalizedIntensity >= 7) return "border-l-red-500";
    return "border-l-gray-500";
  };

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
              return (
                <li
                  key={ev.eventId}
                  className={cn(
                    "relative list-none cursor-pointer border-l-4 hover:bg-gray-700 transition-colors duration-100 rounded-r-lg",
                    viewEventId === ev.eventId && "bg-gray-600",
                    getIntensityBorderClass(ev.maxInt ?? "0"),
                    isLatest
                      ? "bg-gradient-to-r from-gray-700 to-gray-800 border-2 border-yellow-400 shadow-lg mb-3"
                      : "bg-gray-800 mb-2"
                  )}
                  onClick={() => setViewEventId(ev.eventId)}
                >
                  <div
                    className={cn(
                      "flex items-center gap-5",
                      isLatest ? "h-24 p-3" : "h-20 p-2.5"
                    )}
                  >
                    {/* 震度表示 - 大型サイズ */}
                    <div
                      className="flex items-center justify-center font-black leading-none border-2 shrink-0 shadow-lg"
                      style={{
                        width: isLatest ? "70px" : "60px",
                        height: isLatest ? "70px" : "60px",
                        backgroundColor: getIntensityColor(ev.maxInt ?? "0"),
                        borderColor: "rgba(0,0,0,0.4)",
                        color: needsDarkText(ev.maxInt ?? "0")
                          ? "#000000"
                          : "#ffffff",
                        fontSize: isLatest ? "2.5rem" : "2.25rem",
                        whiteSpace: "nowrap",
                        borderRadius: "4px",
                      }}
                    >
                      {ev.maxInt ?? "-"}
                    </div>

                    {/* 地震情報エリア */}
                    <div className="flex-1 min-w-0">
                      {/* 震源地 */}
                      <div
                        className={cn(
                          "text-white font-bold leading-relaxed mb-2",
                          isLatest ? "text-2xl" : "text-xl"
                        )}
                      >
                        <span className="truncate block">
                          {ev.hypocenter?.name ?? "震源不明"}
                        </span>
                      </div>

                      {/* 時刻 */}
                      <div
                        className={cn(
                          "text-gray-300 leading-relaxed font-medium",
                          isLatest ? "text-lg" : "text-base"
                        )}
                      >
                        {formatJPDateTime(ev.originTime ?? ev.arrivalTime)}
                      </div>
                    </div>

                    {/* 右側: マグニチュードと深さ */}
                    <div className="flex flex-col items-end justify-center text-right shrink-0">
                      <div
                        className={cn(
                          "text-yellow-300 leading-relaxed font-black mb-2",
                          isLatest ? "text-3xl" : "text-2xl"
                        )}
                      >
                        M{ev.magnitude?.value ?? "-"}
                      </div>
                      <div
                        className={cn(
                          "text-gray-200 leading-relaxed font-bold",
                          isLatest ? "text-lg" : "text-base"
                        )}
                      >
                        深さ{renderDepth(ev.hypocenter?.depth)}
                      </div>
                    </div>

                  </div>
                </li>
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
