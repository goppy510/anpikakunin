// src/app/components/monitor/event-history/EventHistoryPanel.tsx
"use client";

import { useState } from "react";
import { EarthquakeData } from "@/app/components/monitor/earthQuake/store";
import { apiService } from "@/app/api"; // ← 共有インスタンス
import type { APITypes } from "@dmdata/api-types";
import {
  buildDatetimeRange,
  formatJPDateTime,
  IntensityLevels,
} from "../hooks/event-history.service";

/* ---------- 型ガード ---------- */
type GdListOk = APITypes.GDEarthquakeList.ResponseOk;
function isGdListOk(res: unknown): res is GdListOk {
  return typeof res === "object" && res !== null && "items" in res;
}

type Props = { onClose: (eventId?: string) => void };

export default function EventHistoryPanel({ onClose }: Props) {
  const [historyStatus, setHistoryStatus] = useState<"loading" | "ok" | null>(
    null
  );
  const [historyItems, setHistoryItems] = useState<GdListOk["items"]>([]);
  const [searchValues, setSearchValues] = useState({
    start_date: "",
    end_date: "",
    max_int: "",
  });

  const setSearch = (key: keyof typeof searchValues, value: string) =>
    setSearchValues((prev) => ({ ...prev, [key]: value }));

  /* ---------- 検索 ---------- */
  const search = async () => {
    const { start_date, end_date, max_int } = searchValues;
    const datetime = buildDatetimeRange(start_date, end_date);

    setHistoryStatus("loading");
    try {
      const res = await apiService.gdEarthquakeList({
        ...(datetime ? { datetime } : {}),
        ...(max_int ? { maxInt: max_int } : {}),
        limit: 100,
      });

      if (isGdListOk(res)) {
        setHistoryItems(res.items);
        setHistoryStatus("ok");
      } else {
        // APIError の場合
        console.error(res);
        setHistoryStatus(null);
      }
    } catch (e) {
      console.error(e);
      setHistoryStatus(null);
    }
  };

  /* ---------- イベント選択 ---------- */
  const toSelectEvent = (eventId: string) => {
    const event = historyItems.find((i) => i.eventId === eventId);
    if (!event) return;
    EarthquakeData.set(event);
    onClose(eventId);
  };

  /* ---------- render ---------- */
  return (
    <div className="panel">
      {/* --- header --- */}
      <div className="header">
        <h3>地震情報履歴検索</h3>
        <div className="header-span" />
        <button onClick={() => onClose()} className="panel-close">
          ×
        </button>
      </div>

      {/* --- search form --- */}
      <div className="search">
        <div className="search-input">
          <input
            type="date"
            onInput={(e) => setSearch("start_date", e.currentTarget.value)}
          />
          <span> ~ </span>
          <input
            type="date"
            onInput={(e) => setSearch("end_date", e.currentTarget.value)}
          />
        </div>

        <div className="search-input">
          <select
            defaultValue=""
            onInput={(e) => setSearch("max_int", e.currentTarget.value)}
          >
            <option value="">-</option>
            {IntensityLevels.map((lvl) => (
              <option key={lvl} value={lvl}>
                震度{lvl}以上
              </option>
            ))}
          </select>
        </div>

        <div className="search-input">
          <button onClick={search}>検索</button>
        </div>
      </div>

      {/* --- result list --- */}
      <div className="history">
        {historyStatus === "ok" && (
          <table>
            <tbody>
              {historyItems.map((row) => (
                <tr
                  key={row.eventId}
                  onClick={() => toSelectEvent(row.eventId)}
                  className={`intensity-s${row.maxInt ?? ""}`}
                >
                  <td>
                    {formatJPDateTime(row.originTime ?? row.arrivalTime)}頃
                    {row.originTime ? "発生" : "検知"}
                  </td>
                  <td>{row.hypocenter?.name || "-"}</td>
                  <td>
                    {row.hypocenter?.depth?.condition ??
                      (row.hypocenter?.depth?.value
                        ? `${row.hypocenter.depth.value}km`
                        : "-")}
                  </td>
                  <td>
                    {row.magnitude?.condition ??
                      (row.magnitude ? `M${row.magnitude}` : "-")}
                  </td>
                  <td>{row.maxInt ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {historyStatus === "loading" && <p>Loading...</p>}
      </div>
    </div>
  );
}
