# EventBridge Scheduler 設定ガイド（訓練モード）

## 概要

訓練モードの定期実行を AWS EventBridge Scheduler で実現するための設定ガイドです。

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

Vercelの環境変数に以下を追加：

```bash
EVENTBRIDGE_SECRET_TOKEN=yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=
```

**生成済みのトークンを使用してください。**

新しく生成する場合:
```bash
openssl rand -base64 32
```

**注意:** APIは後方互換性のため `CRON_SECRET` もサポートしていますが、EventBridge使用時は `EVENTBRIDGE_SECRET_TOKEN` を推奨します。

### 2. 訓練通知IDの取得

訓練モード設定画面で訓練通知を作成し、IDを取得してください。

または、Prisma Studioで `TrainingNotification` テーブルから確認：
```sql
SELECT id, "workspaceId", "channelId", "scheduledAt"
FROM "TrainingNotification"
WHERE "notificationStatus" = 'pending';
```

### 3. EventBridge API Destination の作成

#### 3-1. AWS Consoleにログイン

[EventBridge Console](https://ap-northeast-1.console.aws.amazon.com/events/home?region=ap-northeast-1#/apidestinations) にアクセス

#### 3-2. Connection の作成

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

#### 3-3. API Destination の作成

1. 左メニューから **「API destinations」** → **「Create API destination」**
2. 設定値:
   - **Name**: `anpikakunin-training-trigger`
   - **API destination endpoint**: `https://anpikakunin.xyz/api/training/trigger`
     - ⚠️ 本番環境のドメインを指定
   - **HTTP method**: `POST`
   - **Invocation rate limit per second**: `10` (デフォルトのまま)
   - **Connection**: `anpikakunin-training-connection` (先ほど作成したもの)

3. **「Create」** をクリック

### 4. EventBridge Scheduler の作成

#### 4-1. Scheduler にアクセス

[EventBridge Scheduler Console](https://ap-northeast-1.console.aws.amazon.com/scheduler/home?region=ap-northeast-1#schedules) にアクセス

#### 4-2. Schedule の作成

1. **「Create schedule」** をクリック
2. **Schedule name and description**:
   - **Schedule name**: `anpikakunin-training-monthly`
   - **Description**: `訓練モード定期実行 (毎月1日9時)`

3. **Schedule pattern**:
   - **Schedule type**: `Recurring schedule`
   - **Schedule pattern**: `Cron-based schedule`
   - **Cron expression**: `0 0 1 * ? *`
     - 毎月1日9時(JST)に実行
     - ⚠️ EventBridgeのCronはUTC基準なので、JST 9時 = UTC 0時
   - **Flexible time window**: `Off`

4. **Timezone**:
   - `Asia/Tokyo` を選択

5. **Target**:
   - **Target API**: `EventBridge API destination`
   - **API destination**: `anpikakunin-training-trigger` (先ほど作成したもの)
   - **HTTP method**: `POST`
   - **Input**: 以下のJSONを入力
     ```json
     {
       "trainingId": "YOUR_TRAINING_NOTIFICATION_ID"
     }
     ```
     - ⚠️ `YOUR_TRAINING_NOTIFICATION_ID` は実際の訓練通知IDに置き換える

6. **Settings**:
   - **Maximum age of event**: `3600` (1時間)
   - **Retry policy**: `2` (2回リトライ)
   - **Dead-letter queue**: `None` (任意)

7. **Permissions**:
   - **Execution role**: `Create new role for this schedule` (自動作成)

8. **「Create schedule」** をクリック

---

## Cron式の例

| 実行タイミング | Cron式 (JST) | Cron式 (UTC) |
|--------------|-------------|-------------|
| 毎日9時(JST) | 毎日9時 | `0 0 * * ? *` |
| 毎週月曜9時(JST) | 毎週月曜9時 | `0 0 ? * MON *` |
| 毎月1日9時(JST) | 毎月1日9時 | `0 0 1 * ? *` |
| 毎月第1月曜9時(JST) | 毎月第1月曜9時 | `0 0 ? * MON#1 *` |

**EventBridgeのCron式フォーマット:**
```
分 時 日 月 曜日 年
0  0  1  *  ?    *
```

**Timezone設定:**
- `Asia/Tokyo` を選択すれば、Cron式はJST基準になります

---

## API仕様

### POST /api/training/trigger

**認証:**
- `Authorization: Bearer {EVENTBRIDGE_SECRET_TOKEN}`
- 後方互換性のため `CRON_SECRET` もサポート

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

## 動作確認

### 1. ローカルでのテスト

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

1. EventBridge Scheduler Console で作成したScheduleを選択
2. **「Actions」** → **「Run schedule now」** をクリック
3. Slackに訓練通知が届くことを確認

---

## トラブルシューティング

### 401 Unauthorized

**原因:**
- `EVENTBRIDGE_SECRET_TOKEN` が設定されていない
- Authorizationヘッダーの形式が誤っている

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

---

## cron-job.org からの移行

### 移行手順

1. EventBridge Schedulerを設定 (上記手順)
2. 動作確認（テスト実行）
3. cron-job.org のジョブを無効化または削除
4. 既存の `/api/cron/training-send` エンドポイントは残す（削除不要）

### 既存エンドポイント

- `/api/cron/training-send` (GET) - cron-job.org用（後方互換性のため残す）
- `/api/training/trigger` (POST) - EventBridge用（推奨）

---

## 監視・ログ確認

### EventBridge 実行履歴

1. EventBridge Scheduler Console
2. 作成したScheduleを選択
3. **「Monitoring」** タブで実行履歴を確認

### アプリケーションログ

Vercelのログで以下を確認:
- 成功: `✅ Training notification sent successfully: trainingId=...`
- エラー: `❌ Training notification error: ...`

### データベース確認

Prisma Studioで `TrainingNotification` テーブルを確認:
- `notificationStatus`: `pending` → `sent` に変更されているか
- `notifiedAt`: 送信日時が記録されているか
- `messageTs`: Slackメッセージタイムスタンプが記録されているか

---

## まとめ

✅ **EventBridge Scheduler のメリット:**
- 完全無料 (月1400万回まで、訓練モード実行なら完全に無料枠内)
- 高信頼性 (AWS SLA 99.99%)
- サービス停止リスクなし
- 設定が簡単
- リトライ・エラーハンドリングが標準装備

✅ **料金:**
- 訓練モードの実行頻度なら完全無料

✅ **推奨構成:**
- EventBridge API Destinations を使用
- Lambda不要でコスト最小
- Bearer Token認証でセキュリティ確保
- Cron-based schedule でJST基準の日時指定
