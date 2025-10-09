import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { botToken, channelId } = await request.json();

    if (!botToken) {
      return NextResponse.json(
        { success: false, error: 'Bot Tokenが指定されていません' },
        { status: 400 }
      );
    }

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'チャンネルIDが指定されていません' },
        { status: 400 }
      );
    }

    const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(
        { success: false, error: data.error || 'チャンネル情報の取得に失敗' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      channelName: data.channel?.name || 'Unknown Channel',
      isPrivate: data.channel?.is_private || false
    });

  } catch (error) {
    console.error("チャンネル情報取得エラー:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'チャンネル情報取得エラー'
      },
      { status: 500 }
    );
  }
}