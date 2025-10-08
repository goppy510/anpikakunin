import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/middleware";
import { getSlackBotToken } from "@/app/lib/db/slackSettings";

/**
 * Slackワークスペースのチャンネル一覧を取得
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

    // Slack conversations.list API
    const response = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: `チャンネル取得エラー: ${data.error}` },
        { status: 400 }
      );
    }

    // チャンネル情報を整形
    const channels = (data.channels || []).map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private,
      isMember: channel.is_member,
    }));

    return NextResponse.json({
      channels,
      count: channels.length,
    });
  } catch (error) {
    console.error("チャンネル取得エラー:", error);
    return NextResponse.json(
      { error: "チャンネルの取得に失敗しました" },
      { status: 500 }
    );
  }
}
