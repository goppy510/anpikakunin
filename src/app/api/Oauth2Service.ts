// src/app/api/Oauth2Service.ts
"use client";

import { OAuth2Code } from "@dmdata/oauth2-client";
import { Settings } from "@/app/lib/db/settings";
import { env } from "@/app/lib/env";

const CLIENT_ID = "CId.LgawSy4V1SNsimqooHFBiVNvLjdZtS1K5dJL6wyX5gfE";
const REDIRECT_URI = env.NEXT_PUBLIC_OAUTH_REDIRECT_URI;
const SCOPES = [
  "contract.list",
  "parameter.earthquake",
  "socket.start",
  "telegram.list",
  "telegram.data",
  "telegram.get.earthquake",
  "gd.earthquake",
] as const;

export class Oauth2Service {
  private oauth2: OAuth2Code | null = null;
  private initPromise: Promise<void> | null = null;
  private codeVerifier: string | null = null;
  private codeChallenge: string | null = null;
  private state: string | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  get oauth2Instance(): OAuth2Code | null {
    return this.oauth2;
  }

  async refreshTokenCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // Check if we have a refresh token in storage
      const storedRefreshToken = await Settings.get("oauthRefreshToken");
      
      if (!storedRefreshToken) return false;
      
      // Actually test if the OAuth2 instance can get authorization
      if (this.oauth2) {
        try {
          const auth = await this.oauth2.getAuthorization();
          console.log("refreshTokenCheck: Authorization test successful");
          return !!auth;
        } catch (error) {
          console.log("refreshTokenCheck: Authorization test failed, returning false");
          // If DPoP error or other auth failure, token is invalid
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Refresh token check failed:", error);
      return false;
    }
  }

  async debugTokenStatus(): Promise<void> {
    const [storedRefreshToken, storedDPoPKeypair] = await Promise.all([
      Settings.get("oauthRefreshToken"),
      Settings.get("oauthDPoPKeypair")
    ]);
    
    console.log("=== OAuth Debug ===");
    console.log("Stored refresh token:", storedRefreshToken ? "EXISTS" : "NULL");
    console.log("Stored DPoP keypair:", storedDPoPKeypair ? "EXISTS" : "NULL");
    console.log("OAuth2 instance:", this.oauth2 ? "EXISTS" : "NULL");
    
    if (this.oauth2) {
      try {
        const auth = await this.oauth2.getAuthorization();
        console.log("getAuthorization result:", auth ? "EXISTS" : "NULL");
        
        // DPoP JWT生成テスト
        try {
          const dpopJWT = await (this.oauth2 as any).getDPoPProofJWT("POST", "https://api.dmdata.jp/v2/socket");
          console.log("DPoP JWT test:", dpopJWT ? "SUCCESS" : "FAILED");
        } catch (dpopError) {
          console.log("DPoP JWT test error:", dpopError);
        }
        
      } catch (error) {
        console.log("getAuthorization error:", error);
      }
    }
    console.log("==================");
  }

  async refreshTokenDelete(): Promise<void> {
    await this.ensureInitialized();
    try {
      if (this.oauth2) {
        await this.oauth2.revoke();
      }
      await Settings.delete("oauthRefreshToken");
      await Settings.delete("oauthDPoPKeypair");
      await Settings.delete("oauthCodeVerifier");
      await Settings.delete("oauthState");
      
      // Reset the OAuth2 instance to start fresh
      this.oauth2 = null;
      this.codeVerifier = null;
      this.codeChallenge = null;
      this.state = null;
      this.initPromise = null;
      
      console.log("All OAuth data cleared");
    } catch (error) {
      console.error("Failed to delete refresh token:", error);
      throw error;
    }
  }

