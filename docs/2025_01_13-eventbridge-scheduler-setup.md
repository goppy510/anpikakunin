# EventBridge Scheduler 設定ガイド

## 概要

訓練モードの定期実行を AWS EventBridge Scheduler で実現するための設定ガイドです。

cron-job.org からの移行により、以下のメリットがあります：
- **完全無料** (月1400万回まで無料、訓練モードの実行頻度なら完全に無料枠内)
- **高信頼性** (AWS SLA 99.99%)
- **サービス停止リスクなし**

## 前提条件

- AWSアカウント
- 本番環境のAPIエンドポイント (Vercelデプロイ済み)
- `EVENTBRIDGE_SECRET_TOKEN` の設定 (Vercel環境変数)

## 料金

### EventBridge Scheduler 料金 (東京リージョン)

- **無料枠**: 月1400万回まで無料
- **超過分**: 100万回あたり $1.25

### 実行頻度別の料金例

| 実行間隔 | 月間実行回数 | 料金 |
|---------|-------------|------|
| 1日1回 | 30回 | **$0** |
| 1時間1回 | 720回 | **$0** |
| 10分1回 | 4,320回 | **$0** |
| 1分1回 | 43,200回 | **$0** |

**訓練モードは通常1日〜週1回程度の実行なので、完全無料で運用できます。**

---

## 設定手順

### 1. 環境変数の設定 (Vercel)

Vercelの環境変数に以下を追加：

```bash
EVENTBRIDGE_SECRET_TOKEN=yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=
```

**生成方法:**
```bash
openssl rand -base64 32
```

### 2. EventBridge API Destination の作成

#### 2-1. AWS Consoleにログイン

[EventBridge Console](https://ap-northeast-1.console.aws.amazon.com/events/home?region=ap-northeast-1#/apidestinations) にアクセス

#### 2-2. Connection の作成

1. 左メニューから **「API destinations」** → **「Connections」** → **「Create connection」**
2. 設定値:
   - **Name**: `anpikakunin-training-api-connection`
   - **Destination type**: `Other`
   - **Authorization type**: `API key`
   - **API key name**: `Authorization`
   - **Value**: `Bearer yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=`
     - ⚠️ `Bearer ` を忘れずに付ける
     - ⚠️ 実際の環境変数の値を使用

3. **「Create」** をクリック

#### 2-3. API Destination の作成

1. 左メニューから **「API destinations」** → **「Create API destination」**
2. 設定値:
   - **Name**: `anpikakunin-training-trigger`
   - **API destination endpoint**: `https://anpikakunin.xyz/api/training/trigger`
     - ⚠️ 本番環境のドメインを指定
   - **HTTP method**: `POST`
   - **Invocation rate limit per second**: `10` (デフォルトのまま)
   - **Connection**: `anpikakunin-training-api-connection` (先ほど作成したもの)

3. **「Create」** をクリック

### 3. EventBridge Scheduler の作成

#### 3-1. Scheduler にアクセス

[EventBridge Scheduler Console](https://ap-northeast-1.console.aws.amazon.com/scheduler/home?region=ap-northeast-1#schedules) にアクセス

#### 3-2. Schedule の作成

1. **「Create schedule」** をクリック
2. **Schedule name and description**:
   - **Schedule name**: `anpikakunin-training-daily`
   - **Description**: `訓練モード定期実行 (毎日9時)`

3. **Schedule pattern**:
   - **Schedule type**: `Recurring schedule`
   - **Schedule pattern**: `Cron-based schedule`
   - **Cron expression**: `0 9 * * ? *`
     - 毎日9時(JST)に実行
     - ⚠️ EventBridgeのCronはUTC基準なので、JST 9時 = UTC 0時
     - **JSTで実行したい場合**: `0 0 * * ? *` (UTC 0時 = JST 9時)
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
       "trainingId": "YOUR_TRAINING_ID"
     }
     ```
     - ⚠️ `YOUR_TRAINING_ID` は実際の訓練通知IDに置き換える
     - 訓練通知IDは `/api/training/notifications` から取得可能

6. **Settings**:
   - **Maximum age of event**: `86400` (24時間)
   - **Retry policy**: `185` (デフォルト)
   - **Dead-letter queue**: `None` (任意)

7. **Permissions**:
   - **Execution role**: `Create new role for this schedule` (自動作成)

8. **「Create schedule」** をクリック

---

## Cron式の例

| 実行タイミング | Cron式 (UTC) | Cron式 (JST換算) |
|--------------|-------------|-----------------|
| 毎日9時(JST) | `0 0 * * ? *` | UTC 0時 = JST 9時 |
| 毎日12時(JST) | `0 3 * * ? *` | UTC 3時 = JST 12時 |
| 毎週月曜9時(JST) | `0 0 ? * MON *` | UTC 0時月曜 = JST 9時月曜 |
| 毎月1日9時(JST) | `0 0 1 * ? *` | UTC 0時1日 = JST 9時1日 |

**EventBridgeのCron式フォーマット:**
```
分 時 日 月 曜日 年
0  0  *  *  ?    *
```

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

## 動作確認

### 1. ローカルでのテスト

```bash
curl -X POST https://anpikakunin.xyz/api/training/trigger \
  -H "Authorization: Bearer yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=" \
  -H "Content-Type: application/json" \
  -d '{"trainingId": "YOUR_TRAINING_ID"}'
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

**対処:**
- `/api/training/notifications` から有効な訓練通知IDを取得して設定

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
2. 動作確認
3. cron-job.org のジョブを無効化
4. 既存の `/api/cron/training-send` エンドポイントは残す (削除不要)

### 既存エンドポイント

- `/api/cron/training-send` (GET) - cron-job.org用 (非推奨)
- `/api/training/trigger` (POST) - EventBridge用 (推奨)

---

## まとめ

✅ **EventBridge Scheduler のメリット:**
- 完全無料 (月1400万回まで)
- 高信頼性 (AWS SLA 99.99%)
- サービス停止リスクなし
- 設定が簡単
- リトライ・エラーハンドリングが標準装備

✅ **料金:**
- 訓練モードの実行頻度なら完全無料

✅ **推奨構成:**
- EventBridge API Destinations を使用
- Lambda不要でコスト最小
- 認証トークンでセキュリティ確保
