# Google Apps Script (GAS) セットアップ手順

## 1. GASプロジェクト作成

1. [Google Apps Script](https://script.google.com) にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「安否確認システム」に変更

## 2. スクリプトの設定

1. `gas-safety-responses.js` の内容をGASエディタにコピー
2. `CONFIG.SPREADSHEET_ID` を更新（手順4で取得）
3. `CONFIG.SLACK_SIGNING_SECRET` をSlackアプリの設定から取得して更新

## 3. スプレッドシートの作成

1. [Google スプレッドシート](https://sheets.google.com) で新しいシートを作成
2. シート名を「安否確認システム応答データ」に変更
3. URLからスプレッドシートIDをコピー
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```
4. GASの `CONFIG.SPREADSHEET_ID` に設定

## 4. GAS Webアプリのデプロイ

1. GASエディタで「デプロイ」→「新しいデプロイ」
2. 種類：「ウェブアプリ」を選択
3. 説明：「安否確認システム Slack Interactions」
4. 実行ユーザー：「自分」
5. アクセスできるユーザー：「全員」
6. 「デプロイ」をクリック
7. **ウェブアプリURL をコピー**

## 5. 環境変数の更新

`.env.local` ファイルの `NEXT_PUBLIC_GAS_INTERACTIONS_URL` を更新：

```env
NEXT_PUBLIC_GAS_INTERACTIONS_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

## 6. Slackアプリの設定更新

1. [Slack API](https://api.slack.com/apps) でアプリを開く
2. 「Interactivity & Shortcuts」
3. 「Interactivity」をONにする
4. **Request URL** にGASのウェブアプリURLを設定
5. 「Save Changes」

## 7. テスト実行

GASエディタで `testGASSetup()` を実行して動作確認：

1. 関数選択で `testGASSetup` を選択
2. 「実行」ボタンをクリック
3. 権限確認が表示されたら「権限を確認」
4. Googleアカウントでログイン
5. 「詳細」→「安否確認システム（安全ではないページ）に移動」
6. 「許可」をクリック
7. 実行ログを確認

## 8. スプレッドシートの確認

1. 作成したスプレッドシートを開く
2. 「訓練用応答」シートが作成されていることを確認
3. テストデータが1行追加されていることを確認

## 作成されるシート構造

### 訓練用応答シート
| 日時 | ユーザーID | ユーザー名 | 実名 | 部署ID | 部署名 | 絵文字 | チャンネルID | チャンネル名 | メッセージTS |

### 本番用応答シート  
| 日時 | ユーザーID | ユーザー名 | 実名 | 部署ID | 部署名 | 絵文字 | チャンネルID | チャンネル名 | メッセージTS |

## 集計・分析例

スプレッドシートでは以下のような集計が可能：

- 部署別応答数
- 時間別応答推移  
- 応答率の計算
- グラフ・チャートの作成
- 未応答者の特定（別途ユーザーマスタが必要）

## トラブルシューティング

**GASでエラーが発生する場合:**
1. スプレッドシートのアクセス権限を確認
2. Slack Signing Secretが正しいか確認
3. GASの実行ログを確認

**Slackからデータが送信されない場合:**
1. SlackのRequest URLが正しいか確認  
2. GASのWebアプリが「全員」アクセス可能になっているか確認
3. Slackアプリの権限（Interactivity）が有効になっているか確認