# 地震監視・Slack通知システム

## プロジェクト概要

DMData.jp の地震情報API（VXSE53）を利用して、設定したエリア・震度の地震発生時にSlackへ自動通知するシステムです。

### 主要機能
- リアルタイム地震情報監視（WebSocket接続）
- サーバーサイドcronによる地震情報自動取得（1分ごと）
- エリア・震度による通知条件フィルタリング
- Slackワークスペース・チャンネルへの自動通知
- 地震イベントログの永続化（PostgreSQL）
- 通知設定の管理UI
- 訓練モード（安否確認訓練）

## 技術スタック

### フロントエンド
- **Next.js 15.3** (App Router)
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **React Aria Components** (アクセシブルなUI)
- **IndexedDB** (クライアントサイドキャッシュ)

### バックエンド
- **Next.js API Routes**
- **PostgreSQL 15** (データ永続化)
- **Prisma ORM** (データベースクライアント)
- **AES-256-GCM** (Slackトークン暗号化)

### インフラ
- **Docker Compose** (ローカル開発環境)
- **Supabase** (本番PostgreSQL)
- **Vercel** (本番ホスティング)
- **AWS EventBridge Rules** (定期実行スケジューラー、無料枠内)
  - 地震情報定期取得（1分ごと）
  - 訓練モード通知（指定日時に1回）

### 外部API
- **DMData.jp API v2** (地震情報取得)
  - WebSocket: リアルタイム配信
  - REST API: サーバーサイドcron取得
- **Slack Web API** (通知送信)

## データベーススキーマ

### EarthquakeEventLog
地震イベントの記録（重複検知用）
```prisma
model EarthquakeEventLog {
  id          Int      @id @default(autoincrement())
  eventId     String   @map("event_id")
  payloadHash String   @map("payload_hash")
  source      String   // "cron" | "websocket"
  payload     Json     // 地震イベント全体
  fetchedAt   DateTime @default(now())

  @@unique([eventId, payloadHash])
  @@index([eventId])
}
```

### SlackWorkspace
Slackワークスペース情報（トークン暗号化保存）
```prisma
model SlackWorkspace {
  id                 String   @id @default(uuid())
  workspaceId        String   @unique
  name               String
  botTokenCiphertext Bytes    // AES-256-GCM暗号化
  botTokenIv         Bytes
  botTokenTag        Bytes
  isEnabled          Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  notificationSettings SlackNotificationSetting?
}
```

### SlackNotificationSetting
通知条件設定
```prisma
model SlackNotificationSetting {
  id                   String   @id @default(uuid())
  workspaceRef         String   @unique
  workspace            SlackWorkspace @relation(...)
  minIntensity         String?          // 最低震度
  targetPrefectures    String[]         // 対象都道府県
  notificationChannels Json?            // 通知先チャンネル情報
  extraSettings        Json?            // 拡張設定
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

## アーキテクチャ

### システムアーキテクチャ図

![アーキテクチャ図](docs/architecture.png)

### データフロー

```
DMData.jp API
  ├─ WebSocket (リアルタイム、ブラウザ起動時のみ)
  │   └─> WebSocketProvider (クライアントサイド)
  │       └─> EventDatabase (IndexedDB)
  │       └─> POST /api/earthquake-events/log (PostgreSQL保存)
  │       └─> 通知条件チェック → Slack通知
  │
  └─ REST API (サーバーサイドcron、常時実行)
      └─> AWS EventBridge Rules (1分ごと)
          └─> EventBridge API Destination
              └─> GET /api/cron/fetch-earthquakes (Bearer Token認証)
                  └─> DMData.jp REST API (最新20件取得)
                  └─> PostgreSQL保存 (source='cron')
                  └─> 通知条件チェック → Slack通知

訓練モード
  └─> 管理画面で訓練通知作成
      └─> 自動的にEventBridge Rule作成
          └─> 指定日時にAPI Destination経由で実行
              └─> POST /api/training/trigger (Bearer Token認証)
                  └─> Slack訓練通知送信
```

### 認証フロー

#### DMData.jp認証
```
1. APIキー認証（サーバーサイドcron用）
   - 管理画面でAPIキー登録
   - DmdataApiKeyテーブルに暗号化保存
   - getDmdataApiKey()でDB取得 → 環境変数フォールバック