  async exchangeCodeForToken(code: string, state: string): Promise<void> {
    // Retrieve stored code verifier and state
    const [storedCodeVerifier, storedState] = await Promise.all([
      Settings.get("oauthCodeVerifier"),
      Settings.get("oauthState")
    ]);
    
    console.log("Exchange - code verifier found:", !!storedCodeVerifier);
    console.log("Exchange - state found:", !!storedState);
    console.log("Exchange - state match:", storedState === state);
    
    if (!storedCodeVerifier) throw new Error("Code verifier not found");
    if (!storedState || storedState !== state) throw new Error("State mismatch");

    // Manual token exchange to avoid DPoP issues
    const requestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: storedCodeVerifier,
    });
    
    console.log("Token request params:", {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: storedCodeVerifier ? "***EXISTS***" : "NULL",
    });
    
    const tokenResponse = await fetch('https://manager.dmdata.jp/account/oauth2/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", tokenResponse.status, errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    console.log("Token response:", tokens);
    
    if (tokens.refresh_token) {
      console.log("Storing refresh token");
      await Settings.set("oauthRefreshToken", tokens.refresh_token);
      
      // Clear old OAuth2 instance and reinitialize with new token
      this.oauth2 = null;
      await this.init();
      console.log("OAuth2 reinitialized with new refresh token");
    } else {
      console.error("No refresh_token in response");
    }
    
    // Clean up stored values
    await Settings.delete("oauthCodeVerifier");
    await Settings.delete("oauthState");
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async buildAuthorizationUrl(): Promise<string> {
    await this.ensureInitialized();
    if (!this.oauth2) {
      // Reinitialize if cleared
      await this.init();
    }
    if (!this.oauth2) throw new Error("OAuth2 not initialized");

    // Always use manual implementation to ensure state is included
    // Generate PKCE manually if not available
    if (!this.codeChallenge) {
      this.codeVerifier = this.generateCodeVerifier();
      this.codeChallenge = await this.generateCodeChallenge(this.codeVerifier);
      
      // Store code verifier and state for later use
      await Settings.set("oauthCodeVerifier", this.codeVerifier);
      console.log("Auth URL - code verifier stored");
    }

    // Generate state if not available
    if (!this.state) {
      this.state = this.generateState();
      await Settings.set("oauthState", this.state);
      console.log("Auth URL - state stored");
    }
    
    const qp = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPES.join(" "),
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: this.codeChallenge,
      state: this.state,
    });

    return `https://manager.dmdata.jp/account/oauth2/v1/auth?${qp.toString()}`;
  }

  private async init() {
    const [refreshToken, dpopKeypair] = await Promise.all([
      Settings.get("oauthRefreshToken"),
      Settings.get("oauthDPoPKeypair"),
    ]);

    console.log("Init - refresh token exists:", !!refreshToken);
    console.log("Init - dpop keypair exists:", !!dpopKeypair);
    console.log("Init - dpop keypair content:", dpopKeypair ? "***KEYPAIR***" : "null");

    this.oauth2 = new OAuth2Code({
      endpoint: {
        authorization: "https://manager.dmdata.jp/account/oauth2/v1/auth",
        token: "https://manager.dmdata.jp/account/oauth2/v1/token",
        introspect: "https://manager.dmdata.jp/account/oauth2/v1/introspect",
      },
      client: {
        id: CLIENT_ID,
        scopes: [...SCOPES],
        redirectUri: REDIRECT_URI,
      },
      pkce: true,
      refreshToken: refreshToken || undefined,
      // DPoP: Web Crypto APIエラーを回避するため無効化
      // dpop: dpopKeypair || true,
    });

    this.oauth2
      .on("refresh_token", (t) => {
        console.log("Saving new refresh token");
        Settings.set("oauthRefreshToken", t);
      })
      .on("dpop_keypair", (k) => {
        console.log("Saving new DPoP keypair");
        Settings.set("oauthDPoPKeypair", k);
      });

    console.log("OAuth2 instance initialized");
    
    // DPoP: 現在無効化中（Web Crypto APIエラーのため）
    console.log("DPoP is disabled to avoid Web Crypto API errors");
  }
}

let _instance: Oauth2Service | null = null;
export const oauth2 = () => {
  if (typeof window === 'undefined') {
    throw new Error('OAuth2Service can only be used on the client side');
  }
  return (_instance ??= new Oauth2Service());
};
