import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/middleware";
import { getSlackBotToken } from "@/app/lib/db/slackSettings";

/**
 * Slackワークスペースのカスタム絵文字一覧を取得
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const botToken = searchParams.get("botToken");

    let token = botToken;

    // workspaceIdが指定されている場合はDBから取得
    if (workspaceId && !botToken) {
      token = await getSlackBotToken(workspaceId);
    }

    if (!token) {
      return NextResponse.json(
        { error: "botTokenまたはworkspaceIdが必要です" },
        { status: 400 }
      );
    }

    // Slack emoji.list API
    const response = await fetch("https://slack.com/api/emoji.list", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: `絵文字取得エラー: ${data.error}` },
        { status: 400 }
      );
    }

    // カスタム絵文字のみ抽出（標準絵文字を除外）
    const customEmojis = Object.entries(data.emoji || {}).map(
      ([name, url]) => ({
        name,
        url: typeof url === "string" ? url : "",
      })
    );

    return NextResponse.json({
      emojis: customEmojis,
      count: customEmojis.length,
    });
  } catch (error) {
    console.error("絵文字取得エラー:", error);
    return NextResponse.json(
      { error: "絵文字の取得に失敗しました" },
      { status: 500 }
    );
  }
}
