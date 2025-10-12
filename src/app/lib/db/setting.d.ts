import { Keypair } from "@dmdata/oauth2-client";
import { SafetyConfirmationConfig } from "../../components/safety-confirmation/types/SafetyConfirmationTypes";

export type AppSettings = {
  oauthRefreshToken: string;
  soundPlayAutoActivation: boolean;
  oauthDPoPKeypair: Keypair;
  oauthCodeVerifier: string;
  oauthState: string;
  safetyConfirmationConfig: SafetyConfirmationConfig;
};
