/**
 * 安否確認システム - Google Apps Script
 * Slack Interactionsを受信してスプレッドシートに記録
 */

// 設定
const CONFIG = {
  // スプレッドシートID（新規作成後に更新してください）
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  
  // シート名
  TRAINING_SHEET: '訓練用応答',
  PRODUCTION_SHEET: '本番用応答',
  
  // Slack設定（Slackアプリの設定から取得）
  SLACK_SIGNING_SECRET: 'YOUR_SLACK_SIGNING_SECRET',
  SLACK_BOT_TOKEN: 'YOUR_SLACK_BOT_TOKEN_HERE'  // ボタンカウント更新用
};

/**
 * Slack Events/Interactionsを受信する関数
 */
function doPost(e) {
  try {
    console.log('Slack要求受信:', e.postData.contents);
    
    // Content-Typeによって処理を分岐
    const contentType = e.postData.type;
    
    if (contentType === 'application/json') {
      // Events API (リアクション)
      const eventData = JSON.parse(e.postData.contents);
      
      // URL verification challenge
      if (eventData.type === 'url_verification') {
        return ContentService
          .createTextOutput(eventData.challenge)
          .setMimeType(ContentService.MimeType.TEXT);
      }
      
      // リアクション追加イベント
      if (eventData.type === 'event_callback' && 
          eventData.event.type === 'reaction_added') {
        return handleReactionAdded(eventData.event);
      }
      
    } else {
      // Interactive Components (ボタン処理)
      const payload = JSON.parse(e.parameter.payload);
      
      if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
        const action = payload.actions[0];
        
        if (action.action_id && action.action_id.startsWith('safety_')) {
          return handleSafetyResponse(payload);
        }
      }
    }
    
    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
      
  } catch (error) {
    console.error('エラー:', error);
    return ContentService
      .createTextOutput('Error: ' + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * リアクション追加イベントを処理
 */
function handleReactionAdded(event) {
  try {
    console.log('=== リアクション追加イベント ===');
    console.log('イベント:', JSON.stringify(event, null, 2));
    
    const { user, reaction, item } = event;
    const channelId = item.channel;
    const messageTs = item.ts;
    
    console.log('リアクション情報:', { userId: user, reaction, channelId, messageTs });
    
    // ボットのリアクションは記録しない
    if (isBotUser(user)) {
      console.log('ボットのリアクションのためスキップ:', user);
      return ContentService
        .createTextOutput('OK')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    // 安否確認メッセージかどうかを判定
    if (!isSafetyConfirmationMessage(channelId, messageTs)) {
      console.log('安否確認メッセージではないためスキップ');
      return ContentService
        .createTextOutput('OK')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    // 部署絵文字かどうかを判定
    const departmentInfo = getDepartmentByEmoji(reaction);
    if (!departmentInfo) {
      console.log('部署絵文字ではないためスキップ:', reaction);
      return ContentService
        .createTextOutput('OK')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    console.log('部署情報:', departmentInfo);
    
    // ユーザー情報を取得
    const userInfo = getUserInfo(user);
    
    // 訓練用か本番用かを判定
    const isTraining = isTrainingMessage(channelId, messageTs);
    const sheetName = isTraining ? CONFIG.TRAINING_SHEET : CONFIG.PRODUCTION_SHEET;
    
    console.log('メッセージ種別:', { isTraining, sheetName });
    
    // スプレッドシートに記録
    recordResponse({
      timestamp: new Date(),
      userId: user,
      userName: userInfo.name || user,
      userRealName: userInfo.real_name || userInfo.name || user,
      departmentName: `${departmentInfo.emoji} ${departmentInfo.name}`,
      emoji: departmentInfo.emoji,
      channelId: channelId,
      channelName: getChannelName(channelId),
      messageTs: messageTs,
      isTraining: isTraining
    }, sheetName);
    
    console.log('=== リアクション処理完了 ===');
    
    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    console.error('リアクション処理エラー:', error);
    return ContentService
      .createTextOutput('Error: ' + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * 安否確認応答を処理
 */
function handleSafetyResponse(payload) {
  try {
    console.log('=== handleSafetyResponse 開始 ===');
    
    const action = payload.actions[0];
    const user = payload.user;
    const channel = payload.channel;
    const message = payload.message;
    
    // ボタンの値を解析
    const buttonValue = JSON.parse(action.value || '{}');
    const departmentId = buttonValue.departmentId || action.action_id.replace('safety_', '');
    const departmentName = buttonValue.departmentName || departmentId;
    const emoji = buttonValue.emoji || '';
    
    console.log('部署情報:', { departmentId, departmentName, emoji });
    
    // 訓練用か本番用かを判定
    const isTraining = message.text && message.text.includes('訓練');
    const sheetName = isTraining ? CONFIG.TRAINING_SHEET : CONFIG.PRODUCTION_SHEET;
    
    // 重複チェック
    if (isDuplicateResponseByDepartment(user.id, message.ts, channel.id, departmentId)) {
      console.log('重複応答を検出:', user.name, '部署:', departmentId);
      // 重複の場合はSlackに即座に応答を返して処理終了
      return ContentService
        .createTextOutput('')
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    // スプレッドシートに記録
    recordResponse({
      timestamp: new Date(),
      userId: user.id,
      userName: user.name,
      userRealName: user.profile?.real_name || user.name,
      departmentId: departmentId,
      departmentName: departmentName,
      emoji: emoji,
      channelId: channel.id,
      channelName: channel.name,
      messageTs: message.ts,
      isTraining: isTraining
    }, sheetName);
    
    console.log('スプレッドシート記録完了');
    
    // Slackには空の応答を返す
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    console.error('安否確認応答処理エラー:', error);
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * エフェメラルメッセージを送信（本人のみに表示）
 */
function sendEphemeralMessage(channelId, userId, text) {
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      console.warn('Bot Tokenが設定されていないため、エフェメラルメッセージをスキップ');
      return;
    }
    
    const payload = {
      'channel': channelId,
      'user': userId,
      'text': text
    };
    
    const options = {
      'method': 'POST',
      'headers': {
        'Authorization': 'Bearer ' + botToken,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      'payload': Object.keys(payload).map(key => 
        encodeURIComponent(key) + '=' + encodeURIComponent(payload[key])
      ).join('&')
    };
    
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.postEphemeral', options);
    const data = JSON.parse(response.getContentText());
    
    if (!data.ok) {
      console.error('エフェメラルメッセージ送信失敗:', data.error);
    } else {
      console.log('エフェメラルメッセージ送信成功');
    }
    
  } catch (error) {
    console.error('エフェメラルメッセージ送信エラー:', error);
  }
}

/**
 * 部署IDとユーザーIDでの重複応答をチェック
 */
function isDuplicateResponseByDepartment(userId, messageTs, channelId, departmentId) {
  try {
    console.log('=== 重複チェック開始 ===');
    console.log('チェック対象:', { userId, messageTs, channelId, departmentId });
    
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // 訓練用と本番用の両方をチェック
    const sheets = [
      spreadsheet.getSheetByName(CONFIG.TRAINING_SHEET),
      spreadsheet.getSheetByName(CONFIG.PRODUCTION_SHEET)
    ].filter(sheet => sheet !== null);
    
    for (const sheet of sheets) {
      console.log('チェック中のシート:', sheet.getName());
      const data = sheet.getDataRange().getValues();
      const responses = data.slice(1); // ヘッダー行を除く
      
      console.log('レスポンス件数:', responses.length);
      
      for (let i = 0; i < responses.length; i++) {
        const row = responses[i];
        const rowUserId = String(row[1]);        // ユーザーID列
        const rowMessageTs = String(row[9]);     // メッセージTS列
        const rowChannelId = String(row[7]);     // チャンネルID列
        const rowDepartmentId = String(row[4]);  // 部署ID列
        
        console.log(`行${i + 2}:`, {
          rowUserId, rowMessageTs, rowChannelId, rowDepartmentId
        });
        
        if (rowUserId === String(userId) && 
            rowMessageTs === String(messageTs) && 
            rowChannelId === String(channelId) &&
            rowDepartmentId === String(departmentId)) {
          console.log('重複発見！行:', i + 2);
          return true; // 同じ部署での重複発見
        }
      }
    }
    
    console.log('重複なし');
    return false; // 重複なし
    
  } catch (error) {
    console.error('重複チェックエラー:', error);
    return false; // エラー時は重複なしとして処理続行
  }
}

/**
 * 重複応答をチェック（旧関数 - 互換性のため残す）
 */
function isDuplicateResponse(userId, messageTs, channelId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // 訓練用と本番用の両方をチェック
    const sheets = [
      spreadsheet.getSheetByName(CONFIG.TRAINING_SHEET),
      spreadsheet.getSheetByName(CONFIG.PRODUCTION_SHEET)
    ].filter(sheet => sheet !== null);
    
    for (const sheet of sheets) {
      const data = sheet.getDataRange().getValues();
      const responses = data.slice(1); // ヘッダー行を除く
      
      for (const row of responses) {
        const rowUserId = String(row[1]);     // ユーザーID列
        const rowMessageTs = String(row[9]);  // メッセージTS列（新しい列番号）
        const rowChannelId = String(row[7]);  // チャンネルID列（新しい列番号）
        
        if (rowUserId === String(userId) && 
            rowMessageTs === String(messageTs) && 
            rowChannelId === String(channelId)) {
          return true; // 重複発見
        }
      }
    }
    
    return false; // 重複なし
    
  } catch (error) {
    console.error('重複チェックエラー:', error);
    return false; // エラー時は重複なしとして処理続行
  }
}

/**
 * スプレッドシートに応答を記録
 */
function recordResponse(responseData, sheetName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      
      // ヘッダー行を追加
      sheet.getRange(1, 1, 1, 10).setValues([[
        '日時',
        'ユーザーID', 
        'ユーザー名',
        '実名',
        '部署ID',
        '部署名',
        '絵文字',
        'チャンネルID',
        'チャンネル名',
        'メッセージTS'
      ]]);
      
      // ヘッダー行のスタイル設定
      const headerRange = sheet.getRange(1, 1, 1, 10);
      headerRange.setBackground('#4A90E2');
      headerRange.setFontColor('white');
      headerRange.setFontWeight('bold');
    }
    
    // データを追加
    sheet.appendRow([
      responseData.timestamp,
      responseData.userId,
      responseData.userName,
      responseData.userRealName,
      responseData.departmentId,
      responseData.departmentName,
      responseData.emoji,
      responseData.channelId,
      responseData.channelName,
      responseData.messageTs
    ]);
    
    console.log(`応答を記録しました: ${responseData.userRealName} → ${responseData.departmentName} (${sheetName})`);
    
  } catch (error) {
    console.error('スプレッドシート記録エラー:', error);
    throw error;
  }
}

/**
 * Slackボタンのカウントを更新
 */
function updateButtonCounts(payload, clickedDepartmentId) {
  try {
    console.log('=== updateButtonCounts 開始 ===');
    const channel = payload.channel;
    const message = payload.message;
    const messageTs = message.ts;
    
    console.log('メッセージ情報:', { channelId: channel.id, messageTs });
    
    // 現在のメッセージのボタンカウントを取得・更新
    console.log('ブロック更新開始');
    const updatedBlocks = updateMessageBlocks(message.blocks, clickedDepartmentId, messageTs, channel.id);
    
    console.log('更新されたブロック:', JSON.stringify(updatedBlocks, null, 2));
    
    // Slack APIでメッセージを更新（別途API呼び出し）
    console.log('Slackメッセージ更新開始');
    updateSlackMessage(channel.id, messageTs, updatedBlocks);
    
    console.log('=== updateButtonCounts 完了 ===');
      
  } catch (error) {
    console.error('ボタンカウント更新エラー:', error);
  }
}

/**
 * メッセージのブロックを更新してカウントを増やす
 */
function updateMessageBlocks(blocks, clickedDepartmentId, messageTs, channelId) {
  try {
    // 部署別カウントを取得
    const departmentCounts = getDepartmentCountsFromSheet(messageTs, channelId);
    
    console.log('取得したカウント:', departmentCounts);
    
    return blocks.map(block => {
      if (block.type === 'actions' && block.elements) {
        block.elements = block.elements.map(element => {
          if (element.action_id && element.action_id.startsWith('safety_')) {
            const deptId = element.action_id.replace('safety_', '');
            // カウントが0の場合でも正しく表示
            const count = departmentCounts[deptId] !== undefined ? departmentCounts[deptId] : 0;
            
            console.log(`部署 ${deptId} のカウント: ${count}`);
            
            // ボタンテキストを更新（例: "🏢 総務部 (3)"）
            const buttonValue = JSON.parse(element.value || '{}');
            const emoji = buttonValue.emoji || '';
            const deptName = buttonValue.departmentName || deptId;
            
            element.text.text = `${emoji} ${deptName} (${count})`;
            console.log(`更新後テキスト: ${element.text.text}`);
          }
          return element;
        });
      }
      return block;
    });
    
  } catch (error) {
    console.error('ブロック更新エラー:', error);
    return blocks;
  }
}

/**
 * 応答済みユーザーのリストを取得
 */
function getRespondedUsers(messageTs, channelId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    const sheets = [
      spreadsheet.getSheetByName(CONFIG.TRAINING_SHEET),
      spreadsheet.getSheetByName(CONFIG.PRODUCTION_SHEET)
    ].filter(sheet => sheet !== null);
    
    const respondedUsers = new Set();
    
    sheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      const responses = data.slice(1);
      
      responses.forEach(row => {
        const rowMessageTs = String(row[9]); // メッセージTS列（新しい列番号）
        const rowChannelId = String(row[7]);  // チャンネルID列（新しい列番号）
        const userId = String(row[1]);
        
        if (rowMessageTs === String(messageTs) && rowChannelId === String(channelId)) {
          respondedUsers.add(userId);
        }
      });
    });
    
    return Array.from(respondedUsers);
    
  } catch (error) {
    console.error('応答済みユーザー取得エラー:', error);
    return [];
  }
}

/**
 * スプレッドシートから部署別カウントを取得（重複除去）
 */
function getDepartmentCountsFromSheet(messageTs, channelId) {
  try {
    console.log('=== カウント取得開始 ===');
    console.log('検索条件:', { messageTs, channelId });
    
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // 訓練用と本番用の両方をチェック
    const sheets = [
      spreadsheet.getSheetByName(CONFIG.TRAINING_SHEET),
      spreadsheet.getSheetByName(CONFIG.PRODUCTION_SHEET)
    ].filter(sheet => sheet !== null);
    
    console.log('検索対象シート数:', sheets.length);
    
    const counts = {};
    const uniqueUsers = new Set(); // 重複応答を防ぐため
    
    sheets.forEach(sheet => {
      console.log('シート検索中:', sheet.getName());
      const data = sheet.getDataRange().getValues();
      const responses = data.slice(1); // ヘッダー行を除く
      
      console.log('データ行数:', responses.length);
      
      responses.forEach((row, index) => {
        const rowMessageTs = String(row[9]); // メッセージTS列（新しい列番号）
        const rowChannelId = String(row[7]);  // チャンネルID列（新しい列番号）
        const userId = String(row[1]);        // ユーザーID列
        const departmentId = String(row[4]);  // 部署ID列（新しく追加）
        
        console.log(`行${index + 2}:`, { rowMessageTs, rowChannelId, userId, departmentId });
        
        if (rowMessageTs === String(messageTs) && rowChannelId === String(channelId)) {
          console.log('条件一致:', { userId, departmentId });
          
          // 同一ユーザーの重複応答をチェック
          const userKey = `${userId}_${messageTs}_${channelId}`;
          if (uniqueUsers.has(userKey)) {
            console.log('重複応答をスキップ:', userId);
            return;
          }
          uniqueUsers.add(userKey);
          
          // 部署IDを直接使用
          console.log('部署IDでカウント:', { departmentId });
          
          counts[departmentId] = (counts[departmentId] || 0) + 1;
        }
      });
    });
    
    console.log('最終カウント:', counts);
    console.log('=== カウント取得完了 ===');
    return counts;
    
  } catch (error) {
    console.error('カウント取得エラー:', error);
    return {};
  }
}

/**
 * 部署名から部署IDを抽出
 */
function extractDepartmentId(departmentName) {
  if (!departmentName) return 'unknown';
  
  // 絵文字を除去して正規化
  const cleaned = departmentName
    .replace(/^[\u{1F000}-\u{1FFFF}]\s*/u, '') // 絵文字除去
    .trim()
    .toLowerCase();
  
  // 部署名マッピング
  const mappings = {
    '総務部': 'general',
    '営業部': 'sales', 
    '技術部': 'tech',
    '人事部': 'hr',
    'コーポレート': 'corporate',
    'saas': 'saas'
  };
  
  return mappings[cleaned] || cleaned.replace(/[^\w]/g, '');
}

/**
 * Slack APIでメッセージを更新
 */
function updateSlackMessage(channelId, messageTs, blocks) {
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      console.warn('Bot Tokenが設定されていないため、メッセージ更新をスキップします');
      return;
    }
    
    const body = {
      channel: channelId,
      ts: messageTs,
      text: '安否確認集計',
      blocks: blocks,
      as_user: true
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + botToken,
        'Content-Type': 'application/json;charset=utf-8'
      },
      payload: JSON.stringify(body)
    };
    
    console.log('メッセージ更新リクエスト:', JSON.stringify(body, null, 2));
    
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.update', options);
    const data = JSON.parse(response.getContentText());
    
    console.log('Slack API レスポンス:', JSON.stringify(data, null, 2));
    
    if (!data.ok) {
      console.error('Slackメッセージ更新失敗:', data.error);
    } else {
      console.log('Slackメッセージ更新成功');
    }
    
  } catch (error) {
    console.error('Slackメッセージ更新エラー:', error);
  }
}

/**
 * 統計情報を取得（手動実行用）
 */
function getResponseStats() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // 訓練用統計
    const trainingSheet = spreadsheet.getSheetByName(CONFIG.TRAINING_SHEET);
    const trainingStats = getSheetStats(trainingSheet);
    
    // 本番用統計  
    const productionSheet = spreadsheet.getSheetByName(CONFIG.PRODUCTION_SHEET);
    const productionStats = getSheetStats(productionSheet);
    
    console.log('=== 応答統計 ===');
    console.log('訓練用:', trainingStats);
    console.log('本番用:', productionStats);
    
    return {
      training: trainingStats,
      production: productionStats
    };
    
  } catch (error) {
    console.error('統計取得エラー:', error);
    return null;
  }
}

