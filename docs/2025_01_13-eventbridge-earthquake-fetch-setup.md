# EventBridge Scheduler 設定ガイド（地震情報定期取得）

## 概要

DMData.jp APIから地震情報を定期的に取得し、PostgreSQLに保存する処理を AWS EventBridge Scheduler で実現するための設定ガイドです。

cron-job.org からの移行により、以下のメリットがあります：
- **完全無料** (月1400万回まで無料、1分1回実行でも無料枠内)
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
| 30秒1回 | 86,400回 | **$0** |

**1分に1回実行しても完全無料で運用できます。**

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

### 2. EventBridge API Destination の作成

#### 2-1. AWS Consoleにログイン

[EventBridge Console](https://ap-northeast-1.console.aws.amazon.com/events/home?region=ap-northeast-1#/apidestinations) にアクセス

#### 2-2. Connection の作成

1. 左メニューから **「API destinations」** → **「Connections」** → **「Create connection」**
2. 設定値:
   - **Name**: `anpikakunin-earthquake-fetch-connection`
   - **Destination type**: `Other`
   - **Authorization type**: `API key`
   - **API key name**: `Authorization`
   - **Value**: `Bearer yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s=`
     - ⚠️ `Bearer ` を忘れずに付ける
     - ⚠️ 実際の `EVENTBRIDGE_SECRET_TOKEN` の値を使用

3. **「Create」** をクリック

#### 2-3. API Destination の作成

1. 左メニューから **「API destinations」** → **「Create API destination」**
2. 設定値:
   - **Name**: `anpikakunin-earthquake-fetch`
   - **API destination endpoint**: `https://anpikakunin.xyz/api/cron/fetch-earthquakes`
     - ⚠️ 本番環境のドメインを指定
   - **HTTP method**: `GET`
   - **Invocation rate limit per second**: `10` (デフォルトのまま)
   - **Connection**: `anpikakunin-earthquake-fetch-connection` (先ほど作成したもの)

3. **「Create」** をクリック

### 3. EventBridge Scheduler の作成

#### 3-1. Scheduler にアクセス

[EventBridge Scheduler Console](https://ap-northeast-1.console.aws.amazon.com/scheduler/home?region=ap-northeast-1#schedules) にアクセス

#### 3-2. Schedule の作成

1. **「Create schedule」** をクリック
2. **Schedule name and description**:
   - **Schedule name**: `anpikakunin-earthquake-fetch-every-minute`
   - **Description**: `地震情報定期取得 (1分ごと)`

3. **Schedule pattern**:
   - **Schedule type**: `Recurring schedule`
   - **Schedule pattern**: `Rate-based schedule`
   - **Rate expression**: `1 minute`
     - 1分ごとに実行
   - **Flexible time window**: `Off`

4. **Target**:
   - **Target API**: `EventBridge API destination`
   - **API destination**: `anpikakunin-earthquake-fetch` (先ほど作成したもの)
   - **HTTP method**: `GET`
   - **Input**: 空欄のまま（GETメソッドなのでボディ不要）

5. **Settings**:
   - **Maximum age of event**: `60` (1分)
   - **Retry policy**: `0` (リトライなし、次の1分後実行があるため)
   - **Dead-letter queue**: `None` (任意)

6. **Permissions**:
   - **Execution role**: `Create new role for this schedule` (自動作成)

7. **「Create schedule」** をクリック

---

## Cron式の例（参考）

Rate-based scheduleではなくCron-based scheduleを使う場合：

| 実行タイミング | Cron式 (UTC) |
|--------------|-------------|
| 1分ごと | `* * * * ? *` |
| 5分ごと | `*/5 * * * ? *` |
| 10分ごと | `*/10 * * * ? *` |
| 1時間ごと | `0 * * * ? *` |

**推奨: Rate-based scheduleの方がシンプルで設定ミスが少ない**

---

## API仕様

### GET /api/cron/fetch-earthquakes

**認証:**
- `Authorization: Bearer {EVENTBRIDGE_SECRET_TOKEN}`
- 後方互換性のため `CRON_SECRET` もサポート

**クエリパラメータ:** なし

**レスポンス (成功):**
```json
{
  "success": true,
  "fetched": 20,
  "saved": 3,
  "message": "Fetched 20 telegrams, saved 3 new events"
}
```

**レスポンス (認証エラー):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**レスポンス (API エラー):**
```json
{
  "success": false,
  "error": "DMData API error: 401 Unauthorized"
}
```

---

## 動作確認

### 1. ローカルでのテスト

```bash
curl -X GET https://anpikakunin.xyz/api/cron/fetch-earthquakes \
  -H "Authorization: Bearer yp5CJgxbk60tSYmzIKqtTNiaX8g0/JrjKs+4XtVc2+s="
```

**期待される結果:**
```json
{
  "success": true,
  "fetched": 20,
  "saved": 2,
  "message": "Fetched 20 telegrams, saved 2 new events"
}
```

### 2. EventBridge のテスト実行

1. EventBridge Scheduler Console で作成したScheduleを選択
2. **「Actions」** → **「Run schedule now」** をクリック
3. Prisma Studio または PostgreSQL で `EarthquakeEventLog` テーブルにデータが保存されているか確認

```sql
SELECT * FROM "EarthquakeEventLog" ORDER BY "fetchedAt" DESC LIMIT 10;
```

---

## トラブルシューティング

### 401 Unauthorized

**原因:**
- `EVENTBRIDGE_SECRET_TOKEN` が設定されていない
- Authorizationヘッダーの形式が誤っている

**対処:**
1. Vercel環境変数を確認: `EVENTBRIDGE_SECRET_TOKEN`
2. ConnectionのAPI key valueが `Bearer {token}` の形式になっているか確認

### 500 Internal Server Error

**原因:**
- `DMDATA_API_KEY` が設定されていない
- DMData.jp APIがエラーを返している

**対処:**
1. Vercel環境変数を確認: `DMDATA_API_KEY` または `DATABASE_URL`
2. DMData.jp APIの契約状況を確認
3. Prisma Studioで `DmdataCredential` テーブルを確認

### データが保存されない

**原因:**
- 既に保存済みのデータ（重複チェックでスキップ）
- DMData.jp APIから新しいデータがない

**対処:**
- レスポンスの `fetched` と `saved` を確認
- `saved: 0` の場合は重複または新規データなし（正常動作）

---

## cron-job.org からの移行

### 移行手順

1. EventBridge Schedulerを設定 (上記手順)
2. 動作確認（数分間様子を見る）
3. cron-job.org のジョブを無効化または削除
4. 既存の `/api/cron/fetch-earthquakes` エンドポイントはそのまま使用

### 既存エンドポイント

- `/api/cron/fetch-earthquakes` (GET) - cron-job.org / EventBridge 両対応

---

## 監視・ログ確認

### EventBridge 実行履歴

1. EventBridge Scheduler Console
2. 作成したScheduleを選択
3. **「Monitoring」** タブで実行履歴を確認

### アプリケーションログ

Vercelのログで以下を確認:
- 成功: `Fetched X telegrams, saved Y new events`
- エラー: `DMData API error: ...`

---

## まとめ

✅ **EventBridge Scheduler のメリット:**
- 完全無料 (月1400万回まで、1分1回実行でも無料枠内)
- 高信頼性 (AWS SLA 99.99%)
- サービス停止リスクなし
- 設定が簡単
- リトライ・エラーハンドリングが標準装備

✅ **料金:**
- 1分に1回実行しても完全無料

✅ **推奨構成:**
- EventBridge API Destinations を使用
- Lambda不要でコスト最小
- Bearer Token認証でセキュリティ確保
- Rate-based schedule (1 minute) でシンプルに設定
