# 地震監視・Slack通知システム

DMData.jp の地震情報APIを利用して、設定したエリア・震度の地震発生時にSlackへ自動通知するシステムです。

## 主要機能

- **地震情報取得**
  - サーバーサイドcron（外部cronサービス）で1分間隔自動取得
  - WebSocket接続によるリアルタイム監視（ブラウザ起動時）
- **通知機能**
  - エリア・震度による通知条件フィルタリング
  - Slackワークスペース・チャンネルへの自動通知
  - 訓練モード（安否確認訓練）
- **データ管理**
  - 地震イベントログの永続化（PostgreSQL）
  - 重複検知機能（eventId + payloadHash）
  - DMData.jp APIキー暗号化保存
- **管理UI**
  - メンバー管理・権限管理
  - グループ管理
  - 通知設定の管理
  - DMData.jp設定画面

## 技術スタック

- **Frontend**: Next.js 15.3, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL, Prisma ORM
- **Infrastructure**:
  - ローカル: Docker Compose, node-cron
  - 本番: Vercel, Supabase, cron-job.org（外部cronサービス）
- **External API**: DMData.jp API v2, Slack Web API
- **Security**: AES-256-GCM暗号化（Slack Token, DMData APIキー）

## 開発環境セットアップ

### 前提条件

- Docker と Docker Compose がインストール済み
- Git がインストール済み

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd anpikakunin
```

### 2. 環境変数の設定

`.env` ファイルを作成（`.env.example` を参考に）:

```bash
# .env.example をコピー
cp .env.example .env

# 暗号化キーを生成
openssl rand -base64 32
```

`.env` ファイルを編集して以下を設定:

```bash
# Slack トークン暗号化キー（必須）
# openssl rand -base64 32 で生成した値を設定
SLACK_TOKEN_ENCRYPTION_KEY=生成した32バイトキー

# Cron Secret（ローカルnode-cron用、オプション）
CRON_SECRET=生成した32バイトキー

# その他の設定は .env.example のデフォルト値でOK
```

**注:**
- **DMData.jp APIキー**: 起動後に管理画面（`/admin/dmdata-settings`）から設定
- **CRON_SECRET**: ローカル開発では設定不要（開発環境は認証スキップ）

**重要:** Docker Compose使用時は、`DATABASE_URL` などの環境変数は `docker-compose.yml` で自動設定されます。

### 3. Docker Compose で起動

```bash
# アプリケーション起動
docker-compose up

# バックグラウンドで起動
docker-compose up -d
```

**起動されるコンテナ:**
- `anpikakunin`: Next.jsアプリケーション (http://localhost:8080)
  - node-cronでサーバーサイド地震情報取得（1分間隔）
  - Next.js instrumentation hookで自動起動
- `postgres`: PostgreSQLデータベース (port 5433)

### 4. データベースのセットアップ

初回起動時にPrismaマイグレーションを適用:

```bash
# Prisma Clientを生成
docker-compose exec anpikakunin npx prisma generate

# マイグレーションを適用
docker-compose exec anpikakunin npx prisma migrate deploy
```

詳細は [docs/database-setup.md](docs/database-setup.md) を参照してください。

### 5. 動作確認

- **管理画面**: http://localhost:8080/admin
  - 初回ログイン用管理者アカウントを作成:
    ```bash
    docker-compose exec anpikakunin yarn tsx scripts/create-admin.ts
    ```
  - DMData.jp APIキー設定: http://localhost:8080/admin/dmdata-settings
- **リアルタイムモニタリング**: http://localhost:8080/monitor
- **cron実行ログ確認**:
  ```bash
  docker-compose logs -f anpikakunin | grep Cron
  ```

## 停止方法

```bash
# コンテナを停止・削除
docker-compose down

# ボリュームも削除（データベースも削除される）
docker-compose down -v
```

## 開発ワークフロー

### ブランチ戦略

- `main`: 本番環境
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発ブランチ

### タスク管理

1. `.claude/task.md` でタスクを確認
2. `feature/タスク名` ブランチを作成
3. 実装完了後、`develop` へマージ

## プロジェクト構成

```
/src/app
  /api                      # Next.js APIルート
    /cron
      /fetch-earthquakes    # サーバーサイドcronエンドポイント（認証付き）
    /earthquake-events      # 地震イベントAPI
    /admin                  # 管理API
      /dmdata-api-keys      # DMData APIキー管理
      /rest-poller-health   # cron実行監視
    /slack                  # Slack連携API
    /auth                   # 認証API
  /admin                    # 管理画面
    /dmdata-settings        # DMData設定画面
    /training               # 訓練モード画面
  /components
    /monitor                # リアルタイム監視UI
    /providers              # Context Providers
  /lib
    /db                     # データベース操作
    /dmdata                 # DMData認証情報取得
    /notification           # 通知ロジック
    /security               # 暗号化
    /auth                   # 認証ロジック
    /cron                   # ローカルnode-cron実装
/src/instrumentation.ts     # Next.js起動時フック（cron開始）

/prisma
  schema.prisma             # データベーススキーマ
  /migrations               # マイグレーションファイル

/docs                       # ドキュメント
/.claude                    # プロジェクト知見管理
```

## データベーススキーマ

### 主要テーブル

- **earthquake_event_logs**: 地震イベントログ（重複検知用、source='cron'/'websocket'）
- **dmdata_api_keys**: DMData.jp APIキー（暗号化保存）
- **dmdata_oauth_tokens**: DMData.jp OAuth2トークン（WebSocket用）
- **slack_workspaces**: Slackワークスペース情報（暗号化トークン保存）
- **earthquake_notification_conditions**: 通知条件設定
- **earthquake_records**: 地震情報記録（震度3以上）
- **training_notifications**: 訓練通知履歴

詳細は [prisma/schema.prisma](prisma/schema.prisma) を参照してください。

## ドキュメント

- [CLAUDE.md](CLAUDE.md) - プロジェクト全体概要（アーキテクチャ、データフロー）
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - 本番デプロイガイド（Vercel, Supabase, cron-job.org）
- [docs/database-setup.md](docs/database-setup.md) - データベースセットアップ手順
- [docs/2025_10_08-earthquake-notification-system-design.md](docs/2025_10_08-earthquake-notification-system-design.md) - システム設計書
- [.claude/task.md](.claude/task.md) - タスク管理
- [.claude/](/.claude/) - プロジェクト知見管理

## トラブルシューティング

### Docker起動エラー

```bash
# コンテナとボリュームを削除して再起動
docker-compose down -v
docker-compose up
```

### データベース接続エラー

```bash
# PostgreSQLコンテナの状態確認
docker-compose ps

# ログ確認
docker-compose logs postgres
```

### マイグレーションエラー

詳細は [docs/database-setup.md](docs/database-setup.md) の「トラブルシューティング」セクションを参照してください。

## ライセンス

TBD

## 参考資料

- [DMData.jp API仕様](https://dmdata.jp/docs/reference/api/v2.html)
- [Prisma ドキュメント](https://www.prisma.io/docs)
- [Next.js ドキュメント](https://nextjs.org/docs)
- [Slack API](https://api.slack.com/)
