# EventBridge Rules 設定ガイド（訓練モード）

## 概要

訓練モードの定期実行を AWS EventBridge Rules で実現するための設定ガイドです。

**重要:** 訓練通知を管理画面から作成すると、自動的にEventBridge Ruleが作成されます。このドキュメントは初回セットアップ（API DestinationとConnectionの作成）とトラブルシューティング用です。

cron-job.org からの移行により、以下のメリットがあります：
- **完全無料** (月1400万回まで無料、訓練モード実行なら完全に無料枠内)
- **高信頼性** (AWS SLA 99.99%)
- **サービス停止リスクなし**

## 前提条件

- AWSアカウント
- 本番環境のAPIエンドポイント (Vercelデプロイ済み)
- `EVENTBRIDGE_SECRET_TOKEN` の設定 (Vercel環境変数)
- 訓練通知レコードのID (`TrainingNotification.id`)

## 料金

### EventBridge Scheduler 料金 (東京リージョン)

- **無料枠**: 月1400万回まで無料
- **超過分**: 100万回あたり $1.25

### 実行頻度別の料金例

| 実行間隔 | 月間実行回数 | 料金 |
|---------|-------------|------|
| 1日1回 | 30回 | **$0** |
| 週1回 | 4回 | **$0** |
| 月1回 | 1回 | **$0** |

**訓練モードは通常1日〜月1回程度の実行なので、完全無料で運用できます。**

---

## 設定手順

### 1. 環境変数の設定 (Vercel)

Vercelの環境変数に以下を追加（未設定の場合）：

```bash
EVENTBRIDGE_SECRET_TOKEN=yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=
```

**生成済みのトークンを使用してください。**

新しく生成する場合:
```bash
openssl rand -base64 32
```

### 2. AWS認証情報の設定

管理画面（`/admin/aws-settings`）でAWS認証情報を設定：

- **AWS Access Key ID**: IAMユーザーのアクセスキー
- **AWS Secret Access Key**: IAMユーザーのシークレットキー
- **Region**: `ap-northeast-1`（東京リージョン）

**IAMユーザーに必要な権限:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:PutTargets",
        "events:DeleteRule",
        "events:RemoveTargets",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. EventBridge実行ロールの作成（初回のみ）

EventBridge RuleがAPI Destinationを呼び出すためのIAMロールを作成します。

#### 3-1. IAM Consoleでロール作成

1. [IAM Console - Roles](https://console.aws.amazon.com/iam/home#/roles) にアクセス
2. **「Create role」** をクリック
3. **Trusted entity**:
   - **Trusted entity type**: `AWS service`
   - **Service or use case**: `EventBridge` を選択
4. **Permissions**:
   - `AmazonEventBridgeApiDestinationsServiceRolePolicy` を選択
5. **Role name**: `EventBridgeRuleExecutionRole`
6. **「Create role」** をクリック

#### 3-2. InvokeApiDestination権限の追加（重要）

作成したロールに `events:InvokeApiDestination` 権限を追加します。

1. IAM Consoleで `EventBridgeRuleExecutionRole` を開く
2. **「Add permissions」** → **「Create inline policy」**
3. **JSON** タブを選択して以下を貼り付け:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["events:InvokeApiDestination"],
         "Resource": "arn:aws:events:ap-northeast-1:*:api-destination/anpikakunin-training-trigger/*"
       }
     ]
   }
   ```
4. **Policy name**: `InvokeApiDestinationPolicy`
5. **「Create policy」** をクリック

#### 3-3. ロールARNの設定

7. 作成したロールのARNをコピー（例: `arn:aws:iam::123456789012:role/EventBridgeRuleExecutionRole`）
8. `.env` ファイルまたはVercel環境変数に設定:
   ```bash
   EVENTBRIDGE_ROLE_ARN=arn:aws:iam::123456789012:role/EventBridgeRuleExecutionRole
   ```

### 4. EventBridge API Destination の作成（初回のみ）

**既に作成済みの場合はスキップしてください。**

#### 4-1. AWS Consoleにログイン

[EventBridge Console](https://ap-northeast-1.console.aws.amazon.com/events/home?region=ap-northeast-1#/apidestinations) にアクセス

#### 4-2. Connection の作成

1. 左メニューから **「API destinations」** → **「Connections」** → **「Create connection」**
2. 設定値:
   - **Name**: `anpikakunin-training-connection`
   - **Destination type**: `Other`
   - **Authorization type**: `API key`
   - **API key name**: `Authorization`
   - **Value**: `Bearer yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=`
     - ⚠️ `Bearer ` を忘れずに付ける
     - ⚠️ 実際の `EVENTBRIDGE_SECRET_TOKEN` の値を使用

3. **「Create」** をクリック

#### 4-3. API Destination の作成

1. 左メニューから **「API destinations」** → **「Create API destination」**
2. 設定値:
   - **Name**: `anpikakunin-training-trigger`
   - **API destination endpoint**: `https://anpikakunin.xyz/api/training/trigger`
     - ⚠️ 本番環境のドメインを指定
   - **HTTP method**: `POST`
   - **Invocation rate limit per second**: `10` (デフォルトのまま)
   - **Connection**: `anpikakunin-training-connection` (先ほど作成したもの)

