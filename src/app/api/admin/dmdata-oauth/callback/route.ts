// src/app/api/admin/dmdata-oauth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dmdataOAuth2Server } from "@/app/lib/dmdata/oauth2-server";

/**
 * DMData.jp OAuth2 コールバックAPI
 * GET /api/admin/dmdata-oauth/callback?code=xxx&state=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state parameter" },
        { status: 400 }
      );
    }

    const oauth2Service = dmdataOAuth2Server();
    await oauth2Service.exchangeCodeForToken(code, state);

    // 認証成功後、設定ページにリダイレクト
    return NextResponse.redirect(
      new URL("/admin/dmdata-settings?success=true", request.url)
    );
  } catch (error) {
    console.error("OAuth callback failed:", error);

    // エラー時も設定ページにリダイレクト（エラーメッセージ付き）
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.redirect(
      new URL(`/admin/dmdata-settings?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
