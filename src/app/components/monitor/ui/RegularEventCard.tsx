import cn from "classnames";
import { EventItem } from "../types/EventItem";
import { getIntensityColor, needsDarkText, getIntensityBorderClass } from "../utils/intensityUtils";
import { formatJPDateTime, renderDepth } from "../utils/dateUtils";

interface RegularEventCardProps {
  event: EventItem;
  isSelected: boolean;
  onClick: () => void;
}

export function RegularEventCard({ event, isSelected, onClick }: RegularEventCardProps) {
  return (
    <li
      className={cn(
        "relative list-none cursor-pointer border-l-4 hover:bg-gray-700 transition-colors duration-100 rounded-r-lg",
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
              {event.hypocenter?.name ?? "震源不明"}
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
            M{event.magnitude?.value ?? "-"}
          </div>
          <div className="text-gray-200 leading-relaxed font-bold text-base">
            深さ{renderDepth(event.hypocenter?.depth)}
          </div>
        </div>
      </div>
    </li>
  );
}