2. OAuth2認証（WebSocket用）
   - ブラウザでOAuth認証フロー実行
   - DmdataOAuthTokenテーブルに保存
   - /monitorページでリアルタイム監視
```

#### EventBridgeエンドポイント認証
```
AWS EventBridge Rules
  └─> EventBridge API Destination (Connection with Bearer Token)
      └─> Authorization: Bearer <EVENTBRIDGE_SECRET_TOKEN>
          └─> /api/cron/fetch-earthquakes (地震情報取得)
          └─> /api/training/trigger (訓練モード実行)
              - EVENTBRIDGE_SECRET_TOKEN検証
              - 不正アクセス防止
              - 後方互換性のためCRON_SECRETもサポート
```

### ディレクトリ構成

```
/src/app
  /api
    /cron
      /fetch-earthquakes/route.ts   # サーバーサイドcronエンドポイント（認証付き）
    /earthquake-events/log/route.ts  # 地震ログ保存API
    /admin
      /dmdata-api-keys/route.ts      # DMData APIキー管理
      /dmdata-oauth/route.ts         # DMData OAuth管理
      /rest-poller-health/route.ts   # cron実行監視
    /slack
      /workspaces/route.ts           # ワークスペース管理API
      /send-message/route.ts         # Slack通知API
      /interactions/route.ts         # Slackインタラクション
  /components
    /monitor                         # リアルタイム監視UI
    /admin                           # 管理画面UI
      /dmdata-settings               # DMData設定画面
      /training                      # 訓練モード画面
    /providers
      /WebSocketProvider.tsx         # WebSocket接続管理
  /lib
    /db
      /prisma.ts                     # Prismaクライアント
      /earthquakeEvents.ts           # 地震イベントDB操作
      /slackSettings.ts              # Slack設定DB操作
    /dmdata
      /credentials.ts                # DMData認証情報取得
    /security
      /encryption.ts                 # AES-256-GCM暗号化
    /cron
      /earthquakeFetcher.ts          # ローカルnode-cron実装
/src/instrumentation.ts              # Next.js起動時フック（cron開始）
```

## 環境変数

```bash
# データベース
DATABASE_URL=postgres://postgres:postgres@localhost:5433/anpikakunin
DATABASE_SSL=disable  # ローカル開発時
SUPABASE_DB_URL=postgresql://...  # 本番環境（優先）
SUPABASE_DB_SSL=require

# DMData.jp 設定
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/oauth
# ※ APIキーは管理画面から設定（DB暗号化保存）
# 環境変数はフォールバックとして機能（オプション）
# DMDATA_API_KEY=your_api_key_here

# Slack設定
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
# Slack トークン暗号化キー（32バイト base64）
SLACK_TOKEN_ENCRYPTION_KEY=openssl rand -base64 32で生成

# EventBridge認証（本番必須）
EVENTBRIDGE_SECRET_TOKEN=openssl rand -base64 32で生成
CRON_SECRET=openssl rand -base64 32で生成  # 後方互換性のため残す

# EventBridge設定（訓練モード自動スケジューリング用）
EVENTBRIDGE_API_DESTINATION_ARN=arn:aws:events:ap-northeast-1:123456789012:api-destination/anpikakunin-training-trigger/...
EVENTBRIDGE_ROLE_ARN=arn:aws:iam::123456789012:role/EventBridgeRuleExecutionRole
# AWS認証情報は管理画面から設定（DB暗号化保存）

# SMTP設定（パスワードリセット・招待メール）
SMTP_HOST=mail1042.onamae.ne.jp
SMTP_PORT=465
SMTP_USER=noreply@anpikakunin.xyz
SMTP_PASSWORD=[お名前.comメールパスワード]
SMTP_FROM_EMAIL=noreply@anpikakunin.xyz

# 開発環境用（オプション）
SLACK_SKIP_SIGNATURE_VERIFICATION=true  # Slack署名検証をスキップ
```

**重要な環境変数:**
- **EVENTBRIDGE_SECRET_TOKEN**: AWS EventBridgeからのリクエスト認証に必須
- **EVENTBRIDGE_API_DESTINATION_ARN**: 訓練モード自動スケジューリングに必須
- **EVENTBRIDGE_ROLE_ARN**: EventBridge Rule実行ロールARNに必須
- **SLACK_TOKEN_ENCRYPTION_KEY**: Slack Bot Tokenの暗号化に使用
- **DMDATA_API_KEY**: 管理画面から設定（DB暗号化保存）。環境変数はフォールバック用
- **CRON_SECRET**: 後方互換性のため残す（EventBridge移行後は非推奨）

## 開発ワークフロー

### ローカル開発環境
**Docker Compose を使用**
```bash
# アプリケーション起動
docker-compose up

