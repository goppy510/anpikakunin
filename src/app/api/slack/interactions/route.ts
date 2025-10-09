import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Slack署名検証用の関数
function verifySlackSignature(body: string, signature: string, timestamp: string, signingSecret: string): boolean {
  const time = Math.floor(new Date().getTime() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    return false; // リクエストが5分以上古い場合は無効
  }

  const sigBasestring = 'v0:' + timestamp + ':' + body;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Slack署名検証（本番環境では必須）
    // SLACK_SIGNING_SECRETを.envに設定してください
    const slackSignature = request.headers.get('x-slack-signature');
    const timestamp = request.headers.get('x-slack-request-timestamp');
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (signingSecret && slackSignature && timestamp) {
      if (!verifySlackSignature(body, slackSignature, timestamp, signingSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // URLエンコードされたペイロードをパース
    const payload = JSON.parse(decodeURIComponent(body.replace('payload=', '')));
    
    console.log('📨 Slack interaction received:', {
      type: payload.type,
      user: payload.user?.name,
      action: payload.actions?.[0]?.action_id
    });

    // ボタンクリック処理
    if (payload.type === 'block_actions' && payload.actions?.[0]) {
      const action = payload.actions[0];
      const user = payload.user;
      const channel = payload.channel;
      const message = payload.message;

      // 安否確認ボタンかチェック
      if (action.action_id?.startsWith('safety_')) {
        const departmentId = action.action_id.replace('safety_', '');
        
        // ユーザー情報を記録
        const responseData = {
          userId: user.id,
          userName: user.name,
          userRealName: user.profile?.real_name || user.name,
          departmentId: departmentId,
          departmentName: action.text?.text || '不明な部署',
          timestamp: new Date().toISOString(),
          channelId: channel.id,
          messageTs: message.ts
        };

        console.log('✅ 安否確認記録:', responseData);

        // データベースに記録を保存
        try {
          const { SafetyResponseDatabase } = await import('../../../components/safety-confirmation/utils/responseDatabase');
          await SafetyResponseDatabase.saveResponse({
            ...responseData,
            id: `${responseData.userId}_${responseData.departmentId}_${Date.now()}`
          });
        } catch (dbError) {
          console.error('データベース保存エラー:', dbError);
        }

        // メッセージを更新してカウントを増やす
        const updatedBlocks = await updateMessageWithResponse(message.blocks, departmentId, responseData);

        // Slackにレスポンス（メッセージ更新）
        return NextResponse.json({
          response_type: 'in_channel',
          replace_original: true,
          blocks: updatedBlocks
        });
      }
    }

    // その他のインタラクション
    return NextResponse.json({ response_type: 'ephemeral', text: 'インタラクションを処理しました' });

  } catch (error) {
    console.error('Slack interaction処理エラー:', error);
    return NextResponse.json(
      { error: 'インタラクション処理に失敗しました' }, 
      { status: 500 }
    );
  }
}

async function updateMessageWithResponse(blocks: any[], departmentId: string, responseData: any) {
  // メッセージブロックを更新してカウントと応答者を表示
  const updatedBlocks = blocks.map(block => {
    if (block.type === 'actions' && block.elements) {
      return {
        ...block,
        elements: block.elements.map((element: any) => {
          if (element.action_id === `safety_${departmentId}`) {
            // 既存のカウントを取得（テキストから抽出）
            const currentText = element.text.text;
            const countMatch = currentText.match(/\((\d+)\)$/);
            const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
            const newCount = currentCount + 1;

            // ボタンテキストを更新
            const baseText = currentText.replace(/\(\d+\)$/, '');
            return {
              ...element,
              text: {
                ...element.text,
                text: `${baseText}(${newCount})`
              }
            };
          }
          return element;
        })
      };
    }
    return block;
  });

  // 応答者一覧を追加するためのセクションを作成
  const responseSection = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*最新の応答:* ${responseData.userRealName} (${responseData.departmentName}) - ${new Date(responseData.timestamp).toLocaleTimeString('ja-JP')}`
    }
  };

  // 既存の応答セクションを探して更新、なければ追加
  const existingResponseIndex = updatedBlocks.findIndex(block => 
    block.type === 'section' && block.text?.text?.includes('*最新の応答:*')
  );

  if (existingResponseIndex >= 0) {
    updatedBlocks[existingResponseIndex] = responseSection;
  } else {
    updatedBlocks.push(responseSection);
  }

  return updatedBlocks;
}