/**
 * シートの統計を取得
 */
function getSheetStats(sheet) {
  if (!sheet) return { total: 0, departments: {} };
  
  const data = sheet.getDataRange().getValues();
  const responses = data.slice(1); // ヘッダー行を除く
  
  const stats = {
    total: responses.length,
    departments: {}
  };
  
  responses.forEach(row => {
    const departmentName = row[5]; // 部署名の列
    if (departmentName) {
      stats.departments[departmentName] = (stats.departments[departmentName] || 0) + 1;
    }
  });
  
  return stats;
}

/**
 * ボタンカウント更新テスト
 */
function testButtonUpdate() {
  try {
    console.log('=== ボタンカウント更新テスト ===');
    
    // Bot Token確認
    console.log('Bot Token設定状況:', CONFIG.SLACK_BOT_TOKEN ? 'あり' : 'なし');
    
    if (!CONFIG.SLACK_BOT_TOKEN || CONFIG.SLACK_BOT_TOKEN === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      console.error('❌ Bot Tokenが正しく設定されていません');
      return;
    }
    
    // スプレッドシート確認
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    console.log('✅ スプレッドシートアクセス成功');
    
    // スプレッドシートの基本動作確認
    const trainingSheet = spreadsheet.getSheetByName(CONFIG.TRAINING_SHEET);
    console.log('訓練用シート存在:', trainingSheet ? 'あり' : 'なし');
    
    console.log('✅ ボタン更新準備完了');
    
  } catch (error) {
    console.error('❌ ボタン更新テストエラー:', error);
  }
}

