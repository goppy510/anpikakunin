// src/app/api/index.ts
import { ApiService } from "./ApiService";
import { Oauth2Service } from "./Oauth2Service";

export const oauth2 = new Oauth2Service();
export const apiService = new ApiService();
