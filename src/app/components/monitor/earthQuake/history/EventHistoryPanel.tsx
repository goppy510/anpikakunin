"use client";

import { useState } from "react";
import { apiService } from "@/app/api/ApiService";
import { EarthquakeData } from "@/app/components/monitor/earthQuake/store";
import { APITypes } from "@dmdata/api-types";

export default function EventHistoryPanel({
  onClose,
}: {
  onClose: (eventId?: string) => void;
}) {
  const [historyStatus, setHistoryStatus] = useState<"loading" | "ok" | null>(
    null
  );
  const [historyItems, setHistoryItems] = useState<
    APITypes.GDEarthquakeList.ResponseOk["items"]
  >([]);
  const [searchValues, setSearchValues] = useState({
    start_date: "",
    end_date: "",
    max_int: "",
  });

  const setSearch = (
    key: "start_date" | "end_date" | "max_int",
    value: string
  ) => {
    setSearchValues((prev) => ({ ...prev, [key]: value }));
  };

  const dateFormat = (val: string, isEnd: boolean) => {
    const date = new Date(val);
    if (isEnd) date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date
      .getDate()
      .toString()
      .padStart(2, "0")}T00:00:00`;
  };

  const search = () => {
    const { start_date, end_date, max_int } = searchValues;
    const datetime =
      start_date || end_date
        ? `${start_date ? dateFormat(start_date, false) : ""}~${
            end_date ? dateFormat(end_date, true) : ""
          }`
        : undefined;

    setHistoryStatus("loading");
    apiService
      .gdEarthquakeList({
        ...(datetime ? { datetime } : {}),
        ...(max_int ? { maxInt: max_int } : {}),
        limit: 100,
      })
      .then((res) => {
        setHistoryItems(res.items);
        setHistoryStatus("ok");
      })
      .catch(() => setHistoryStatus(null));
  };

  const toSelectEvent = (eventId: string) => {
    const event = historyItems.find((i) => i.eventId === eventId);
    if (!event) return;
    EarthquakeData.set(event);
    onClose(eventId);
  };

  return (
    <div className="panel">
      <div className="header">
        <h3>地震情報履歴検索</h3>
        <div className="header-span"></div>
        <div onClick={() => onClose()} className="panel-close">
          <span className="material-icons">close</span>
        </div>
      </div>

      <div className="search">
        <div className="search-input">
          <input
            type="date"
            onInput={(e) =>
              setSearch("start_date", (e.target as HTMLInputElement).value)
            }
          />
          <span> ~ </span>
          <input
            type="date"
            onInput={(e) =>
              setSearch("end_date", (e.target as HTMLInputElement).value)
            }
          />
        </div>
        <div className="search-input">
          <select
            onInput={(e) =>
              setSearch("max_int", (e.target as HTMLSelectElement).value)
            }
          >
            <option value="">-</option>
            {[1, 2, 3, 4, "5-", "5+", "6-", "6+", "7"].map((level) => (
              <option key={level} value={level}>
                震度{level}以上
              </option>
            ))}
          </select>
        </div>
        <div className="search-input">
          <input type="button" value="検索" onClick={search} />
        </div>
      </div>

      <div className="history">
        {historyStatus === "ok" && (
          <table>
            <tbody>
              {historyItems.map((row) => (
                <tr
                  key={row.eventId}
                  onClick={() => toSelectEvent(row.eventId)}
                >
                  <td>
                    {row.originTime
                      ? formatDate(row.originTime)
                      : formatDate(row.arrivalTime)}
                    頃{row.originTime ? "発生" : "検知"}
                  </td>
                  <td>{row.hypocenter?.name || "-"}</td>
                  <td>
                    {row.hypocenter?.depth?.condition ||
                      (row.hypocenter?.depth?.value
                        ? `${row.hypocenter.depth.value}km`
                        : "-")}
                  </td>
                  <td>
                    {row.magnitude?.condition ||
                      (row.magnitude ? `M${row.magnitude}` : "-")}
                  </td>
                  <td
                    className={`max-intensity intensity-s${row.maxInt ?? ""}`}
                  >
                    {row.maxInt ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDate(str: string) {
  const date = new Date(str);
  return `${date.getFullYear()}年${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}月${date.getDate().toString().padStart(2, "0")}日${date
    .getHours()
    .toString()
    .padStart(2, "0")}時${date.getMinutes().toString().padStart(2, "0")}分`;
}