/**
 * 安否確認メッセージかどうかを判定
 */
function isSafetyConfirmationMessage(channelId, messageTs) {
  // 簡易判定：メッセージ内容を確認
  // 実際には、メッセージ送信時にタグを付けるなどの方法も考えられる
  return true; // 暫定的に全てのリアクションを対象とする
}

/**
 * 絵文字から部署情報を取得
 */
function getDepartmentByEmoji(emoji) {
  const departments = {
    // カスタム絵文字
    'dev': { emoji: ':dev:', name: '開発', id: 'dev' },
    'cp': { emoji: ':cp:', name: 'コーポレート', id: 'cp' },
    'mk': { emoji: ':mk:', name: 'マーケティング', id: 'mk' },
    'prd': { emoji: ':prd:', name: 'プロダクション', id: 'prd' },
    'saas': { emoji: ':saas:', name: 'saas', id: 'saas' },
    'sl': { emoji: ':sl:', name: 'sl', id: 'sl' },
    'dc': { emoji: ':dc:', name: 'dc', id: 'dc' },
    'gyoumu': { emoji: ':gyoumu:', name: 'gyoumu', id: 'gyoumu' },
    'オフィス': { emoji: ':オフィス:', name: '新しい部署', id: 'office' },
    
    // 標準絵文字（フォールバック用）
    'computer': { emoji: '💻', name: '開発', id: 'dev' },
    'office_building': { emoji: '🏢', name: 'コーポレート', id: 'cp' },
    'chart_with_upwards_trend': { emoji: '📈', name: 'マーケティング', id: 'mk' },
    'factory': { emoji: '🏭', name: 'プロダクション', id: 'prd' },
    'cloud': { emoji: '☁️', name: 'saas', id: 'saas' },
    'blue_circle': { emoji: '🔵', name: 'sl', id: 'sl' },
    'green_circle': { emoji: '🟢', name: 'dc', id: 'dc' },
    'briefcase': { emoji: '💼', name: 'gyoumu', id: 'gyoumu' }
  };
  
  return departments[emoji] || null;
}

