import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/app/lib/auth/middleware";
import { deleteSession } from "@/app/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);

    if (token) {
      await deleteSession(token);
    }

    // Cookieを削除
    const response = NextResponse.json({
      message: "ログアウトしました",
    });

    response.cookies.delete("session_token");

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "ログアウト処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
