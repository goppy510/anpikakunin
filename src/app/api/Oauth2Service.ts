"use client";

import { OAuth2Code } from "@dmdata/oauth2-client";
// Removed RxJS imports: from, interval, Observable, take, tap, concatMap, filter
import { Settings } from "@/app/lib/db/settings";
import { environment } from "@/environments/environment";

export class Oauth2Service {
  static getDPoPProofJWTAsync(
    method: string,
    uri: string,
    nonce: string | null | undefined
  ): Promise<string | null | undefined> {
    throw new Error("Method not implemented.");
  }
  static getAuthorization(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  // Removed static methods that threw errors
  // static getDPoPProofJWT(...) { ... }
  // static getAuthorizationRxjs(...) { ... }

  private oauth2?: OAuth2Code;
  private refreshToken?: string;
  private initializationPromise: Promise<void>; // Promise to track init completion

  constructor() {
    // Start initialization immediately and store the promise
    this.initializationPromise = this.init();
    // Handle potential initialization errors if needed, e.g.:
    this.initializationPromise.catch((error) => {
      console.error("OAuth2Service initialization failed:", error);
      // Depending on the app structure, might need more robust error handling
      // like setting a state that prevents API calls.
    });
  }

  async refreshTokenDelete(): Promise<void> {
    // No RxJS here, already async
    await Settings.delete("oauthRefreshToken");
    this.refreshToken = undefined;
    // Optionally re-initialize or clear the oauth2 instance if needed
    this.oauth2 = undefined; // Clear instance as refresh token is gone
    this.initializationPromise = this.init(); // Re-run init to reflect state
  }

  async oAuth2ClassReInit(): Promise<void> {
    // No RxJS here, already async
    // Re-run init and update the promise
    this.initializationPromise = this.init();
    await this.initializationPromise; // Wait for re-init to complete
  }

  /**
   * Gets the Authorization header value (e.g., "Bearer <token>").
   * Ensures initialization is complete before attempting to get the token.
   * @returns Promise<string> The Authorization header value.
   * @throws Error if initialization failed or the client is not available.
   */
  async getAuthorization(): Promise<string> {
    // Wait for the init() process to complete
    await this.initializationPromise;

    if (!this.oauth2) {
      // This should ideally not happen if init succeeded, but acts as a safeguard
      throw new Error("OAuth2 client is not initialized.");
    }

    // Directly await the Promise from the underlying SDK method
    return await this.oauth2.getAuthorization();
  }

  /**
   * Gets the DPoP proof JWT.
   * Ensures initialization is complete before attempting to get the proof.
   * @returns Promise<string | null | undefined> The DPoP proof JWT or null/undefined.
   */
  async getDPoPProofJWT(
    method: string,
    uri: string,
    nonce?: string | null
  ): Promise<string | null | undefined> {
    // Wait for the init() process to complete
    await this.initializationPromise;

    if (!this.oauth2) {
      // If init failed or somehow didn't set oauth2, return null/undefined
      console.warn("OAuth2 client not available when calling getDPoPProofJWT.");
      return null; // Mimics the original `?? Promise.resolve(null)` behavior
    }

    // Directly await the Promise from the underlying SDK method
    return await this.oauth2.getDPoPProofJWT(method, uri, nonce);
  }

  async refreshTokenCheck(): Promise<boolean> {
    // No RxJS here, already async
    return !!(await Settings.get("oauthRefreshToken"));
  }

  /**
   * Initializes the OAuth2Code client instance with settings.
   * This method is called by the constructor and oAuth2ClassReInit.
   */
  private async init(): Promise<void> {
    try {
      console.log("Initializing OAuth2Service...");
      // Fetch settings concurrently
      const [refreshToken, oauthDPoPKeypair] = await Promise.all([
        Settings.get("oauthRefreshToken"),
        Settings.get("oauthDPoPKeypair").then((res) => res || "ES384"), // Default if null
      ]);

      console.log(`Using Refresh Token: ${refreshToken ? "Yes" : "No"}`);
      console.log(`Using DPoP Key Type: ${oauthDPoPKeypair}`);

      this.oauth2 = new OAuth2Code({
        endpoint: {
          authorization: "https://manager.dmdata.jp/account/oauth2/v1/auth",
          token: "https://manager.dmdata.jp/account/oauth2/v1/token",
          introspect: "https://manager.dmdata.jp/account/oauth2/v1/introspect",
        },
        client: {
          id: "CId.xyw6-lPflvaxR9CrGR-zHBfGJ_8dUmVtai_61qRSplwM", // Consider moving ID to environment variables
          scopes: [
            "contract.list",
            "parameter.earthquake",
            "socket.start",
            "telegram.list",
            "telegram.data",
            "telegram.get.earthquake",
            "gd.earthquake",
          ],
          redirectUri: environment.OAUTH_REDIRECT_URI,
        },
        pkce: true,
        refreshToken: refreshToken || undefined, // Ensure undefined if null/empty
        dpop: oauthDPoPKeypair,
      });

      this.refreshToken = refreshToken || undefined;

      // Event listeners remain the same (callback-based, not RxJS)
      this.oauth2
        .on("refresh_token", (newRefreshToken) => {
          console.log("OAuth2: Received new refresh token.");
          Settings.set("oauthRefreshToken", newRefreshToken);
          this.refreshToken = newRefreshToken; // Update instance variable
        })
        .on("dpop_keypair", (keypair) => {
          console.log("OAuth2: Received new DPoP keypair.");
          Settings.set("oauthDPoPKeypair", keypair);
        });
      // Ensure the "error" event is supported by the OAuth2Code library before using it.
      // If unsupported, remove this block or handle errors differently.
      // Example: Uncomment the following block if the library supports a generic error handler.
      /*
        .on("error", (error) => {
          console.error("OAuth2Code Instance Error:", error);
        });
        */

      console.log("OAuth2Service initialized successfully.");
    } catch (error) {
      console.error("Failed during OAuth2Service initialization:", error);
      // Ensure oauth2 is undefined if init fails critically
      this.oauth2 = undefined;
      // Re-throw the error so the initializationPromise rejects
      throw error;
    }
  }
}