/**
 * ユーザー情報を取得
 */
function getUserInfo(userId) {
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      return { name: userId, real_name: userId };
    }
    
    const response = UrlFetchApp.fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: {
        'Authorization': `Bearer ${botToken}`
      }
    });
    
    const data = JSON.parse(response.getContentText());
    if (data.ok) {
      return {
        name: data.user.name,
        real_name: data.user.profile?.real_name || data.user.name
      };
    }
    
    return { name: userId, real_name: userId };
    
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return { name: userId, real_name: userId };
  }
}

/**
 * 訓練メッセージかどうかを判定
 */
function isTrainingMessage(channelId, messageTs) {
  // メッセージ内容を確認して訓練かどうかを判定
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      return false;
    }
    
    const response = UrlFetchApp.fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&latest=${messageTs}&limit=1&inclusive=true`,
      {
        headers: {
          'Authorization': `Bearer ${botToken}`
        }
      }
    );
    
    const data = JSON.parse(response.getContentText());
    if (data.ok && data.messages.length > 0) {
      const messageText = data.messages[0].text || '';
      return messageText.includes('訓練');
    }
    
    return false;
    
  } catch (error) {
    console.error('メッセージ内容取得エラー:', error);
    return false;
  }
}

/**
 * チャンネル名を取得
 */
function getChannelName(channelId) {
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      return channelId;
    }
    
    const response = UrlFetchApp.fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      headers: {
        'Authorization': `Bearer ${botToken}`
      }
    });
    
    const data = JSON.parse(response.getContentText());
    if (data.ok) {
      return data.channel.name || channelId;
    }
    
    return channelId;
    
  } catch (error) {
    console.error('チャンネル名取得エラー:', error);
    return channelId;
  }
}

/**
 * ボットユーザーかどうかを判定
 */
function isBotUser(userId) {
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      // ボットトークンがない場合は安全側に倒してボットとして扱わない
      return false;
    }
    
    const response = UrlFetchApp.fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: {
        'Authorization': `Bearer ${botToken}`
      }
    });
    
    const data = JSON.parse(response.getContentText());
    if (data.ok && data.user) {
      // ボットの場合はis_botフィールドがtrueになる
      return data.user.is_bot === true;
    }
    
    return false;
    
  } catch (error) {
    console.error('ボット判定エラー:', error);
    // エラー時は安全側に倒してボットとして扱わない
    return false;
  }
}

/**
 * テスト用関数
 */
function testGASSetup() {
  console.log('=== GAS設定テスト ===');
  
  try {
    // スプレッドシートアクセステスト
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    console.log('✅ スプレッドシートアクセス成功:', spreadsheet.getName());
    
    // テストデータ追加
    recordResponse({
      timestamp: new Date(),
      userId: 'U_TEST_001',
      userName: 'test_user',
      userRealName: 'テストユーザー',
      departmentId: 'test_dept',
      departmentName: '🧪 テスト部署',
      emoji: '🧪',
      channelId: 'C_TEST',
      channelName: 'test-channel',
      messageTs: '1234567890.123456',
      isTraining: true
    }, CONFIG.TRAINING_SHEET);
    
    console.log('✅ テストデータ追加成功');
    
    // 統計取得テスト
    const stats = getResponseStats();
    console.log('✅ 統計取得成功:', stats);
    
  } catch (error) {
    console.error('❌ GAS設定エラー:', error);
  }
}
