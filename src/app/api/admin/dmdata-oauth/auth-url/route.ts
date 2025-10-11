// src/app/api/admin/dmdata-oauth/auth-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dmdataOAuth2Server } from "@/app/lib/dmdata/oauth2-server";

/**
 * DMData.jp OAuth2 認証URL取得API
 * GET /api/admin/dmdata-oauth/auth-url
 */
export async function GET(request: NextRequest) {
  try {
    const oauth2Service = dmdataOAuth2Server();
    const authUrl = await oauth2Service.buildAuthorizationUrl();

    return NextResponse.json({
      authUrl,
    });
  } catch (error) {
    console.error("Failed to build authorization URL:", error);
    return NextResponse.json(
      {
        error: "Failed to build authorization URL",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
