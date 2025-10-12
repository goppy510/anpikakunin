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

    // Slack conversations.list API - ページネーション対応
    // Note: private_channelを含めるにはgroups:readスコープが必要
    let allChannels: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL("https://slack.com/api/conversations.list");
      url.searchParams.set("types", "public_channel");
      url.searchParams.set("exclude_archived", "true");
      url.searchParams.set("limit", "200");
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!data.ok) {
        let errorMessage = `チャンネル取得エラー: ${data.error}`;
        if (data.error === "missing_scope") {
          errorMessage = "Bot Tokenに必要な権限がありません。Slack Appの設定で「channels:read」と「groups:read」スコープを追加してください。";
        }
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      allChannels = allChannels.concat(data.channels || []);

      // ページネーションの確認
      if (data.response_metadata?.next_cursor) {
        cursor = data.response_metadata.next_cursor;
      } else {
        hasMore = false;
      }
    }

    // チャンネル情報を整形
    const channels = allChannels.map((channel: any) => ({
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
    return NextResponse.json(
      {
        error: "チャンネルの取得に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