# アプリケーション停止・削除
docker-compose down
```

**重要な制約:**
- ローカル開発は Docker Compose のみ使用
- **許可されているコマンド: `docker-compose up` と `docker-compose down` のみ**
- `yarn dev` など、ホストマシンで直接 Node.js を実行しない
- PostgreSQL は Docker Compose で起動（ポート: 5433）

### Git操作のルール
**絶対厳守:**
- **`git push` はユーザーが明示的に指示した場合のみ実行する**
- **`git commit` 完了後、必ずユーザーに「プッシュしますか？」と確認する**
- `git commit` は実装完了時に行うが、pushはしない
- ユーザーから「プッシュして」「pushして」などの明示的な指示があるまで待機
- **勝手にプッシュしない（超重要）**

### データベース操作のルール
**絶対禁止:**
- **データベースのデータが消える操作は絶対に実行しない**
- `prisma migrate reset` は絶対禁止
- `prisma db push --force-reset` は絶対禁止
- `docker-compose down -v` （ボリューム削除）は絶対禁止
- データ削除を伴う操作を提案しない
- マイグレーション実行は `prisma migrate dev` のみ使用（データ保持）

### ブランチ戦略
- `main`: 本番環境
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発ブランチ
- **タスクごとに必ずブランチを切る**

### タスク管理
1. `.claude/task.md` にタスクを記載
2. タスクごとに `feature/タスク名` ブランチを作成
3. 実装完了後、`develop` へマージ

### 設計ドキュメント
- 設計が必要な場合は `docs/YYYY_MM_DD-設計内容.md` を作成
- アーキテクチャ変更、新機能設計時は必須

## 実装済み機能

### ✅ 完成済み
- [x] PostgreSQL / Prisma セットアップ
- [x] 地震イベントログ保存機能
- [x] Slackワークスペース管理（暗号化保存）
- [x] リアルタイムモニタリング画面（`/monitor`）
- [x] WebSocket接続による地震情報受信
- [x] IndexedDBキャッシュ

### 🚧 実装途中・未完成
- [ ] 通知条件フィルタリングロジック
- [ ] Slack通知の自動送信
- [ ] 設定画面UI（通知条件・チャンネル選択）
- [ ] REST APIポーリング実装
- [ ] エラーハンドリング・リトライ処理

## 制約事項

### 重要な制約
- **リアルタイムモニタリング（`/monitor`）は削除禁止**
- 設定画面からリアルタイムモニタリングへアクセスしない
- DMData.jp APIレート制限:
  - WebSocket: 10 req/s
  - Telegram: 20 req/s
- Slack Bot Token は必ず暗号化保存

## 今後の実装タスク

詳細は `.claude/task.md` を参照

### 優先度: 高
1. 通知条件フィルタリング実装
2. Slack自動通知機能
3. 設定画面UI完成

### 優先度: 中
4. REST APIポーリング機能
5. エラーハンドリング強化
6. ログ監視・アラート

### 優先度: 低
7. 通知履歴表示
8. 訓練モード実装
9. マルチワークスペース対応UI改善

## 参考リンク

- [DMData.jp API仕様](https://dmdata.jp/docs/reference/api/v2.html)
- [地震情報電文仕様](https://dmdata.jp/docs/telegrams/et01330/)
- [Prisma ドキュメント](https://www.prisma.io/docs)
- [Slack API](https://api.slack.com/)

## ナレッジ管理

プロジェクトの知見は以下のファイルで管理:
- `.claude/team-policy.md`: チームポリシー（作成予定）
- `.claude/team-brain.md`: メンバー思考方針（作成予定）
- `.claude/context.md`: プロジェクト背景（作成予定）
- `.claude/project-knowledge.md`: 実装パターン（作成予定）
- `.claude/project-improvements.md`: 改善記録（作成予定）
- `.claude/common-patterns.md`: 定型パターン（作成予定）
