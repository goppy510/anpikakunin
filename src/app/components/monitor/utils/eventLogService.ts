import type { EventItem } from "../types/EventItem";

export type EventLogSource = "rest" | "websocket";

export const logEarthquakeEvent = async (
  event: EventItem,
  source: EventLogSource
): Promise<boolean> => {
  try {
    const res = await fetch("/api/earthquake-events/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event, source }),
    });

    if (!res.ok) {
      console.error(
        "地震イベントログAPIの呼び出しに失敗しました:",
        res.status,
        res.statusText
      );
      return false;
    }

    const data = (await res.json()) as { inserted?: boolean };
    return Boolean(data.inserted);
  } catch (error) {
    console.error("地震イベントログAPI通信中にエラーが発生:", error);
    return false;
  }
};
