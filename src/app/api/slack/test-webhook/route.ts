import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { webhookUrl, testMessage = 'Webhook接続テスト' } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: 'Webhook URLが指定されていません' },
        { status: 400 }
      );
    }

    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      return NextResponse.json(
        { success: false, error: 'Webhook URLが正しくありません' },
        { status: 400 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: testMessage,
        username: '安否確認システム（テスト）'
      })
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Webhook テスト失敗: ${response.status} ${response.statusText}`
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Webhook テストエラー:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook テストエラー'
      },
      { status: 500 }
    );
  }
}