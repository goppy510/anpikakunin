// src/app/lib/dmdata/oauth2-server.ts
/**
 * Server-side DMData.jp OAuth2 Service
 * データベースを使用したOAuth2認証管理（IndexedDB不使用）
 */

import { OAuth2Code } from "@dmdata/oauth2-client";
import { prisma } from "@/app/lib/db/prisma";
import { env } from "@/app/lib/env";
import crypto from "crypto";

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

export class DmdataOAuth2ServerService {
  private oauth2: OAuth2Code | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  /**
   * 初期化の完了を待つ
   */
  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * OAuth2インスタンスを取得
   */
  get oauth2Instance(): OAuth2Code | null {
    return this.oauth2;
  }

  /**
   * リフレッシュトークンの存在確認と有効性チェック
   */
  async refreshTokenCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();

      // データベースからトークンを取得
      const tokenRecord = await prisma.dmdataOAuthToken.findFirst({
        orderBy: { createdAt: "desc" },
      });

      if (!tokenRecord?.refreshToken) return false;

      // OAuth2インスタンスで認証テスト
      if (this.oauth2) {
        try {
          const auth = await this.oauth2.getAuthorization();
          return !!auth;
        } catch (error) {
          return false;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * トークン状態のデバッグ情報出力
   */
  async debugTokenStatus(): Promise<void> {
    const tokenRecord = await prisma.dmdataOAuthToken.findFirst({
      orderBy: { createdAt: "desc" },
    });

      "Stored refresh token:",
      tokenRecord?.refreshToken ? "EXISTS" : "NULL"
    );
      "Stored DPoP keypair:",
      tokenRecord?.dpopKeypair ? "EXISTS" : "NULL"
    );

    if (this.oauth2) {
      try {
        const auth = await this.oauth2.getAuthorization();
      } catch (error) {
      }
    }
  }

  /**
   * リフレッシュトークンとOAuth2データを削除
   */
  async refreshTokenDelete(): Promise<void> {
    await this.ensureInitialized();
    try {
      if (this.oauth2) {
        await this.oauth2.revoke();
      }

      // データベースから全OAuth2データを削除
      await prisma.dmdataOAuthToken.deleteMany({});

      // インスタンスをリセット
      this.oauth2 = null;
      this.initPromise = null;

    } catch (error) {
      throw error;
    }
  }

  /**
   * 認可コードをアクセストークンに交換
   */
  async exchangeCodeForToken(code: string, state: string): Promise<void> {
    // データベースから保存された state と code_verifier を取得
    const tokenRecord = await prisma.dmdataOAuthToken.findFirst({
      where: {
        state: state,
      },
      orderBy: { createdAt: "desc" },
    });


    if (!tokenRecord?.codeVerifier)
      throw new Error("Code verifier not found");
    if (!tokenRecord.state || tokenRecord.state !== state)
      throw new Error("State mismatch");

    // 手動でトークン交換（DPoP問題回避）
    const requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: tokenRecord.codeVerifier,
    });

      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: tokenRecord.codeVerifier ? "***EXISTS***" : "NULL",
    });

    const tokenResponse = await fetch(
      "https://manager.dmdata.jp/account/oauth2/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody,
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(
        `Token exchange failed: ${tokenResponse.status} ${errorText}`
      );
    }

    const tokens = await tokenResponse.json();

    if (tokens.refresh_token) {

      // 既存レコードを更新または新規作成
      if (tokenRecord) {
        await prisma.dmdataOAuthToken.update({
          where: { id: tokenRecord.id },
          data: {
            refreshToken: tokens.refresh_token,
            codeVerifier: null, // 使用済みなのでクリア
            state: null, // 使用済みなのでクリア
            expiresAt: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000)
              : null,
          },
        });
      } else {
        await prisma.dmdataOAuthToken.create({
          data: {
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000)
              : null,
          },
        });
      }

      // OAuth2インスタンスを再初期化
      this.oauth2 = null;
      await this.init();
    } else {
    }
  }

  /**
   * PKCE Code Verifierを生成
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * OAuth Stateを生成
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString("base64url");
  }

  /**
   * PKCE Code Challengeを生成
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = crypto.createHash("sha256").update(verifier).digest();
    return hash.toString("base64url");
  }

  /**
   * 認可URLを構築
   */
  async buildAuthorizationUrl(): Promise<string> {
    await this.ensureInitialized();
    if (!this.oauth2) {
      await this.init();
    }
    if (!this.oauth2) throw new Error("OAuth2 not initialized");

    // PKCE パラメータを生成
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    // 古い一時レコード（temp_で始まるもの）を削除
    await prisma.dmdataOAuthToken.deleteMany({
      where: {
        refreshToken: {
          startsWith: "temp_",
        },
      },
    });

    // データベースに保存（認可コード交換時に使用）
    // 一意制約のため、一時的なUUIDを使用
    const tempToken = `temp_${crypto.randomUUID()}`;
    await prisma.dmdataOAuthToken.create({
      data: {
        refreshToken: tempToken,
        codeVerifier: codeVerifier,
        state: state,
      },
    });


    const qp = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPES.join(" "),
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      state: state,
    });

    return `https://manager.dmdata.jp/account/oauth2/v1/auth?${qp.toString()}`;
  }

  /**
   * OAuth2インスタンスを初期化
   */
  private async init() {
    // データベースから最新のトークンを取得
    const tokenRecord = await prisma.dmdataOAuthToken.findFirst({
      where: {
        refreshToken: {
          not: "",
        },
      },
      orderBy: { createdAt: "desc" },
    });


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
      refreshToken: tokenRecord?.refreshToken || undefined,
      // DPoP: Web Crypto APIエラーを回避するため無効化
      // dpop: tokenRecord?.dpopKeypair || true,
    });

    this.oauth2
      .on("refresh_token", async (t) => {
        // 最新のレコードを更新
        const latest = await prisma.dmdataOAuthToken.findFirst({
          where: {
            refreshToken: {
              not: "",
            },
          },
          orderBy: { createdAt: "desc" },
        });
        if (latest) {
          await prisma.dmdataOAuthToken.update({
            where: { id: latest.id },
            data: { refreshToken: t },
          });
        }
      })
      .on("dpop_keypair", async (k) => {
        const latest = await prisma.dmdataOAuthToken.findFirst({
          where: {
            refreshToken: {
              not: "",
            },
          },
          orderBy: { createdAt: "desc" },
        });
        if (latest) {
          await prisma.dmdataOAuthToken.update({
            where: { id: latest.id },
            data: { dpopKeypair: k as any },
          });
        }
      });

  }
}

// シングルトンインスタンス（サーバーサイド用）
let _serverInstance: DmdataOAuth2ServerService | null = null;

export const dmdataOAuth2Server = () => {
  return (_serverInstance ??= new DmdataOAuth2ServerService());
};