3. **「Create」** をクリック
4. 作成したAPI DestinationのARNをコピー（例: `arn:aws:events:ap-northeast-1:123456789012:api-destination/anpikakunin-training-trigger/...`）
5. `.env` ファイルまたはVercel環境変数に設定:
   ```bash
   EVENTBRIDGE_API_DESTINATION_ARN=arn:aws:events:ap-northeast-1:123456789012:api-destination/anpikakunin-training-trigger/...
   ```

### 5. 訓練通知の作成（自動的にEventBridge Ruleが作成されます）

管理画面（`/admin/training`）で訓練通知を作成すると、以下が自動的に実行されます：

1. 訓練通知レコードがデータベースに保存
2. AWS SDK経由でEventBridge Ruleが自動作成
   - Rule名: `training-{訓練通知ID}`
   - スケジュール: 管理画面で設定した日時（UTC変換済み）
   - ターゲット: API Destination（`anpikakunin-training-trigger`）
   - 本文: `{"trainingId": "訓練通知ID"}`
3. 指定日時にSlack通知が自動送信

---

## 動作確認

### 1. ローカルでのテスト

訓練通知APIを直接呼び出してテスト：

```bash
curl -X POST https://anpikakunin.xyz/api/training/trigger \
  -H "Authorization: Bearer yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=" \
  -H "Content-Type: application/json" \
  -d '{"trainingId": "YOUR_TRAINING_NOTIFICATION_ID"}'
```

**期待される結果:**
```json
{
  "success": true,
  "message": "Training notification sent successfully",
  "trainingId": "...",
  "messageTs": "1234567890.123456"
}
```

### 2. EventBridge のテスト実行

1. EventBridge Rules Console で作成したRuleを選択
2. **注意**: EventBridge Rule は手動実行機能がないため、以下のいずれかの方法でテスト：
   - **方法A**: Cron式を数分後の時刻に設定して実際に実行を待つ
   - **方法B**: APIを直接呼び出してテスト（上記curlコマンド）
3. Slackに訓練通知が届くことを確認
4. Prisma Studioで `TrainingNotification` の `notificationStatus` が `sent` になっているか確認

---

## トラブルシューティング

### 401 Unauthorized

**原因:**
- `EVENTBRIDGE_SECRET_TOKEN` が設定されていない
- Connectionの認証ヘッダーが誤っている

**対処:**
1. Vercel環境変数を確認: `EVENTBRIDGE_SECRET_TOKEN`
2. ConnectionのAPI key valueが `Bearer {token}` の形式になっているか確認

### 404 Not Found

**原因:**
- `trainingId` が存在しない
- `TrainingNotification` レコードが削除されている

**対処:**
- Prisma Studioで `TrainingNotification` テーブルを確認
- 有効な訓練通知IDを使用

### 500 Internal Server Error

**原因:**
- ワークスペース情報が見つからない
- 部署情報がない
- テンプレートがない

**対処:**
- Prisma Studioで以下を確認:
  - `SlackWorkspace` が存在するか
  - `Department` が存在するか (isActive = true)
  - `MessageTemplate` が存在するか (type = "TRAINING", isActive = true)

### スケジュールが実行されない

**原因:**
- EventBridge実行ロールの権限不足
- API Destinationの設定ミス

**対処:**
1. EventBridge Scheduler Consoleで実行履歴を確認
2. CloudWatch Logsでエラーログを確認
3. API Destinationのエンドポイントが正しいか確認

---

## cron-job.org からの移行

### 移行手順

1. EventBridge API Destination を作成 (初回のみ)
2. 訓練通知を作成
3. EventBridge Ruleを設定 (この手順書に従う)
4. cron-job.org のジョブを削除

### 既存エンドポイント

- `/api/cron/training-send` (GET) - cron-job.org用（非推奨）
- `/api/training/trigger` (POST) - EventBridge用（推奨）

---

## API仕様

### POST /api/training/trigger

**認証:**
- `Authorization: Bearer {EVENTBRIDGE_SECRET_TOKEN}`

**リクエストボディ:**
```json
{
  "trainingId": "uuid-string"
}
```

**レスポンス (成功):**
```json
{
  "success": true,
  "message": "Training notification sent successfully",
  "trainingId": "uuid-string",
  "messageTs": "1234567890.123456"
}
```

**レスポンス (既送信):**
```json
{
  "success": true,
  "message": "Training notification already sent",
  "skipped": true
}
```

**レスポンス (エラー):**
```json
{
  "success": false,
  "error": "Failed to send training notification",
  "details": "エラー詳細"
}
```

---

## まとめ

✅ **EventBridge Rules のメリット:**
- 完全無料 (月1400万回まで、訓練モード実行なら完全に無料枠内)
- 高信頼性 (AWS SLA 99.99%)
- サービス停止リスクなし
- API Destination経由でHTTPエンドポイントを呼び出し可能

✅ **運用フロー:**
1. 管理画面で訓練通知を作成
2. 訓練通知IDを取得
3. AWS ConsoleでEventBridge Ruleを手動作成
4. 指定日時に自動でSlack通知

✅ **注意事項:**
- 訓練通知ごとにEventBridge Ruleを手動作成する必要があります
- API DestinationとConnectionは初回のみ作成すれば再利用可能です
- Cron式はUTC時刻で指定する必要があります（JSTから9時間引く）
