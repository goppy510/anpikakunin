# データベースセットアップ手順

## 前提条件
- Docker と Docker Compose がインストール済み
- `.env` ファイルに `DATABASE_URL` が設定済み

## 初回セットアップ

### 1. Docker Compose でPostgreSQLを起動

```bash
docker-compose up -d
```

PostgreSQLコンテナが起動し、`localhost:5433` で接続できるようになります。

### 2. Prismaマイグレーションを適用

**Docker Compose環境の場合:**

```bash
# アプリケーションコンテナ内でマイグレーション実行
docker-compose exec anpikakunin npx prisma migrate deploy
```

**または、Prisma Clientを生成してからマイグレーション:**

```bash
# Prisma Clientの生成
docker-compose exec anpikakunin npx prisma generate

# マイグレーション適用
docker-compose exec anpikakunin npx prisma migrate deploy
```

### 3. マイグレーション適用の確認

```bash
# PostgreSQLコンテナに接続
docker exec -it anpikakunin-postgres psql -U postgres -d anpikakunin

# テーブル一覧を表示
\dt

# 期待される出力:
#  Schema |              Name               | Type  |  Owner
# --------+---------------------------------+-------+----------
#  public | earthquake_event_logs           | table | postgres
#  public | slack_notification_settings     | table | postgres
#  public | slack_workspaces                | table | postgres
#  public | _prisma_migrations              | table | postgres

# PostgreSQL接続を終了
\q
```

## テーブル構造

### earthquake_event_logs
地震イベントのログを保存（重複検知用）

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | SERIAL | プライマリキー |
| event_id | TEXT | イベントID |
| payload_hash | TEXT | ペイロードのSHA-256ハッシュ |
| source | TEXT | データソース（rest/websocket） |
| payload | JSONB | 地震イベント全体のJSON |
| fetched_at | TIMESTAMP | 取得日時 |

**制約:**
- UNIQUE(event_id, payload_hash) - 重複防止
- INDEX(event_id) - 検索高速化

### slack_workspaces
Slackワークスペース情報（暗号化されたトークンを保存）

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | プライマリキー |
| workspace_id | TEXT | SlackワークスペースID（ユニーク） |
| name | TEXT | ワークスペース名 |
| bot_token_ciphertext | BYTEA | AES-256-GCM暗号化されたBotToken |
| bot_token_iv | BYTEA | 暗号化IV（初期化ベクトル） |
| bot_token_tag | BYTEA | 暗号化認証タグ |
| is_enabled | BOOLEAN | 有効/無効フラグ |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

**制約:**
- UNIQUE(workspace_id)
- INDEX(workspace_id)

### slack_notification_settings
通知条件設定

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID | プライマリキー |
| workspace_ref | UUID | ワークスペース参照（外部キー） |
| min_intensity | TEXT | 最低震度（例: "4", "5弱"） |
| target_prefectures | TEXT[] | 対象都道府県配列 |
| notification_channels | JSONB | 通知先チャンネル情報 |
| extra_settings | JSONB | 拡張設定 |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

**制約:**
- UNIQUE(workspace_ref) - 1ワークスペース1設定
- FOREIGN KEY(workspace_ref) REFERENCES slack_workspaces(id) ON DELETE CASCADE

## マイグレーション管理

### 新しいマイグレーションの作成（開発時）

**重要: スキーマ変更は必ず `prisma/schema.prisma` を編集してから実行**

```bash
# Docker Compose環境で実行
docker-compose exec anpikakunin npx prisma migrate dev --name migration_description
```

例:
```bash
# 新しいカラムを追加するマイグレーション
docker-compose exec anpikakunin npx prisma migrate dev --name add_email_to_workspace
```

### マイグレーション履歴の確認

```bash
docker-compose exec anpikakunin npx prisma migrate status
```

### マイグレーションのロールバック

Prismaは自動ロールバックをサポートしていません。手動でロールバックする場合:

```bash
# PostgreSQLに接続
docker exec -it anpikakunin-postgres psql -U postgres -d anpikakunin

# マイグレーション履歴を確認
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;

# 手動でテーブルを削除（例）
DROP TABLE IF EXISTS new_table_name;

# マイグレーション履歴から削除
DELETE FROM _prisma_migrations WHERE migration_name = '20251008123456_migration_name';

\q
```

## トラブルシューティング

### マイグレーションが失敗する場合

```bash
# Prisma Clientを再生成
docker-compose exec anpikakunin npx prisma generate

# データベース接続を確認
docker-compose exec anpikakunin npx prisma db pull
```

### データベースをリセットしたい場合

**警告: 全データが削除されます**

```bash
# すべてのテーブルを削除してマイグレーション再実行
docker-compose exec anpikakunin npx prisma migrate reset
```

### 接続エラーが出る場合

1. PostgreSQLコンテナが起動しているか確認:
   ```bash
   docker-compose ps
   ```

2. `.env` ファイルの `DATABASE_URL` を確認:
   ```
   DATABASE_URL=postgres://postgres:postgres@postgres:5432/anpikakunin
   ```

3. コンテナを再起動:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## 本番環境（Supabase）へのマイグレーション

本番環境ではSupabaseを使用します。

### 1. Supabase接続文字列を取得

Supabaseダッシュボード → Settings → Database → Connection string (URI)

### 2. 環境変数を設定

```bash
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres
SUPABASE_DB_SSL=require
```

### 3. マイグレーション適用

```bash
# 本番環境のDATABASE_URLを指定してマイグレーション
DATABASE_URL=$SUPABASE_DB_URL npx prisma migrate deploy
```

## 参考資料

- [Prisma Migrate ドキュメント](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL ドキュメント](https://www.postgresql.org/docs/)
- [Supabase ドキュメント](https://supabase.com/docs/guides/database)
