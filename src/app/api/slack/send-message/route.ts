import { NextRequest, NextResponse } from 'next/server';

// ボタン方式を使用するため、リアクション追加関数は削除

export async function POST(request: NextRequest) {
  try {
    const { botToken, channelId, title, message, isTraining = false, departments = [] } = await request.json();
    
    console.log('リクエストデータ:', { 
      botToken: botToken ? 'あり' : 'なし', 
      channelId, 
      title, 
      isTraining,
      departmentsCount: departments?.length || 0,
      departments
    });

    if (!botToken || !channelId || !message) {
      return NextResponse.json({
        success: false,
        error: 'botToken、channelId、messageは必須です'
      }, { status: 400 });
    }

    // 訓練モードの場合はメッセージをフォーマット
    const formattedTitle = isTraining ? `【訓練です】 ${title} 【訓練です】` : title;
    const formattedMessage = isTraining ? `【訓練です】\n\n${message}\n\n【訓練です】` : message;

    // Slack API ペイロード作成
    const payload: any = {
      channel: channelId,
      text: formattedTitle,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: formattedTitle
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: formattedMessage
          }
        }
      ]
    };

    // 部署ボタンがある場合は追加
    if (departments && departments.length > 0) {
      const buttons = departments.map(dept => ({
        type: "button",
        text: {
          type: "plain_text",
          text: `${dept.emoji} ${dept.name}`,
          emoji: true
        },
        action_id: `safety_${dept.id}`,
        value: JSON.stringify({
          departmentId: dept.id,
          departmentName: dept.name,
          emoji: dept.emoji
        }),
        style: undefined
      }));
      
      payload.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*安否確認（該当部署のボタンを押してください）*\n\n⚠️ 一人一回のみ回答可能です"
        }
      });
      
      payload.blocks.push({
        type: "actions",
        elements: buttons
      });
    }

    // Slack API呼び出し
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Slack API応答:', { 
      ok: data.ok, 
      ts: data.ts, 
      error: data.error,
      fullResponse: data
    });

    if (!data.ok) {
      let errorMessage = data.error || 'メッセージ送信に失敗しました';
      
      // エラーメッセージを日本語で説明
      if (data.error === 'channel_not_found') {
        errorMessage = 'チャンネルが見つかりません。チャンネルIDが正しいか、またはボットがチャンネルに招待されているか確認してください。';
      } else if (data.error === 'not_in_channel') {
        errorMessage = 'ボットがチャンネルに招待されていません。チャンネルにボットを招待してください。';
      } else if (data.error === 'missing_scope') {
        errorMessage = 'Bot Tokenに必要な権限がありません。chat:writeスコープを追加してください。';
      } else if (data.error === 'invalid_auth') {
        errorMessage = 'Bot Tokenが無効です。接続確認をやり直してください。';
      }
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
        originalError: data.error
      }, { status: 400 });
    }

    // ボタン方式のため、リアクション追加は不要

    return NextResponse.json({
      success: true,
      messageTs: data.ts,
      channel: data.channel
    });

  } catch (error) {
    console.error('Slack メッセージ送信エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'サーバーエラーが発生しました'
    }, { status: 500 });
  }
}