import { ungzip } from "pako";
// Removed RxJS imports

import type { EarthquakeInformation } from "@dmdata/telegram-json-types";
import type { APITypes } from "@dmdata/api-types";
import { WebSocketService } from "@dmdata/sdk-js";
import type { ApiService } from "@/app/api/ApiService"; // Use 'import type'

// Helper function remains the same
function unzip(data: string): EarthquakeInformation.Latest.Main {
  const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const decompressed = ungzip(buffer); // Uint8Array
  return JSON.parse(new TextDecoder().decode(decompressed));
}

export class MsgUpdateService {
  private readonly telegramTypes = ["VXSE51", "VXSE52", "VXSE53", "VXSE61"];
  private nextPoolingToken?: string;
  private webSocketSubject?: WebSocketService;
  private webSocketStatus: null | "connecting" | "open" | "closed" | "error" =
    null;

  // Callback and distinctness tracking
  private onNewTelegramCallback?: (
    data: EarthquakeInformation.Latest.Main
  ) => void;
  private processedTelegramIds = new Set<string>();

  // Polling state
  private isPollingActive: boolean = false;
  private pollingTimeoutId?: ReturnType<typeof setTimeout>;
  private isInitialPollComplete: boolean = false; // To handle RxJS skip(1) intent

  constructor(private api: ApiService) {}

  /**
   * Gets the current status of the WebSocket connection.
   */
  getWebSocketStatus(): typeof this.webSocketStatus {
    return this.webSocketStatus;
  }

  /**
   * Registers a callback function to receive new, distinct telegram data.
   * Initiates the process of fetching data (polling and/or WebSocket).
   * @param callback The function to call with new telegram data.
   */
  public newTelegrams(
    callback: (data: EarthquakeInformation.Latest.Main) => void
  ): void {
    this.onNewTelegramCallback = callback;

    // Reset state for a new subscription
    this.processedTelegramIds.clear();
    this.nextPoolingToken = undefined;
    this.isInitialPollComplete = false;

    // Stop any existing activities before starting new ones
    this.webSocketClose(); // Close existing WebSocket if any
    this.stopPollingLoop(); // Stop existing polling if any

    // Start polling (it will stop automatically if WebSocket connects)
    this.startPollingLoop();

    // Optionally, attempt WebSocket connection immediately as well
    // this.connectWebSocket(); // Uncomment if you want WS to try connecting right away
  }

  /**
   * Initiates a WebSocket connection attempt.
   */
  public webSocketStart(): void {
    this.connectWebSocket();
  }

  /**
   * Closes the WebSocket connection if it's open.
   */
  public webSocketClose(): void {
    if (
      this.webSocketStatus === "open" ||
      this.webSocketStatus === "connecting"
    ) {
      if (this.webSocketSubject) {
        this.webSocketSubject.close();
        // State will be updated by the 'close' event handler in connectWebSocket
        this.webSocketSubject = undefined; // Clear reference
      }
    }
    // Explicitly set status if closing manually before connection established
    if (this.webSocketStatus === "connecting") {
      this.webSocketStatus = "closed";
    }
  }

  // --- Internal Methods ---

  /**
   * Handles incoming raw data from the WebSocket connection.
   */
  private handleWebSocketData(data: APITypes.WebSocketV2.Event.Data): void {
    try {
      if (
        this.telegramTypes.includes(data.head.type) &&
        data.format === "json" &&
        data.encoding === "base64" &&
        data.body // Ensure body is not empty
      ) {
        const processedData = unzip(data.body);

        // Check distinctness before invoking callback
        if (!this.processedTelegramIds.has(processedData._originalId)) {
          this.processedTelegramIds.add(processedData._originalId);
          // Safely invoke the callback if it exists
          this.onNewTelegramCallback?.(processedData);
        }
      }
    } catch (error) {
    }
  }

  /**
   * Establishes and manages the WebSocket connection and its event listeners.
   */
  private async connectWebSocket(): Promise<void> {
    // Prevent multiple concurrent connection attempts or connecting when already open
    if (
      this.webSocketStatus === "connecting" ||
      this.webSocketStatus === "open"
    ) {
        `WebSocket connection attempt skipped, status: ${this.webSocketStatus}`
      );
      return;
    }

    this.webSocketStatus = "connecting";

