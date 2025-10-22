import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/auth/middleware";

/**
 * Slack Bot Tokenの接続テスト
 * auth.test APIを使用してワークスペース情報を取得
 */
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, ["slack:workspace:write"]);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { botToken } = await request.json();

    if (!botToken) {
      return NextResponse.json(
        { error: "botTokenは必須です" },
        { status: 400 }
      );
    }

    // Slack auth.test API
    const response = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error === "invalid_auth"
            ? "Bot Tokenが無効です"
            : `接続エラー: ${data.error}`,
        },
        { status: 400 }
      );
    }

    // 成功時のレスポンス
    return NextResponse.json({
      success: true,
      workspace: {
        id: data.team_id,
        name: data.team,
        url: data.url,
        botUserId: data.user_id,
        botUserName: data.user,
      },
    });
  } catch (error) {
    console.error("Slack接続テストエラー:", error);
    return NextResponse.json(
      { success: false, error: "接続テストに失敗しました" },
      { status: 500 }
    );
  }
}
