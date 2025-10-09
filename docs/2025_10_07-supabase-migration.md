# Supabase / PostgreSQL 移行メモ

## 背景
- 地震イベントログの永続化先を IndexedDB から Supabase（PostgreSQL）へ移行する。
- 本番環境は Supabase を利用し、ローカル開発時は同等スキーマを持つ PostgreSQL を用いる。

## テーブル構成
```sql
CREATE TABLE IF NOT EXISTS earthquake_event_logs (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_earthquake_event_logs_event_id
  ON earthquake_event_logs (event_id);
```

- `payload_hash` は地震イベントの JSON を SHA-256 化したもの。重複通知防止に利用。
- `source` は `rest` / `websocket` を想定。

### Slack ワークスペース／通知設定

```sql
-- ワークスペースと暗号化済みトークンを保存
CREATE TABLE IF NOT EXISTS slack_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bot_token_ciphertext BYTEA NOT NULL,
  bot_token_iv BYTEA NOT NULL,
  bot_token_tag BYTEA NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_workspaces_workspace_id
  ON slack_workspaces (workspace_id);

-- ワークスペース単位の通知条件
CREATE TABLE IF NOT EXISTS slack_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_ref UUID NOT NULL REFERENCES slack_workspaces(id) ON DELETE CASCADE,
  min_intensity TEXT,
  target_prefectures TEXT[],
  notification_channels JSONB,
  extra_settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_ref)
);
```

- Bot Token は AES-256-GCM で暗号化したバイナリ (`ciphertext`, `iv`, `tag`) を保存する。
- `notification_channels` は Slack チャンネル ID や用途種別を保持する JSON。
- `extra_settings` は将来的な拡張用の JSON。

## 環境変数
| 変数名 | 用途 | 備考 |
| --- | --- | --- |
| `SUPABASE_DB_URL` | 本番 Supabase の接続文字列 | `DATABASE_URL` より優先 |
| `SUPABASE_DB_SSL` | SSL 設定 (`require` / `verify-full` / `disable`) | 未指定時は `require` |
| `DATABASE_URL` | ローカル PostgreSQL 接続文字列 | 例: `postgres://user:password@localhost:5433/anpikakunin` |
| `DATABASE_SSL` | ローカル SSL 設定 | ローカルのみ使用する場合は `disable` 推奨 |
| `SLACK_TOKEN_ENCRYPTION_KEY` | Slack Bot Token を暗号化する 32 バイトの base64 キー | AES-256-GCM 用（例: `openssl rand -base64 32`） |

`.env` 例:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5433/anpikakunin
DATABASE_SSL=disable
SLACK_TOKEN_ENCRYPTION_KEY=...
```

Supabase で取得した `Connection string` をそのまま `SUPABASE_DB_URL` に設定すれば動作する。

## ローカル PostgreSQL セットアップ例（docker-compose）
```yaml
services:
  postgres:
    image: postgres:15
    container_name: anpi-postgres
    environment:
      POSTGRES_DB: anpikakunin
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
```

セットアップ後に上記テーブル作成 SQL を適用する。

## 実装メモ
- Prisma を導入したため、依存追加後は `npx prisma generate` を実行してクライアントを生成する。
- 本番／検証環境では `npx prisma migrate deploy` でスキーマ差分を適用する。
- `@prisma/client` / `prisma` を追加し、`src/app/lib/db/prisma.ts` でクライアントを共有。
- `src/app/api/earthquake-events/log/route.ts` から Supabase/PostgreSQL にイベントを挿入。
- Slack ワークスペース関連 API (`src/app/api/slack/workspaces/route.ts`) で Bot Token を暗号化保存。
- フロントエンド (`WebSocketProvider`) は新 API を叩き、重複時は Slack 通知を抑止。
- 既存の IndexedDB は地震イベントキャッシュ用途として継続利用。ログ履歴は DB 側で一元管理。
