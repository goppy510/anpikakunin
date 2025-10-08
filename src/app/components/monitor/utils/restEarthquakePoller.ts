import { ApiService } from "@/app/api/ApiService";
import type { EventItem } from "@/app/components/monitor/types/EventItem";
import type { APITypes, Components } from "@dmdata/api-types";

type PollerOptions = {
  /** REST API のポーリング間隔（ミリ秒） */
  intervalMs?: number;
  /** 取得件数 */
  limit?: number;
};

type PollerContext = {
  /** 初回読み込みかどうか */
  isInitial: boolean;
};

type PollerCallback = (
  events: EventItem[],
  context: PollerContext
) => void | Promise<void>;

type ErrorCallback = (error: unknown) => void;

const DEFAULT_INTERVAL = 60_000; // 60秒
const DEFAULT_LIMIT = 10;

const INTENSITY_MAP: Record<Components.Earthquake.IntensityClass, string> = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5-": "5弱",
  "5+": "5強",
  "6-": "6弱",
  "6+": "6強",
  "7": "7",
};

const normalizeIntensity = (
  intensity?: Components.Earthquake.IntensityClass
): string | undefined => {
  if (!intensity) return undefined;
  return INTENSITY_MAP[intensity] ?? intensity;
};

const toMagnitude = (
  magnitude?: Components.Earthquake.EarthquakeMagnitude
): EventItem["magnitude"] => {
  if (!magnitude) return undefined;

  const value =
    typeof magnitude.value === "string"
      ? parseFloat(magnitude.value)
      : undefined;

  const condition =
    magnitude.condition && magnitude.condition !== "" ? magnitude.condition : undefined;

  if (value === undefined && !condition) {
    return undefined;
  }

  return { value, condition };
};

const toDepth = (
  depth?: Components.Earthquake.EarthquakeHypocenterDepth
): { value?: number; condition?: string } | undefined => {
  if (!depth) return undefined;

  const value =
    typeof depth.value === "string" ? parseFloat(depth.value) : undefined;
  const condition =
    depth.condition && depth.condition !== "" ? depth.condition : undefined;

  if (value === undefined && !condition) {
    return undefined;
  }

  return { value, condition };
};

const toEventItem = (event: Components.Earthquake.Event): EventItem => {
  const arrivalTime = event.arrivalTime;
  const originTime = event.originTime;
  const maxInt = normalizeIntensity(event.maxInt);

  return {
    eventId: event.eventId,
    arrivalTime,
    originTime,
    maxInt,
    currentMaxInt: maxInt,
    magnitude: toMagnitude(event.magnitude),
    hypocenter: event.hypocenter
      ? {
          name: event.hypocenter.name,
          depth: toDepth(event.hypocenter.depth),
        }
      : undefined,
    isConfirmed: true,
  };
};

const isGdListOk = (
  response: APITypes.GDEarthquakeList.Response
): response is APITypes.GDEarthquakeList.ResponseOk =>
  response.status === "ok" && Array.isArray(response.items);

/**
 * DMDATA の地震 REST API を一定間隔でポーリングし、最新イベントを配信するクラス。
 */
export class EarthquakeRestPoller {
  private apiService: ApiService;
  private timerId: number | null = null;
  private latestTimestamp = 0;
  private latestEventId: string | null = null;
  private isRunning = false;

  constructor(
    apiService: ApiService,
    private readonly callback: PollerCallback,
    private readonly errorCallback?: ErrorCallback,
    private readonly options: PollerOptions = {}
  ) {
    this.apiService = apiService;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 初回は全件処理（通知側で初回かどうか判断できるようフラグを渡す）
    void this.fetchLatest(true);

    const interval = this.options.intervalMs ?? DEFAULT_INTERVAL;
    this.timerId = window.setInterval(() => {
      void this.fetchLatest(false);
    }, interval);
  }

  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  private async fetchLatest(isInitial: boolean): Promise<void> {
    try {
      const limit = this.options.limit ?? DEFAULT_LIMIT;
      const response = await this.apiService.gdEarthquakeList({ limit });

      if (!isGdListOk(response)) {
        throw new Error(
          `Unexpected response from gdEarthquakeList: ${JSON.stringify(
            response
          )}`
        );
      }

      if (!response.items.length) {
        return;
      }

      // 到達時刻で昇順ソート（古い → 新しい）
      const sorted = [...response.items].sort((a, b) => {
        const aTime = new Date(a.arrivalTime ?? a.originTime ?? 0).getTime();
        const bTime = new Date(b.arrivalTime ?? b.originTime ?? 0).getTime();
        return aTime - bTime;
      });

      const newEvents: Components.Earthquake.Event[] = [];

      for (const item of sorted) {
        const eventTime = new Date(
          item.arrivalTime ?? item.originTime ?? 0
        ).getTime();

        const isNewerThanLatest =
          this.latestTimestamp === 0 ||
          eventTime > this.latestTimestamp ||
          (eventTime === this.latestTimestamp &&
            item.eventId !== this.latestEventId);

        if (isInitial || isNewerThanLatest) {
          newEvents.push(item);
        }
      }

      if (!newEvents.length) {
        // 最新イベント情報は更新
        const newest = sorted[sorted.length - 1];
        this.latestTimestamp = new Date(
          newest.arrivalTime ?? newest.originTime ?? 0
        ).getTime();
        this.latestEventId = newest.eventId;
        return;
      }

      const eventItems = newEvents.map(toEventItem);
      await this.callback(eventItems, { isInitial });

      const newest = sorted[sorted.length - 1];
      this.latestTimestamp = new Date(
        newest.arrivalTime ?? newest.originTime ?? 0
      ).getTime();
      this.latestEventId = newest.eventId;
    } catch (error) {
      console.error("EarthquakeRestPoller.fetchLatest failed:", error);
      this.errorCallback?.(error);
    }
  }
}
