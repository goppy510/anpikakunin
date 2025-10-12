# 本番デプロイガイド

このドキュメントでは、本番環境へのデプロイ手順を説明します。

## アーキテクチャ

### 開発環境
```
Slack開発アプリ → ngrok → localhost:8080 → PostgreSQL (Docker)
```

### 本番環境
```
Slack本番アプリ → anpikakunin.xyz → Vercel → Supabase PostgreSQL
```

## 前提条件

- GitHub アカウント
- Vercel アカウント
- Supabase アカウント
- Slack 本番用ワークスペース
- `anpikakunin.xyz` ドメインの管理権限

## セットアップ手順

### 1. Supabase プロジェクト作成

1. [Supabase](https://supabase.com/) にログイン
2. 新しいプロジェクトを作成
   - Organization: 任意
   - Project name: `anpikakunin-production`
   - Database Password: 強力なパスワードを生成・保存
   - Region: `Northeast Asia (Tokyo)` を選択
3. プロジェクト作成後、**Settings** → **Database** から接続情報を取得：
   ```
   Connection string (URI)
   postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```

### 2. Vercel プロジェクト作成

1. [Vercel](https://vercel.com/) にログイン
2. **Import Project** から GitHub リポジトリ `goppy510/anpikakunin` を選択
3. **Configure Project**:
   - Framework Preset: `Next.js`
   - Root Directory: `./`
   - Build Command: `yarn build`
   - Output Directory: `.next`
4. **Environment Variables** を設定（後述）
5. **Deploy** をクリック

### 3. 環境変数設定（Vercel）

Vercel ダッシュボード → **Settings** → **Environment Variables** で以下を設定：

```bash
# データベース（Supabase）
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_DB_SSL=require

# Slack設定
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://anpikakunin.xyz/oauth
NEXT_PUBLIC_BASE_URL=https://anpikakunin.xyz
SLACK_SIGNING_SECRET=本番Slackアプリのsigning secret

# Slack Bot Token暗号化キー（openssl rand -base64 32 で生成）
SLACK_TOKEN_ENCRYPTION_KEY=生成した32バイトキー

# Node環境
NODE_ENV=production
```

**重要:**
- `SLACK_TOKEN_ENCRYPTION_KEY` は新規生成すること（開発環境と別）
- すべての環境変数を **Production** 環境に設定
- `SLACK_SKIP_SIGNATURE_VERIFICATION` は本番では設定しない

### 4. ドメイン設定

#### Vercel でドメイン追加
1. Vercel ダッシュボード → **Settings** → **Domains**
2. `anpikakunin.xyz` を追加
3. Vercel が提供する DNS レコードをメモ

#### お名前.com でDNS設定
1. [お名前.com](https://www.onamae.com/) にログイン
2. ドメイン設定 → `anpikakunin.xyz` → DNS設定
3. Aレコードを追加：
   ```
   Type: A
   Name: @
   Value: 76.76.21.21 (Vercel IP)

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
4. 反映を待つ（最大48時間、通常は数分）

### 5. Slack 本番アプリ作成

#### 新規Slackアプリ作成
1. [Slack API](https://api.slack.com/apps) にアクセス
2. **Create New App** → **From scratch**
   - App Name: `安否確認システム（本番）`
   - Workspace: 本番用ワークスペース

#### OAuth & Permissions
**Bot Token Scopes** を追加（このアプリに必要な権限のみ）：
- `channels:read` - 通知先パブリックチャンネル情報の取得
- `chat:write` - 地震通知・訓練通知の送信（ボット参加済みチャンネル）
- `emoji:read` - 部署設定で絵文字選択に使用
- `users:read` - ユーザー名取得（安否確認応答で使用）

**注意:** 通知先チャンネルには事前にボットを招待してください（`/invite @安否確認システム（本番）`）

**Redirect URLs**:
```
https://anpikakunin.xyz/oauth
```

#### Interactivity
**Interactivity & Shortcuts** を有効化：
```
Request URL: https://anpikakunin.xyz/api/slack/interactions
```

#### Event Subscriptions（オプション）
必要に応じて設定

#### App Credentials
**Basic Information** → **App Credentials** から取得：
- **Signing Secret**: Vercel環境変数に設定

### 6. データベースマイグレーション

#### 初回セットアップ
```bash
# ローカルで実行（Supabase接続）
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
export DATABASE_SSL=require

# マイグレーション実行
npx prisma migrate deploy

# 初期データ投入
npx prisma db seed
```

### 7. GitHub Actions 設定

#### Vercel情報の取得
まず、Vercel CLIでプロジェクト情報を取得します：

```bash
# 1. Vercel CLIをインストール
npm i -g vercel

# 2. ログイン
vercel login

# 3. プロジェクトリンク（対話形式で既存プロジェクトを選択）
vercel link

# 4. .vercel/project.json から Organization ID と Project ID を取得
cat .vercel/project.json
```

`.vercel/project.json` の内容例：
```json
{
  "orgId": "team_xxxxxxxxx",
  "projectId": "prj_xxxxxxxxx"
}
```

#### GitHub Secrets 追加
リポジトリ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

以下のSecretsを追加：

```
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
VERCEL_TOKEN=Vercelトークン（Vercel → Settings → Tokens で生成）
VERCEL_ORG_ID=上記で取得した orgId
VERCEL_PROJECT_ID=上記で取得した projectId
```

## デプロイフロー

### 通常デプロイ

1. `develop` ブランチで開発
2. Pull Request を `main` へ作成
3. GitHub Actions が自動実行：
   - マイグレーション差分を表示
   - 手動承認待ち
4. **Approve** でデプロイ開始：
   - Prisma migrate deploy（Supabase）
   - Vercel デプロイ
5. デプロイ完了後、 `https://anpikakunin.xyz` で確認

### マイグレーション確認方法

PR作成時、GitHub Actions の **Summary** にマイグレーション差分が表示されます：

```
📋 マイグレーション差分:
- 新規テーブル: training_notifications
- カラム追加: slack_workspaces.is_production
```

承認前に必ず内容を確認してください。

## トラブルシューティング

### Vercelビルドエラー

**問題**: `Prisma Client not found`

**解決策**: `package.json` に以下を追加：
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

### データベース接続エラー

**問題**: `SSL connection required`

**解決策**: Vercel環境変数で `SUPABASE_DB_SSL=require` を設定

### Slack通知が届かない

**チェックリスト**:
1. Slackアプリに必要な4つのスコープが付与されているか
2. 通知先チャンネルにボットが招待されているか（`/invite @ボット名`）
3. Slack Signing Secretが正しく設定されているか
4. Bot Tokenが正しく暗号化保存されているか

### DNS反映待ち

ドメイン設定後、反映に最大48時間かかる場合があります。以下で確認：

```bash
# DNS設定確認
dig anpikakunin.xyz
nslookup anpikakunin.xyz
```

## セキュリティ

### 環境変数管理
- 本番用の `SLACK_TOKEN_ENCRYPTION_KEY` は開発環境と必ず別にする
- Supabaseパスワードは強力なものを使用（20文字以上推奨）
- Vercel Tokenは必要最小限の権限で生成

### アクセス制限
- Supabaseプロジェクトは適切なIPホワイトリストを設定
- GitHub Secretsは必要な人のみアクセス可能に

## 参考リンク

- [Vercel ドキュメント](https://vercel.com/docs)
- [Supabase ドキュメント](https://supabase.com/docs)
- [Prisma マイグレーション](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Slack API](https://api.slack.com/)
