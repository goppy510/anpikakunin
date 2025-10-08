"use client";

import { useState, useEffect } from "react";
import cn from "classnames";
import { MigrateSettingsButton } from "./MigrateSettingsButton";

export function SetupTab() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [gasUrl, setGasUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [botToken, setBotToken] = useState("");

  // 設定の読み込み
  useEffect(() => {
    const loadGasSettings = () => {
      const savedGasUrl = localStorage.getItem('gas_url');
      const savedSpreadsheetId = localStorage.getItem('spreadsheet_id');
      const savedBotToken = localStorage.getItem('gas_bot_token');
      
      if (savedGasUrl) setGasUrl(savedGasUrl);
      if (savedSpreadsheetId) setSpreadsheetId(savedSpreadsheetId);
      if (savedBotToken) setBotToken(savedBotToken);
    };
    
    loadGasSettings();
  }, []);

  // 設定の保存
  const saveGasSettings = () => {
    if (gasUrl) localStorage.setItem('gas_url', gasUrl);
    if (spreadsheetId) localStorage.setItem('spreadsheet_id', spreadsheetId);
    if (botToken) localStorage.setItem('gas_bot_token', botToken);
    alert('GAS設定を保存しました');
  };

  const steps = [
    { id: 1, title: "GAS プロジェクト作成", completed: false },
    { id: 2, title: "スプレッドシート作成", completed: false },
    { id: 3, title: "GAS デプロイ", completed: false },
    { id: 4, title: "Slack 設定", completed: false },
    { id: 5, title: "動作確認", completed: false }
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("クリップボードにコピーしました");
    } catch (error) {
      console.error('コピーエラー:', error);
      alert('コピーに失敗しました');
    }
  };

  const copyGasScript = async () => {
    try {
      // gas-safety-responses.jsファイルから最新のスクリプトを読み込み
      const response = await fetch('/gas-safety-responses.js');
      if (!response.ok) {
        throw new Error('GASスクリプトの読み込みに失敗しました');
      }
      
      let gasScript = await response.text();
      
      // 設定値を置換
      gasScript = gasScript.replace(
        /SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE'/g,
        `SPREADSHEET_ID: '${spreadsheetId || 'YOUR_SPREADSHEET_ID_HERE'}'`
      );
      
      gasScript = gasScript.replace(
        /SLACK_BOT_TOKEN: 'YOUR_SLACK_BOT_TOKEN_HERE'/g,
        `SLACK_BOT_TOKEN: '${botToken || 'YOUR_SLACK_BOT_TOKEN_HERE'}'`
      );
      
      await navigator.clipboard.writeText(gasScript);
      alert("✅ GASスクリプトをクリップボードにコピーしました（最新版・設定値反映済み）");
    } catch (error) {
      console.error('GASスクリプトコピーエラー:', error);
      alert('❌ 最新のGASスクリプトのコピーに失敗しました。手動でコピーしてください。');
    }
  };

  const gasScript = `/**
 * 安否確認システム - Google Apps Script
 * Slack Events/Interactionsを受信してスプレッドシートに記録
 */

// 設定
const CONFIG = {
  // スプレッドシートID（手順2で作成後に更新してください）
  SPREADSHEET_ID: '${spreadsheetId || 'YOUR_SPREADSHEET_ID_HERE'}',
  
  // シート名
  TRAINING_SHEET: '訓練用応答',
  PRODUCTION_SHEET: '本番用応答',
  
  // Slack設定（Slackアプリの設定から取得）
  SLACK_SIGNING_SECRET: 'YOUR_SLACK_SIGNING_SECRET',
  SLACK_BOT_TOKEN: '${botToken || 'YOUR_SLACK_BOT_TOKEN_HERE'}'  // ボタンカウント更新用
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
      departmentId: departmentInfo.id,
      departmentName: \`\${departmentInfo.emoji} \${departmentInfo.name}\`,
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
    
    console.log('ユーザー:', user.name, 'チャンネル:', channel.name);
    
    // ボタンの値を解析
    const buttonValue = JSON.parse(action.value || '{}');
    const departmentId = buttonValue.departmentId || action.action_id.replace('safety_', '');
    const departmentName = buttonValue.departmentName || departmentId;
    const emoji = buttonValue.emoji || '';
    
    console.log('部署情報:', { departmentId, departmentName, emoji });
    
    // 訓練用か本番用かを判定（メッセージ内容から判断）
    const isTraining = message.text && message.text.includes('訓練');
    const sheetName = isTraining ? CONFIG.TRAINING_SHEET : CONFIG.PRODUCTION_SHEET;
    
    console.log('シート名:', sheetName, '訓練モード:', isTraining);
    
    // 重複チェック
    if (isDuplicateResponse(user.id, message.ts, channel.id)) {
      console.log('重複応答を検出:', user.name);
      
      // 既に応答済みの場合はエフェメラルメッセージで通知
      sendEphemeralMessage(channel.id, user.id, '⚠️ 既に応答済みです。安否確認は一人一回のみ回答可能です。');
      
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
    
    // Slackに応答（ボタンのカウント更新）
    console.log('ボタンカウント更新開始');
    return updateButtonCounts(payload, departmentId);
    
  } catch (error) {
    console.error('安否確認応答処理エラー:', error);
    throw error;
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
 * 重複応答をチェック
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
        const rowMessageTs = String(row[9]);  // メッセージTS列
        const rowChannelId = String(row[7]);  // チャンネルID列
        
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
    
    console.log(\`応答を記録しました: \${responseData.userRealName} → \${responseData.departmentName} (\${sheetName})\`);
    
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
    
    // Slack APIでメッセージを更新
    console.log('Slackメッセージ更新開始');
    updateSlackMessage(channel.id, messageTs, updatedBlocks);
    
    console.log('=== updateButtonCounts 完了 ===');
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
            
            element.text.text = \`\${emoji} \${deptName} (\${count})\`;
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
        const rowMessageTs = String(row[9]); // メッセージTS列
        const rowChannelId = String(row[7]);  // チャンネルID列
        const userId = String(row[1]);        // ユーザーID列
        const departmentId = String(row[4]);  // 部署ID列
        
        console.log(\`行\${index + 2}:\`, { rowMessageTs, rowChannelId, userId, departmentId });
        
        if (rowMessageTs === String(messageTs) && rowChannelId === String(channelId)) {
          console.log('条件一致:', { userId, departmentId });
          
          // 同一ユーザーの重複応答をチェック
          const userKey = \`\${userId}_\${messageTs}_\${channelId}\`;
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
 * Slack APIでメッセージを更新
 */
function updateSlackMessage(channelId, messageTs, blocks) {
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
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
    
    const response = UrlFetchApp.fetch(\`https://slack.com/api/users.info?user=\${userId}\`, {
      headers: {
        'Authorization': \`Bearer \${botToken}\`
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
  try {
    const botToken = CONFIG.SLACK_BOT_TOKEN;
    if (!botToken || botToken === 'YOUR_SLACK_BOT_TOKEN_HERE') {
      return false;
    }
    
    const response = UrlFetchApp.fetch(
      \`https://slack.com/api/conversations.history?channel=\${channelId}&latest=\${messageTs}&limit=1&inclusive=true\`,
      {
        headers: {
          'Authorization': \`Bearer \${botToken}\`
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
    
    const response = UrlFetchApp.fetch(\`https://slack.com/api/conversations.info?channel=\${channelId}\`, {
      headers: {
        'Authorization': \`Bearer \${botToken}\`
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
      return false;
    }
    
    const response = UrlFetchApp.fetch(\`https://slack.com/api/users.info?user=\${userId}\`, {
      headers: {
        'Authorization': \`Bearer \${botToken}\`
      }
    });
    
    const data = JSON.parse(response.getContentText());
    if (data.ok && data.user) {
      return data.user.is_bot === true;
    }
    
    return false;
    
  } catch (error) {
    console.error('ボット判定エラー:', error);
    return false;
  }
}

/**
 * 安否確認メッセージかどうかを判定
 */
function isSafetyConfirmationMessage(channelId, messageTs) {
  return true; // 暫定的に全てのリアクションを対象とする
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
    
  } catch (error) {
    console.error('❌ GAS設定エラー:', error);
  }
}`;

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">📊 応答集計システム設定</h2>
        <p className="text-gray-300 text-sm">
          Google スプレッドシートと連携して、Slack応答を自動集計します。<br />
          訓練用と本番用でシートが自動分割され、部署別・ユーザー別の詳細分析が可能です。
        </p>
      </div>

      {/* 既存設定の移行ツール */}
      <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 p-4 rounded">
        <h3 className="text-yellow-300 font-medium mb-3">🔄 既存設定の移行</h3>
        <p className="text-yellow-200 text-sm mb-4">
          IndexedDBに保存されている既存のSlack設定をPostgreSQLデータベースに移行できます。<br />
          移行時にBot Tokenは自動的に暗号化されます。
        </p>
        <MigrateSettingsButton />
      </div>

      {/* 進捗表示 */}
      <div className="bg-gray-700 p-4 rounded">
        <h3 className="text-white font-medium mb-3">セットアップ進捗</h3>
        <div className="space-y-2">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                activeStep === step.id ? "bg-blue-600" : "bg-gray-600 hover:bg-gray-500"
              )}
              onClick={() => setActiveStep(step.id)}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                step.completed ? "bg-green-500 text-white" : "bg-gray-400 text-gray-900"
              )}>
                {step.completed ? "✓" : step.id}
              </div>
              <span className="text-white">{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 手順詳細 */}
      <div className="bg-gray-700 p-6 rounded">
        {activeStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">手順1: Google Apps Script プロジェクト作成</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">1</span>
                <div>
                  <a href="https://script.google.com" target="_blank" className="text-blue-400 underline">
                    Google Apps Script
                  </a> にアクセス
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">2</span>
                <div>「新しいプロジェクト」をクリック</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">3</span>
                <div>プロジェクト名を「安否確認システム」に変更</div>
              </li>
            </ol>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">手順2: Google スプレッドシート作成</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">1</span>
                <div>
                  <a href="https://sheets.google.com" target="_blank" className="text-blue-400 underline">
                    Google スプレッドシート
                  </a> で新しいシートを作成
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">2</span>
                <div>シート名を「安否確認システム応答データ」に変更</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">3</span>
                <div>
                  URLからスプレッドシートIDをコピー
                  <div className="bg-gray-800 p-2 mt-2 rounded font-mono text-sm">
                    https://docs.google.com/spreadsheets/d/<span className="text-yellow-400">SPREADSHEET_ID</span>/edit
                  </div>
                </div>
              </li>
            </ol>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">スプレッドシートID</label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="スプレッドシートIDを入力"
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
              />
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">手順3: GAS スクリプト設定とデプロイ</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">1</span>
                <div>
                  GASエディタで以下のスクリプトをコピー&ペースト
                  <button
                    onClick={() => copyToClipboard(gasScript)}
                    className="ml-2 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                  >
                    📋 コピー
                  </button>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">2</span>
                <div>
                  <code className="bg-gray-800 px-2 py-1 rounded">CONFIG.SPREADSHEET_ID</code> を手順2のIDに更新
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">2.5</span>
                <div>
                  <code className="bg-gray-800 px-2 py-1 rounded">CONFIG.SLACK_BOT_TOKEN</code> にBot Tokenを設定
                  <div className="text-yellow-400 text-sm mt-1">
                    ※ ボタンカウント更新に必要
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">3</span>
                <div>「デプロイ」→「新しいデプロイ」→「ウェブアプリ」を選択</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">4</span>
                <div>
                  アクセス権限を「全員」に設定して「デプロイ」
                  <div className="text-yellow-400 text-sm mt-1">
                    ※ ウェブアプリURLをコピーしてください
                  </div>
                </div>
              </li>
            </ol>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bot Token（ボタンカウント更新用）</label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="xoxb-your-bot-token"
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                />
                <div className="text-xs text-yellow-400 mt-1">
                  必要な権限: chat:write, users:read, channels:read
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">GAS ウェブアプリURL</label>
                <input
                  type="text"
                  value={gasUrl}
                  onChange={(e) => setGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">手順4: Slack アプリ設定更新</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">1</span>
                <div>
                  <a href="https://api.slack.com/apps" target="_blank" className="text-blue-400 underline">
                    Slack API
                  </a> でアプリを開く
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">2</span>
                <div>「Interactivity & Shortcuts」を選択</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">3</span>
                <div>「Interactivity」をONにする</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">4</span>
                <div>
                  「Request URL」に手順3のGAS URLを設定
                  {gasUrl && (
                    <div className="bg-gray-800 p-2 mt-2 rounded font-mono text-sm flex items-center justify-between">
                      <span className="truncate">{gasUrl}</span>
                      <button
                        onClick={() => copyToClipboard(gasUrl)}
                        className="ml-2 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                      >
                        📋
                      </button>
                    </div>
                  )}
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">5</span>
                <div>「Save Changes」をクリック</div>
              </li>
            </ol>
          </div>
        )}

        {activeStep === 5 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">手順5: 動作確認</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">1</span>
                <div>
                  GASエディタで <code className="bg-gray-800 px-2 py-1 rounded">testGASSetup</code> 関数を実行
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">2</span>
                <div>権限確認ダイアログで「許可」をクリック</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">3</span>
                <div>実行ログで「✅ テストデータ追加成功」を確認</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">4</span>
                <div>スプレッドシートに「訓練用応答」シートとテストデータを確認</div>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">5</span>
                <div>このアプリから訓練メッセージを送信してボタンをテスト</div>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* 作成されるシート構造 */}
      <div className="bg-gray-700 p-4 rounded">
        <h3 className="text-white font-medium mb-3">📋 作成されるシート構造</h3>
        <div className="space-y-3">
          <div>
            <h4 className="text-green-400 font-medium">訓練用応答シート</h4>
            <div className="bg-gray-800 p-2 rounded font-mono text-xs text-gray-300 overflow-x-auto">
              日時 | ユーザーID | ユーザー名 | 実名 | 部署ID | 部署名 | 絵文字 | チャンネルID | チャンネル名 | メッセージTS
            </div>
          </div>
          <div>
            <h4 className="text-red-400 font-medium">本番用応答シート</h4>
            <div className="bg-gray-800 p-2 rounded font-mono text-xs text-gray-300 overflow-x-auto">
              日時 | ユーザーID | ユーザー名 | 実名 | 部署ID | 部署名 | 絵文字 | チャンネルID | チャンネル名 | メッセージTS
            </div>
          </div>
        </div>
      </div>

      {/* 利点説明 */}
      <div className="bg-blue-900 bg-opacity-30 border border-blue-600 p-4 rounded">
        <h4 className="text-blue-300 font-medium mb-3">💡 スプレッドシート集計の利点</h4>
        <ul className="space-y-2 text-sm text-blue-200">
          <li>• 訓練用と本番用で自動シート分割</li>
          <li>• 部署別応答数のリアルタイム集計</li>
          <li>• 時間別応答推移の分析</li>
          <li>• グラフ・チャートの自動作成</li>
          <li>• 未応答者の特定（ユーザーマスタと照合）</li>
          <li>• CSVエクスポートで他システム連携</li>
          <li>• 複数人での同時閲覧・編集</li>
        </ul>
      </div>

      {/* 設定保存ボタン */}
      <div className="bg-gray-700 p-4 rounded flex justify-center">
        <button
          onClick={saveGasSettings}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
        >
          💾 GAS設定を保存
        </button>
      </div>
    </div>
  );
}