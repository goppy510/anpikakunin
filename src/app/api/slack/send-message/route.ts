import { NextRequest, NextResponse } from 'next/server';
import { getSlackBotToken } from "@/app/lib/db/slackSettings";

// ボタン方式を使用するため、リアクション追加関数は削除

export async function POST(request: NextRequest) {
  try {
    const { botToken, workspaceId, channelId, title, message, isTraining = false, departments = [] } = await request.json();

    // workspaceId が指定されている場合は DB から botToken を取得
    let resolvedBotToken = botToken;
    if (workspaceId && !botToken) {
      resolvedBotToken = await getSlackBotToken(workspaceId);
      if (!resolvedBotToken) {
        return NextResponse.json({
          success: false,
          error: 'ワークスペースのBotTokenが見つかりません'
        }, { status: 404 });
      }
    }

    if (!resolvedBotToken || !channelId || !message) {
      return NextResponse.json({
        success: false,
        error: 'botTokenまたはworkspaceId、channelId、messageは必須です'
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
      const buttons = departments.map((dept: any) => {
        // slackEmojiプロパティから適切な表示を決定
        const emojiDisplay = dept.slackEmoji?.url 
          ? `:${dept.slackEmoji.name}:` 
          : (dept.slackEmoji?.name ? `:${dept.slackEmoji.name}:` : '');
        
        return {
          type: "button",
          text: {
            type: "plain_text",
            text: `${emojiDisplay} ${dept.name}`,
            emoji: true
          },
          action_id: `safety_${dept.id}`,
          value: JSON.stringify({
            departmentId: dept.id,
            departmentName: dept.name,
            emoji: emojiDisplay,
            slackEmoji: dept.slackEmoji
          }),
          style: undefined
        };
      });
      
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
        'Authorization': `Bearer ${resolvedBotToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

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