    try {
      // Assuming api.socketStart returns Promise<WebSocketService> when returnMode is default/websocket
      const response = await this.api.socketStart(
        ["telegram.earthquake"],
        "ETCM",
        "json"
      );

      // Ensure the response is a WebSocketService instance
      if (response instanceof WebSocketService) {
        // Check if status changed while awaiting (e.g., manual close)
        if (this.webSocketStatus !== "connecting") {
            "WebSocket connection aborted before listeners attached."
          );
          response.close(); // Ensure the obtained socket is closed
          return;
        }

        this.webSocketSubject = response;
      } else {
          "Failed to establish WebSocket connection: Invalid response type."
        );
        this.webSocketStatus = "error";
        return;
      }

      this.webSocketSubject?.on("start", () => {
        if (this.webSocketStatus !== "closed") {
          // Avoid status update if closed manually right before 'start'
          this.webSocketStatus = "open";
          this.stopPollingLoop(); // Stop polling now that WebSocket is active
        }
      });

      this.webSocketSubject?.on("data", (data) => {
        this.handleWebSocketData(data);
      });

      this.webSocketSubject?.on("close", (event: any) => {
        // Check if this close was initiated manually or unexpectedly
        if (this.webSocketStatus !== "closed") {
          // Avoid double logging if closed manually
            `WebSocket connection closed. Code: ${event?.code || 'unknown'}, Reason: ${event?.reason || 'unknown'}`
          );
          this.webSocketStatus = "closed";
          this.webSocketSubject = undefined; // Clear reference
          // Restart polling only if the service hasn't been stopped externally
          if (this.onNewTelegramCallback) {
            this.startPollingLoop();
          }
        }
      });

      this.webSocketSubject?.on("error", (error) => {
        if (this.webSocketStatus !== "closed") {
          // Avoid status update if closed manually right before 'error'
          this.webSocketStatus = "error";
          this.webSocketSubject?.close(); // Attempt to close on error
          this.webSocketSubject = undefined;
          // Restart polling only if the service hasn't been stopped externally
          if (this.onNewTelegramCallback) {
            this.startPollingLoop();
          }
        }
      });
    } catch (error) {
      // Ensure status reflects failure if we were trying to connect
      if (this.webSocketStatus === "connecting") {
        this.webSocketStatus = "error"; // Or 'closed' depending on desired state
      }
      // Restart polling if connection failed and a subscription exists
      if (this.onNewTelegramCallback) {
        this.startPollingLoop();
      }
    }
  }

  /**
   * Starts the polling loop if it's not already active and WebSocket is not open.
   */
  private startPollingLoop(): void {
    // Prevent multiple loops or starting if WebSocket is active
    if (this.isPollingActive || this.webSocketStatus === "open") {
      return;
    }

    this.isPollingActive = true;
    // Reset initial poll flag - crucial if loop restarts after WS close
    this.isInitialPollComplete = false;
    clearTimeout(this.pollingTimeoutId); // Clear any residual timer

    // Define the asynchronous loop function
    const loop = async () => {
      // Primary exit conditions for the loop continuation
      if (!this.isPollingActive || this.webSocketStatus === "open") {
        this.isPollingActive = false; // Ensure flag is set correctly
        return;
      }

      try {
        // Perform one polling cycle
        const listResponse = await this.api.telegramList({
          cursorToken: this.nextPoolingToken,
          formatMode: "json",
          type: "VXSE", // Filtering by broad type; specific types checked later
        });

        // Always update the token for the *next* iteration
        this.nextPoolingToken = (listResponse as any).nextPooling;
        const currentItems = (listResponse as any).items;

        if (!this.isInitialPollComplete) {
          // Just completed the first poll, obtained the token.
          this.isInitialPollComplete = true;
            `Initial poll complete. Next token: ${
              this.nextPoolingToken ? "obtained" : "not available"
            }. Processing items from next poll.`
          );
        } else if (currentItems && currentItems.length > 0) {
          // This is a subsequent poll, process the items found.
          for (const item of currentItems) {
            if (this.telegramTypes.includes(item.head.type)) {
              // Check distinctness *before* fetching details (optimization)
              if (!this.processedTelegramIds.has(item._originalId)) {
                try {
                  const detail = await this.api.telegramGet(item.id);
                  // Check type and ensure it's the expected object structure
                  if (
                    typeof detail === "object" &&
                    !(detail instanceof Document) &&
                    detail !== null &&
                    "_originalId" in detail
                  ) {
                    const processedData =
                      detail as EarthquakeInformation.Latest.Main;
                    // Final distinctness check before callback
                    if (
                      !this.processedTelegramIds.has(processedData._originalId)
                    ) {
                      this.processedTelegramIds.add(processedData._originalId);
                      this.onNewTelegramCallback?.(processedData);
                    }
                  } else {
                      `Received unexpected data type or structure for telegram ID ${item.id}:`,
                      typeof detail
                    );
                  }
                } catch (getErr) {
                    `Failed to get telegram detail for ID ${item.id}:`,
                    getErr
                  );
                  // Decide if you want to retry or just skip this item
                }
              } else {
              }
            }
          }
        }
      } catch (listError) {
        // Optional: Add delay/backoff logic here if needed
      }

      // Schedule the next iteration only if the loop should continue
      if (this.isPollingActive && (this.webSocketStatus as any) !== "open") {
        this.pollingTimeoutId = setTimeout(loop, 2000); // Schedule next run
      } else {
        this.isPollingActive = false; // Ensure flag is reset if loop terminates
      }
    };

    // Initiate the first iteration of the loop
    loop();
  }

  /**
   * Stops the polling loop and clears the timeout.
   */
  private stopPollingLoop(): void {
    if (!this.isPollingActive) return;
    this.isPollingActive = false;
    clearTimeout(this.pollingTimeoutId);
  }
}
