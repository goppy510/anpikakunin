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
 * Slack Interactionsを受信する関数
 */
function doPost(e) {
  try {
    console.log('Slack Interaction受信:', e.postData.contents);
    
    // Slackからのペイロードを解析
    const payload = JSON.parse(e.parameter.payload);
    
    // 安否確認ボタンのクリックかどうかを確認
    if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
      const action = payload.actions[0];
      
      if (action.action_id && action.action_id.startsWith('safety_')) {
        return handleSafetyResponse(payload);
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
 * 安否確認応答を処理
 */
function handleSafetyResponse(payload) {
  try {
    const action = payload.actions[0];
    const user = payload.user;
    const channel = payload.channel;
    const message = payload.message;
    
    // ボタンの値を解析
    const buttonValue = JSON.parse(action.value || '{}');
    const departmentId = buttonValue.departmentId || action.action_id.replace('safety_', '');
    const departmentName = buttonValue.departmentName || departmentId;
    const emoji = buttonValue.emoji || '';
    
    // 訓練用か本番用かを判定（メッセージ内容から判断）
    const isTraining = message.text && message.text.includes('訓練');
    const sheetName = isTraining ? CONFIG.TRAINING_SHEET : CONFIG.PRODUCTION_SHEET;
    
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
    
    // Slackに応答（ボタンのカウント更新）
    return updateButtonCounts(payload, departmentId);
    
  } catch (error) {
    console.error('安否確認応答処理エラー:', error);
    throw error;
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
      sheet.getRange(1, 1, 1, 9).setValues([[
        '日時',
        'ユーザーID', 
        'ユーザー名',
        '実名',
        '部署名',
        '絵文字',
        'チャンネルID',
        'チャンネル名',
        'メッセージTS'
      ]]);
      
      // ヘッダー行のスタイル設定
      const headerRange = sheet.getRange(1, 1, 1, 9);
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
    const channel = payload.channel;
    const message = payload.message;
    const messageTs = message.ts;
    
    // 現在のメッセージのボタンカウントを取得・更新
    const updatedBlocks = updateMessageBlocks(message.blocks, clickedDepartmentId, messageTs, channel.id);
    
    // Slack APIでメッセージを更新
    updateSlackMessage(channel.id, messageTs, updatedBlocks);
    
    return ContentService
      .createTextOutput('応答を記録しました ✅')
      .setMimeType(ContentService.MimeType.TEXT);
      
  } catch (error) {
    console.error('ボタンカウント更新エラー:', error);
    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * メッセージのブロックを更新してカウントを増やす
 */
function updateMessageBlocks(blocks, clickedDepartmentId, messageTs, channelId) {
  try {
    // 部署別カウントを取得
    const departmentCounts = getDepartmentCountsFromSheet(messageTs, channelId);
    
    return blocks.map(block => {
      if (block.type === 'actions' && block.elements) {
        block.elements = block.elements.map(element => {
          if (element.action_id && element.action_id.startsWith('safety_')) {
            const deptId = element.action_id.replace('safety_', '');
            const count = departmentCounts[deptId] || 0;
            
            // ボタンテキストを更新（例: "🏢 総務部 (3)"）
            const buttonValue = JSON.parse(element.value || '{}');
            const emoji = buttonValue.emoji || '';
            const deptName = buttonValue.departmentName || deptId;
            
            element.text.text = `${emoji} ${deptName} (${count})`;
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
 * スプレッドシートから部署別カウントを取得
 */
function getDepartmentCountsFromSheet(messageTs, channelId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // 訓練用と本番用の両方をチェック
    const sheets = [
      spreadsheet.getSheetByName(CONFIG.TRAINING_SHEET),
      spreadsheet.getSheetByName(CONFIG.PRODUCTION_SHEET)
    ].filter(sheet => sheet !== null);
    
    const counts = {};
    
    sheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      const responses = data.slice(1); // ヘッダー行を除く
      
      responses.forEach(row => {
        const rowMessageTs = row[8]; // メッセージTS列
        const rowChannelId = row[6];  // チャンネルID列
        const departmentName = row[4]; // 部署名列
        
        if (rowMessageTs === messageTs && rowChannelId === channelId) {
          // 部署名から部署IDを推測（emoji除去）
          const deptId = departmentName.replace(/^[\u{1F000}-\u{1FFFF}]\s*/u, '').toLowerCase().replace(/[^\w]/g, '');
          counts[deptId] = (counts[deptId] || 0) + 1;
        }
      });
    });
    
    return counts;
    
  } catch (error) {
    console.error('カウント取得エラー:', error);
    return {};
  }
}

/**
 * Slack APIでメッセージを更新
 */
function updateSlackMessage(channelId, messageTs, blocks) {
  try {
    // Bot Tokenが必要（設定に追加する必要あり）
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken) {
      console.warn('Bot Tokenが設定されていないため、メッセージ更新をスキップします');
      return;
    }
    
    const payload = {
      'channel': channelId,
      'ts': messageTs,
      'blocks': JSON.stringify(blocks)
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
    
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.update', options);
    const data = JSON.parse(response.getContentText());
    
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