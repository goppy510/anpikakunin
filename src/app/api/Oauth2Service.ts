import { OAuth2Code } from "@dmdata/oauth2-client";
import { Settings } from "@/app/lib/db/settings";
import { environment } from "@/environments/environment";

let oauth2: OAuth2Code | undefined;
let refreshToken: string | undefined;

export async function refreshTokenDelete() {
  await Settings.delete("oauthRefreshToken");
  refreshToken = undefined;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return refreshToken;
}

export async function oAuth2ClassReInit() {
  await initOauth2();
}

export async function getAuthorization(): Promise<string> {
  if (!oauth2) {
    await waitForInit();
  }
  return oauth2!.getAuthorization();
}

export async function getDPoPProofJWT(
  method: string,
  uri: string,
  nonce?: string | null
): Promise<string | null> {
  if (!oauth2) {
    await waitForInit();
  }
  return oauth2!.getDPoPProofJWT(method, uri, nonce);
}

export async function refreshTokenCheck(): Promise<boolean> {
  return !!(await Settings.get("oauthRefreshToken"));
}

export async function initOauth2() {
  const storedRefreshToken = await Settings.get("oauthRefreshToken");
  const oauthDPoPKeypair = (await Settings.get("oauthDPoPKeypair")) ?? "ES384";

  oauth2 = new OAuth2Code({
    endpoint: {
      authorization: "https://manager.dmdata.jp/account/oauth2/v1/auth",
      token: "https://manager.dmdata.jp/account/oauth2/v1/token",
      introspect: "https://manager.dmdata.jp/account/oauth2/v1/introspect",
    },
    client: {
      id: "CId.LgawSy4V1SNsimqooHFBiVNvLjdZtS1K5dJL6wyX5gfE",
      scopes: [
        "contract.list",
        "parameter.earthquake",
        "parameter.tsunami",
        "socket.start",
        "telegram.list",
        "telegram.data",
        "telegram.get.earthquake",
        "telegram.get.volcano",
        "telegeram.get.weather",
        "gd.earthquake",
      ],
      redirectUri: environment.OAUTH_REDIRECT_URI,
    },
    pkce: true,
    refreshToken: storedRefreshToken,
    dpop: oauthDPoPKeypair,
  });

  refreshToken = storedRefreshToken;

  oauth2
    .on("refresh_token", (token) => {
      refreshToken = token;
      Settings.set("oauthRefreshToken", token);
    })
    .on("dpop_keypair", (keypair) => Settings.set("oauthDPoPKeypair", keypair));
}

async function waitForInit() {
  let retries = 50;
  while (!oauth2 && retries > 0) {
    await new Promise((res) => setTimeout(res, 100));
    retries--;
  }
  if (!oauth2) throw new Error("OAuth2 not initialized");
}
