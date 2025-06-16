// src/app/api/Oauth2Service.ts
"use client";

import { OAuth2Code, Keypair } from "@dmdata/oauth2-client";
import { Settings } from "@/app/lib/db/settings";
import { env } from "@/app/lib/env";

// ==== アプリ側で保持する定数 ====
const CLIENT_ID = "CId.xyw6-lPflvaxR9CrGR-zHBfGJ_8dUmVtai_61qRSplwM";
const REDIRECT_URI = env.NEXT_PUBLIC_OAUTH_REDIRECT_URI; // .env.* で定義
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
  /* … 省略（前回と同じ） … */

  /** ---- 認可 URL を生成 ---- */
  buildAuthorizationUrl(): string {
    if (!this.oauth2) throw new Error("OAuth2 not initialized");

    /* v1.4 以降なら SDK の util を優先 */
    const authUriFn = (this.oauth2 as any).authorizationUri;
    if (typeof authUriFn === "function") return authUriFn();

    /* util が無い場合は自前で組み立てる */
    const qp = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPES.join(" "),
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: (this.oauth2 as any).pkce?.codeChallenge ?? "",
    });

    return `https://manager.dmdata.jp/account/oauth2/v1/auth?${qp.toString()}`;
  }

  /* ---- init() 内の生成も定数を使用 ---- */
  private async init() {
    const [refreshToken, dpopKeypair] = await Promise.all([
      Settings.get("oauthRefreshToken"),
      Settings.get("oauthDPoPKeypair").then((k) => k ?? ("ES384" as Keypair)),
    ]);

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
      dpop: dpopKeypair,
    });

    this.oauth2
      .on("refresh_token", (t) => Settings.set("oauthRefreshToken", t))
      .on("dpop_keypair", (k) => Settings.set("oauthDPoPKeypair", k));
  }
}

/* シングルトン helper はそのまま */
let _instance: Oauth2Service | null = null;
export const oauth2 = () => (_instance ??= new Oauth2Service());
