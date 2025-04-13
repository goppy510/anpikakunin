import { APIClient, APITypes } from "@dmdata/sdk-js";
import { 
  getAuthorization, 
  getDPoPProofJWT 
} from "@/app/api/Oauth2Service";

class ApiService {
  private client: APIClient;

  constructor() {
    this.client = new APIClient({
      authorization: () => getAuthorization(),
      dpop: (method, uri, nonce) => getDPoPProofJWT(method, uri, nonce)
    });
  }

  async contractList(): Promise<APITypes.Contract.List.Response> {
    return this.client.contract.list();
  }

  async telegramList(param: APITypes.Telegram.List.Parameter): Promise<APITypes.Telegram.List.Response> {
    return this.client.telegram.list(param);
  }

  async telegramGet(id: string): Promise<any> {
    return this.client.telegram.get(id);
  }

  async gdEarthquakeList(param: APITypes.GD.Earthquake.List.Parameter): Promise<APITypes.GD.Earthquake.List.Response> {
    return this.client.gd.earthquake.list(param);
  }

  async gdEarthquakeEvent(eventId: string): Promise<APITypes.GD.Earthquake.Event.Response> {
    return this.client.gd.earthquake.event(eventId);
  }

  async parameterEarthquakeStation(): Promise<APITypes.Parameter.Earthquake.Response> {
    return this.client.parameter.earthquake();
  }

  async socketStart(classifications: string[], name: string, format: string = "json"): Promise<any> {
    return this.client.socket.start({
      classifications,
      name,
      format
    });
  }
}

export const apiService = new ApiService();
