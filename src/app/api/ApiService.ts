import { DMDATA } from "@dmdata/sdk-js";
// Removed RxJS imports
import { APITypes, Components } from "@dmdata/api-types";
import { oauth2 } from "@/app/api/Oauth2Service";

// --- IMPORTANT ASSUMPTION ---
// This code assumes Oauth2Service has been updated or provides alternative methods
// that return Promises directly instead of RxJS Observables.
// For example:
// - Oauth2Service.getAuthorization() -> Promise<string>
// - Oauth2Service.getDPoPProofJWTAsync(method, uri, nonce) -> Promise<string>
// You might need to adjust the names `getAuthorization` and `getDPoPProofJWTAsync` below
// to match the actual Promise-returning methods in your updated Oauth2Service.
// ---------------------------

// Define placeholder types if the actual response data types are complex or unknown
// It's better to use the actual types from APITypes if known
type ContractListData = APITypes.ContractList.Response; // Adjusted to match the actual type
type TelegramListData = APITypes.TelegramList.Response;
type GDEarthquakeListData = APITypes.GDEarthquakeList.Response;
type GDEarthquakeEventData = APITypes.GDEarthquakeEvent.Response;
type ParameterEarthquakeStationData =
  APITypes.ParameterEarthquakeStation.Response; // Using actual type example
type SocketStartResponse = APITypes.SocketStart.Response; // Using actual type example
type SocketListResponse = APITypes.SocketList.Response;

export class ApiService {
  private client = new DMDATA();

  constructor() {
    this.client.setAuthorizationContext({
      getAuthorization: async () => {
        try {
          const service = oauth2();
          await service.ensureInitialized();
          const auth = await service.oauth2Instance?.getAuthorization();
          return auth || "";
        } catch (error) {
          return "";
        }
      },
      getDPoPProofJWT: async (method: string, uri: string, nonce?: string | null) => {
        try {
          
          const service = oauth2();
          await service.ensureInitialized();
          const oauth2Instance = service.oauth2Instance;
          
          if (!oauth2Instance) {
            return "";
          }
          
          // DPoP: 現在無効化中 - 常に空文字を返す
          return "";
          
          
          if (typeof (oauth2Instance as any).getDPoPProofJWT !== 'function') {
            
            // Alternative method names to try
            const alternativeNames = ['generateDPoPProof', 'createDPoPProof', 'dpop'];
            for (const altName of alternativeNames) {
              if (typeof (oauth2Instance as any)[altName] === 'function') {
                try {
                  const jwt = await (oauth2Instance as any)[altName](method, uri, nonce);
                  return jwt || "";
                } catch (altError) {
                }
              }
            }
            
            return "";
          }
          
          const jwt = await (oauth2Instance as any).getDPoPProofJWT(method, uri, nonce);
          return jwt || "";
        } catch (error) {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          return "";
        }
      },
    });
  }

  async contractList(): Promise<ContractListData> {
    // Already uses async/await, no change needed
    const res = await this.client.contract.list();
    return res.data; // Return the data property which matches the expected Response type
  }

  async telegramGet(tid: string): Promise<number | string | object | Document> {
    // Already uses async/await, no change needed in async logic
    const res = await this.client.telegramBody.get(tid);
    const contentType = res.headers["content-type"];

    if (contentType === "application/json" && typeof res.data === "object") {
      return res.data as object;
    }
    if (
      contentType?.startsWith("application/xml") &&
      typeof res.data === "string"
    ) {
      // Added check for startsWith and nullish coalescing for safety
      // Assuming running in a browser environment for DOMParser
      if (typeof window !== "undefined" && window.DOMParser) {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(res.data, "application/xml");
          // Check for parser errors
          if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            return res.data; // Or throw an error, depending on desired behavior
          }
          return xmlDoc;
        } catch (e) {
          // Fallback or re-throw depending on requirements
          return res.data;
        }
      } else {
        // Handle non-browser environment (e.g., Node.js) if necessary
          "DOMParser not available or not in Browser environment. Returning raw XML string."
        );
        return res.data;
      }
    }
    // Check status code explicitly for non-successful responses before assuming string
    if (res.status !== 200) {
      // Return status or handle error appropriately
      return res.status;
    }
    // If it's not JSON or XML, and status is 200, assume it's a string payload or handle other types
    if (typeof res.data === "string") {
      return res.data;
    }
    // Handle cases where data might be null or undefined even with 200 OK
    if (res.data === null || res.data === undefined) {
      // Return status or an empty string/object based on expectations
      return res.status; // Or return '';
    }

    // Fallback for unexpected content types or data types with 200 status
      `Unhandled content type or data type: ${contentType}, typeof data: ${typeof res.data}`
    );
    // You might return the raw data, status, or throw an error
    return res.data; // Returning raw data as a last resort
  }

  async socketStart(
    classifications: Components.Classification.Values[],
    appName?: string,
    formatMode: "json" | "raw" = "json"
  ): Promise<SocketStartResponse> {
    // Return type should match the data you want

    // Explicitly set returnMode to 'response' to get the API response details
    const res = await this.client.socket.start(
      {
        // Request Body
        classifications,
        appName,
        formatMode,
      },
      "response" // Use the overload that returns AxiosResponse
    );

    // 'res' is now type: AxiosResponse<APITypes.SocketStart.ResponseOk>
    // Access the actual API response data from the .data property
    return res.data;
  }

  async telegramList(
    params: APITypes.TelegramList.QueryParams
  ): Promise<TelegramListData> {
    // Already uses async/await, no change needed
    const res = await this.client.telegram.list(params);
    return res.data;
  }

  async gdEarthquakeList(
    params: APITypes.GDEarthquakeList.QueryParams
  ): Promise<GDEarthquakeListData> {
    // Already uses async/await, no change needed
    const res = await this.client.gdEarthquake.list(params);
    return res.data;
  }

  async gdEarthquakeEvent(eventId: string): Promise<GDEarthquakeEventData> {
    // Already uses async/await, no change needed
    const res = await this.client.gdEarthquake.event(eventId);
    return res.data;
  }

  async parameterEarthquakeStation(): Promise<ParameterEarthquakeStationData> {
    // Already uses async/await, no change needed
    const res = await this.client.parameter.earthquake();
    return res.data;
  }

  async socketList(params?: APITypes.SocketList.QueryParams): Promise<SocketListResponse> {
    const res = await this.client.socket.list(params);
    return res.data;
  }

  async socketClose(id: number): Promise<void> {
    await this.client.socket.close(id);
  }
}
