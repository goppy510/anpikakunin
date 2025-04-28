// src/app/components/monitor/event-history/event-history.service.ts
export const IntensityLevels = [
  1,
  2,
  3,
  4,
  "5-",
  "5+",
  "6-",
  "6+",
  "7",
] as const;

/* ISO 文字列を「YYYY年MM月DD日HH時mm分」に整形 */
export function formatJPDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(
    d.getDate()
  )}日${pad(d.getHours())}時${pad(d.getMinutes())}分`;
}

/* 検索フォームから datetime パラメータを生成 */
export function buildDatetimeRange(
  start: string,
  end: string
): string | undefined {
  if (!start && !end) return undefined;
  const from = start ? toRangeEdge(start, false) : "";
  const to = end ? toRangeEdge(end, true) : "";
  return `${from}~${to}`;
}

/* ---------- 内部ユーティリティ ---------- */
const pad = (n: number) => n.toString().padStart(2, "0");

function toRangeEdge(dateStr: string, isEnd: boolean) {
  const d = new Date(dateStr);
  if (isEnd) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T00:00:00`;
}
