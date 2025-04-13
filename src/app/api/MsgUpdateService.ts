import { ungzip } from "pako";
import { EarthquakeInformation } from "@dmdata/telegram-json-types";
import { APITypes } from "@dmdata/api-types";
import { WebSocketService } from "@dmdata/sdk-js";
import { apiService } from "@/app/api/ApiService";

class MsgUpdateService {
  private telegramTypes = ["VXSE51", "VXSE52", "VXSE53", "VXSE61"];
  private nextPoolingToken?: string;
  private webSocketSubject?: WebSocketService;
  private webSocketStatus: null | "connecting" | "open" | "closed" | "error" =
    null;
  private telegramListeners: ((
    data: EarthquakeInformation.Latest.Main
  ) => void)[] = [];

  getWebSocketStatus(): typeof this.webSocketStatus {
    return this.webSocketStatus;
  }

  onNewTelegram(callback: (data: EarthquakeInformation.Latest.Main) => void) {
    this.telegramListeners.push(callback);
    if (this.telegramListeners.length === 1) {
      this.startPolling();
    }
  }

  webSocketStart() {
    this.createWebSocketStream()?.then((ws) => {
      if (!ws) return;
      ws.on("data", (item: APITypes.WebSocketV2.Event.Data) => {
        if (
          this.telegramTypes.includes(item.head.type) &&
          item.format === "json" &&
          item.encoding === "base64"
        ) {
          const data = unzip(item.body) as EarthquakeInformation.Latest.Main;
          this.telegramListeners.forEach((cb) => cb(data));
        }
      });
    });
  }

  webSocketClose() {
    if (this.webSocketStatus === "open") {
      this.webSocketSubject?.close();
    }
  }

  private startPolling() {
    const poll = async () => {
      if (this.webSocketStatus === "open") return;
      try {
        const res = await apiService.telegramList({
          cursorToken: this.nextPoolingToken,
          formatMode: "json",
          type: "VXSE",
        });
        this.nextPoolingToken = res.nextPooling;

        for (const item of res.items) {
          if (!this.telegramTypes.includes(item.head.type)) continue;
          const data = await apiService.telegramGet(item.id);
          if (typeof data === "object" && !(data instanceof Document)) {
            this.telegramListeners.forEach((cb) =>
              cb(data as EarthquakeInformation.Latest.Main)
            );
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      } finally {
        setTimeout(poll, 2000);
      }
    };
    poll();
  }

  private async createWebSocketStream(): Promise<WebSocketService | undefined> {
    if (this.webSocketSubject?.readyState === WebSocketService.OPEN) return;

    this.webSocketStatus = "connecting";
    const ws = await apiService.socketStart(
      ["telegram.earthquake"],
      "ETCM",
      "json"
    );
    this.webSocketSubject = ws;
    ws.on("start", () => (this.webSocketStatus = "open"));
    return ws;
  }
}

function unzip(data: string) {
  const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const decompressed = ungzip(buffer); // Uint8Array
  return JSON.parse(new TextDecoder().decode(decompressed));
}

export const msgUpdateService = new MsgUpdateService();
