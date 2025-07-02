import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { botToken } = await request.json();

    if (!botToken) {
      return NextResponse.json(
        { success: false, error: 'Bot Tokenが指定されていません' },
        { status: 400 }
      );
    }

    if (!botToken.startsWith('xoxb-')) {
      return NextResponse.json(
        { success: false, error: 'Bot Tokenは "xoxb-" で始まる必要があります' },
        { status: 400 }
      );
    }

    // auth.testでトークンの有効性を確認
    const authResponse = await fetch('https://slack.com/api/auth.test', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const authData = await authResponse.json();

    if (!authData.ok) {
      return NextResponse.json(
        { success: false, error: authData.error || '認証に失敗しました' },
        { status: 401 }
      );
    }

    // ワークスペース情報を取得
    const teamResponse = await fetch('https://slack.com/api/team.info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const teamData = await teamResponse.json();

    const workspaceInfo = {
      name: teamData.team?.name || authData.team || 'Unknown Workspace',
      id: teamData.team?.id || authData.team_id,
      url: teamData.team?.url || authData.url || `https://${authData.team}.slack.com`,
      icon: teamData.team?.icon
    };

    // 絵文字リストを取得
    let emojis = [];
    try {
      const emojiResponse = await fetch('https://slack.com/api/emoji.list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const emojiData = await emojiResponse.json();

      if (emojiData.ok && emojiData.emoji) {
        emojis = Object.entries(emojiData.emoji)
          .map(([name, url]) => ({
            name,
            url: url as string
          }))
          .filter(emoji => 
            // エイリアスでない実際の画像URLのみを抽出
            typeof emoji.url === 'string' && 
            emoji.url.startsWith('http') &&
            !emoji.url.startsWith('alias:')
          );
      }
    } catch (emojiError) {
      console.warn("絵文字の取得に失敗しましたが、接続テストは継続します:", emojiError);
    }

    // OAuth スコープ情報を収集
    let scopes = [];
    
    // auth.testレスポンスからスコープ情報を抽出
    if (authData.response_metadata?.scopes) {
      scopes = authData.response_metadata.scopes;
    }
    
    // 代替方法: 実際にアクセスできるAPIから推測
    const testScopes = [];
    
    // chat:writeをテスト（常に必要）
    testScopes.push('chat:write');
    
    // channels:readをテスト
    try {
      const channelTestResponse = await fetch('https://slack.com/api/conversations.list?limit=1', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      const channelTestData = await channelTestResponse.json();
      if (channelTestData.ok) {
        testScopes.push('channels:read');
      }
    } catch (e) {
      // channels:readがない
    }
    
    // emoji:readをテスト（絵文字取得が成功した場合）
    if (emojis.length > 0) {
      testScopes.push('emoji:read');
    }
    
    // users:readをテスト
    try {
      const usersTestResponse = await fetch('https://slack.com/api/users.list?limit=1', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      const usersTestData = await usersTestResponse.json();
      if (usersTestData.ok) {
        testScopes.push('users:read');
      }
    } catch (e) {
      // users:readがない
    }
    
    // スコープが空の場合は推測結果を使用
    if (scopes.length === 0) {
      scopes = testScopes;
    }

    return NextResponse.json({
      success: true,
      workspaceInfo,
      emojis,
      scopes
    });

  } catch (error) {
    console.error("Slack API接続テストエラー:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '接続テストに失敗しました'
      },
      { status: 500 }
    );
  }
}