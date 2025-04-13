import { DMDATA } from "@dmdata/sdk-js";
import { 
  getAuthorization, 
  getDPoPProofJWT 
} from "@/app/api/Oauth2Service";

interface ContractListResponse {
  items: Array<{
    classification: string;
    [key: string]: any;
  }>;
}

interface EarthquakeListResponse {
  items: Array<{
    eventId: string;
    [key: string]: any;
  }>;
}

interface EarthquakeEventResponse {
  event: {
    telegrams: Array<{
      id: string;
      head: {
        type: string;
      };
    }>;
    [key: string]: any;
  };
}

interface ParameterEarthquakeResponse {
  [key: string]: any;
}

class ApiService {
  private client: DMDATA;

  constructor() {
    this.client = new DMDATA({
      credentials: {
        getAuthorization: () => getAuthorization(),
        getDPoPProofJWT: (method: string, uri: string, nonce: string) => getDPoPProofJWT(method, uri, nonce)
      }
    });
  }

  async contractList(): Promise<ContractListResponse> {
    try {
      const response = await this.client.contract.list();
      const items = Array.isArray(response) ? response : [response];
      return { items: items.map(item => ({ classification: item.classification || '', ...item })) };
    } catch (error) {
      console.error("Error in contractList:", error);
      return { items: [] };
    }
  }

  async telegramList(param: { [key: string]: any }): Promise<{ items: any[] }> {
    try {
      const response = await this.client.telegram.list(param);
      const items = Array.isArray(response) ? response : [response];
      return { items };
    } catch (error) {
      console.error("Error in telegramList:", error);
      return { items: [] };
    }
  }

  async telegramGet(id: string): Promise<any> {
    try {
      const response = await this.client.telegramBody.get(id);
      return response;
    } catch (error) {
      console.error("Error in telegramGet:", error);
      return null;
    }
  }

  async gdEarthquakeList(param: { limit: number }): Promise<EarthquakeListResponse> {
    try {
      const response = await this.client.gdEarthquake.list(param);
      const items = Array.isArray(response) ? response : [response];
      return { items: items.map(item => ({ eventId: item.eventId || '', ...item })) };
    } catch (error) {
      console.error("Error in gdEarthquakeList:", error);
      return { items: [] };
    }
  }

  async gdEarthquakeEvent(eventId: string): Promise<EarthquakeEventResponse> {
    try {
      const response = await this.client.gdEarthquake.event(eventId);
      return { 
        event: {
          telegrams: [],  // Default empty array that will be populated by the caller if needed
          id: eventId,
          ...((typeof response === 'object' && response !== null) ? response : {})
        } 
      };
    } catch (error) {
      console.error("Error in gdEarthquakeEvent:", error);
      return { event: { telegrams: [] } };
    }
  }

  async parameterEarthquakeStation(): Promise<ParameterEarthquakeResponse> {
    try {
      const response = await this.client.parameter.earthquake();
      return response || {};
    } catch (error) {
      console.error("Error in parameterEarthquakeStation:", error);
      return {};
    }
  }

  async socketStart(classifications: string[], name: string, format: string = "json"): Promise<any> {
    return this.client.socket.start({
      classifications,
      appName: name
    });
  }
}

export const apiService = new ApiService();
