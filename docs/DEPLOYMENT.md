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
**Bot Token Scopes** を追加：
- `channels:history` - チャンネル履歴の読み取り
- `channels:read` - パブリックチャンネル情報の読み取り
- `chat:write` - メッセージの投稿
- `chat:write.public` - ボットが参加していないパブリックチャンネルへの投稿
- `emoji:read` - 絵文字情報の読み取り
- `groups:read` - プライベートチャンネル情報の読み取り
- `users:read` - ユーザー情報の読み取り

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

#### GitHub Secrets 追加
リポジトリ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

```
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
VERCEL_TOKEN=Vercelトークン（Vercel → Settings → Tokens で生成）
VERCEL_ORG_ID=VercelのOrganization ID
VERCEL_PROJECT_ID=VercelのProject ID
```

#### Vercel情報の取得方法
```bash
# Vercel CLIをインストール
npm i -g vercel

# ログイン
vercel login

# プロジェクトリンク
vercel link

# .vercel/project.json から取得
cat .vercel/project.json
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

### ロールバック

問題が発生した場合：

1. Vercel ダッシュボード → **Deployments**
2. 前のデプロイメントを選択 → **Promote to Production**
3. データベースは手動でロールバック（慎重に！）

## トラブルシューティング

### デプロイが失敗する

1. Vercel ログを確認
2. 環境変数が正しく設定されているか確認
3. マイグレーションエラーの場合、Supabase接続を確認

### Slack通知が届かない

1. Slack Request URL が `https://anpikakunin.xyz/api/slack/interactions` になっているか確認
2. Vercel環境変数の `SLACK_SIGNING_SECRET` を確認
3. Vercel Function Logs でエラーを確認

### データベース接続エラー

1. `SUPABASE_DB_URL` が正しいか確認
2. `SUPABASE_DB_SSL=require` が設定されているか確認
3. Supabase ダッシュボードでプロジェクトが起動しているか確認

## セキュリティ

### 本番環境での注意事項

1. **環境変数の管理**
   - 絶対にGitにコミットしない
   - Vercel環境変数は **Production** のみに設定

2. **Slack署名検証**
   - `SLACK_SKIP_SIGNATURE_VERIFICATION` は設定しない
   - 正しい `SLACK_SIGNING_SECRET` を設定

3. **データベースアクセス**
   - Supabase Row Level Security (RLS) は不要（管理画面のみ）
   - 環境変数で接続情報を管理

4. **APIキーの暗号化**
   - `SLACK_TOKEN_ENCRYPTION_KEY` は強力なキーを生成
   - 開発環境と本番環境で別のキーを使用

## 監視とログ

### Vercel
- **Function Logs**: リアルタイムログ確認
- **Analytics**: パフォーマンス監視

### Supabase
- **Database**: クエリパフォーマンス
- **Logs**: エラーログ

## バックアップ

### データベースバックアップ

Supabase は自動バックアップを提供（Pro プラン以上）

手動バックアップ:
```bash
# ローカルにダンプ
pg_dump $SUPABASE_DB_URL > backup.sql

# リストア
psql $SUPABASE_DB_URL < backup.sql
```

## コスト

### 無料枠
- **Vercel**: Hobby プラン（個人利用）
- **Supabase**: Free プラン（500MB DB、2GB転送）

### 有料プラン検討時期
- DB容量が500MBを超える場合
- 同時接続数が多い場合
- バックアップ・自動スケーリングが必要な場合
