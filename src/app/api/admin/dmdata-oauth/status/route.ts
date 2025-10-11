// src/app/api/admin/dmdata-oauth/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dmdataOAuth2Server } from "@/app/lib/dmdata/oauth2-server";
import { prisma } from "@/app/lib/db/prisma";

/**
 * DMData.jp OAuth2 認証状態確認API
 * GET /api/admin/dmdata-oauth/status
 */
export async function GET(request: NextRequest) {
  try {
    const oauth2Service = dmdataOAuth2Server();
    const hasValidToken = await oauth2Service.refreshTokenCheck();

    // トークン情報を取得
    const tokenRecord = await prisma.dmdataOAuthToken.findFirst({
      where: {
        refreshToken: {
          not: "",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      isAuthenticated: hasValidToken,
      tokenExists: !!tokenRecord,
      expiresAt: tokenRecord?.expiresAt,
      createdAt: tokenRecord?.createdAt,
    });
  } catch (error) {
    console.error("Failed to check OAuth status:", error);
    return NextResponse.json(
      {
        error: "Failed to check OAuth status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * OAuth2 トークン削除（ログアウト）
 * DELETE /api/admin/dmdata-oauth/status
 */
export async function DELETE(request: NextRequest) {
  try {
    const oauth2Service = dmdataOAuth2Server();
    await oauth2Service.refreshTokenDelete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete OAuth token:", error);
    return NextResponse.json(
      { error: "Failed to delete OAuth token" },
      { status: 500 }
    );
  }
}
