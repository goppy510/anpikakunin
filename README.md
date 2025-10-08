# 地震監視・Slack通知システム

DMData.jp の地震情報APIを利用して、設定したエリア・震度の地震発生時にSlackへ自動通知するシステムです。

## 主要機能

- リアルタイム地震情報監視（WebSocket接続）
- REST APIによる定期ポーリング（フォールバック）
- エリア・震度による通知条件フィルタリング
- Slackワークスペース・チャンネルへの自動通知
- 地震イベントログの永続化（PostgreSQL）
- 通知設定の管理UI

## 技術スタック

- **Frontend**: Next.js 15.3, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL, Prisma ORM
- **Infrastructure**: Docker Compose (ローカル), Supabase (本番)
- **External API**: DMData.jp API v2, Slack Web API

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
# DMData.jp API（必須）
DMDATA_API_KEY=your_dmdata_api_key_here

# Slack トークン暗号化キー（必須）
# openssl rand -base64 32 で生成した値を設定
SLACK_TOKEN_ENCRYPTION_KEY=生成した32バイトキー

# その他の設定は .env.example のデフォルト値でOK
```

**重要:** Docker Compose使用時は、`DATABASE_URL` などの環境変数は `docker-compose.yml` で自動設定されます。

### 3. Docker Compose で起動

```bash
# アプリケーション起動
docker-compose up

# バックグラウンドで起動
docker-compose up -d
```

アプリケーションは [http://localhost:8080](http://localhost:8080) で起動します。

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

- リアルタイムモニタリング: http://localhost:8080/monitor
- 設定画面: http://localhost:8080/

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
    /earthquake-events      # 地震イベントAPI
    /slack                  # Slack連携API
  /components
    /monitor                # リアルタイム監視UI
    /safety-confirmation    # 設定画面
    /providers              # Context Providers
  /lib
    /db                     # データベース操作
    /notification           # 通知ロジック
    /security               # 暗号化

/prisma
  schema.prisma             # データベーススキーマ
  /migrations               # マイグレーションファイル

/docs                       # ドキュメント
/.claude                    # プロジェクト知見管理
```

## データベーススキーマ

### テーブル一覧

- **earthquake_event_logs**: 地震イベントログ（重複検知用）
- **slack_workspaces**: Slackワークスペース情報（暗号化トークン保存）
- **slack_notification_settings**: 通知条件設定

詳細は [docs/database-setup.md](docs/database-setup.md) を参照してください。

## ドキュメント

- [CLAUDE.md](CLAUDE.md) - プロジェクト全体概要
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
