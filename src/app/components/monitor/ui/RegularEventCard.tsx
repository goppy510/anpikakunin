import cn from "classnames";
import { EventItem } from "../types/EventItem";
import { getIntensityColor, needsDarkText, getIntensityBorderClass } from "../utils/intensityUtils";
import { formatJPDateTime, renderDepth, renderMagnitude } from "../utils/dateUtils";

interface RegularEventCardProps {
  event: EventItem;
  isSelected: boolean;
  onClick: () => void;
}

export function RegularEventCard({ event, isSelected, onClick }: RegularEventCardProps) {
  const yahooUrl = `https://typhoon.yahoo.co.jp/weather/jp/earthquake/${event.eventId}.html`;

  return (
    <li
      className={cn(
        "relative list-none cursor-pointer border-l-4 hover:bg-gray-700 transition-colors duration-100 rounded-r-lg group",
        isSelected && "bg-gray-600",
        getIntensityBorderClass(event.maxInt ?? "0"),
        "bg-gray-800 mb-2"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-5 h-20 p-2.5">
        {/* 震度表示 */}
        <div
          className="flex items-center justify-center font-black leading-none border-2 shrink-0 shadow-lg"
          style={{
            width: "60px",
            height: "60px",
            backgroundColor: getIntensityColor(event.maxInt ?? "0"),
            borderColor: "rgba(0,0,0,0.4)",
            color: needsDarkText(event.maxInt ?? "0") ? "#000000" : "#ffffff",
            fontSize: "2.25rem",
            whiteSpace: "nowrap",
            borderRadius: "4px",
          }}
        >
          {event.maxInt ?? "-"}
        </div>


        {/* 地震情報エリア */}
        <div className="flex-1 min-w-0">
          {/* 震源地 */}
          <div className="text-white font-bold leading-relaxed mb-2 text-xl">
            <span className="truncate block">
              {!event.isConfirmed ? (
                <span className="text-orange-300">確認中</span>
              ) : (
                event.hypocenter?.name ?? "震源不明"
              )}
              {event.isTest && (
                <span className="ml-2 text-xs font-medium text-yellow-300 bg-yellow-900 px-1.5 py-0.5 rounded">
                  TEST
                </span>
              )}
            </span>
          </div>

          {/* 時刻 */}
          <div className="text-gray-300 leading-relaxed font-medium text-base">
            {formatJPDateTime(event.originTime ?? event.arrivalTime)}
          </div>
        </div>

        {/* 右側: マグニチュードと深さ */}
        <div className="flex flex-col items-end justify-center text-right shrink-0">
          <div className="text-yellow-300 leading-relaxed font-black mb-2 text-2xl">
            M{renderMagnitude(event.magnitude)}
          </div>
          <div className="text-gray-200 leading-relaxed font-bold text-base">
            深さ{renderDepth(event.hypocenter?.depth)}
          </div>
        </div>
      </div>

      {/* ホバー時のリンク表示 */}
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <a
          href={yahooUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded shadow-lg transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="mr-1">🔗</span>
          詳細
        </a>
      </div>
    </li>
  );
}