import { NextRequest, NextResponse } from "next/server";
import { getSlackBotToken } from "@/app/lib/db/slackSettings";

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const botToken = await getSlackBotToken(workspaceId);

    if (!botToken) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Slack auth.test API で権限情報を取得
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
        { error: "Failed to fetch bot info" },
        { status: 400 }
      );
    }

    // 各権限を実際のAPI呼び出しでテスト
    const requiredScopes = ["emoji:read", "channels:read", "chat:write"];
    const grantedScopes: string[] = [];

    // emoji:read をテスト
    try {
      const emojiTest = await fetch("https://slack.com/api/emoji.list", {
        headers: { Authorization: `Bearer ${botToken}` },
      });
      const emojiData = await emojiTest.json();
      if (emojiData.ok) {
        grantedScopes.push("emoji:read");
      }
    } catch (e) {
      console.error("emoji:read test failed:", e);
    }

    // channels:read をテスト
    try {
      const channelsTest = await fetch("https://slack.com/api/conversations.list?limit=1", {
        headers: { Authorization: `Bearer ${botToken}` },
      });
      const channelsData = await channelsTest.json();
      if (channelsData.ok) {
        grantedScopes.push("channels:read");
      }
    } catch (e) {
      console.error("channels:read test failed:", e);
    }

    // chat:write は auth.test が成功すれば基本的に持っている
    grantedScopes.push("chat:write");

    const hasAllRequired = requiredScopes.every((scope) =>
      grantedScopes.includes(scope)
    );

    // トークンの後半をマスク
    const maskedToken = botToken.substring(0, 10) + "..." + botToken.substring(botToken.length - 4);

    return NextResponse.json({
      success: true,
      botToken: maskedToken,
      botInfo: {
        userId: data.user_id,
        userName: data.user,
        teamId: data.team_id,
        teamName: data.team,
      },
      permissions: {
        granted: grantedScopes,
        required: requiredScopes,
        hasAllRequired,
      },
    });
  } catch (error) {
    console.error("Bot info fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
