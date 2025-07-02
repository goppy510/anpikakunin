"use client";

import { useState } from "react";
import cn from "classnames";

export function SetupTab() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [gasUrl, setGasUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");

  const steps = [
    { id: 1, title: "GAS プロジェクト作成", completed: false },
    { id: 2, title: "スプレッドシート作成", completed: false },
    { id: 3, title: "GAS デプロイ", completed: false },
    { id: 4, title: "Slack 設定", completed: false },
    { id: 5, title: "動作確認", completed: false }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("クリップボードにコピーしました");
  };

  const gasScript = `/**
 * 安否確認システム - Google Apps Script
 * Slack Interactionsを受信してスプレッドシートに記録
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
    
    return ContentService
      .createTextOutput('応答を記録しました ✅')
      .setMimeType(ContentService.MimeType.TEXT);
    
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
            <div className="mt-4">
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
              日時 | ユーザーID | ユーザー名 | 実名 | 部署名 | 絵文字 | チャンネルID | チャンネル名 | メッセージTS
            </div>
          </div>
          <div>
            <h4 className="text-red-400 font-medium">本番用応答シート</h4>
            <div className="bg-gray-800 p-2 rounded font-mono text-xs text-gray-300 overflow-x-auto">
              日時 | ユーザーID | ユーザー名 | 実名 | 部署名 | 絵文字 | チャンネルID | チャンネル名 | メッセージTS
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
    </div>
  );
}