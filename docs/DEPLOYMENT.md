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
- **DMData.jp アカウント**（地震情報取得に必須。デプロイ後に管理画面からAPIキーを設定）
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
3. プロジェクト作成後、**Settings** → **Database** → **Connection Info** から接続情報を取得：

   **Transaction mode (Connection Pooling)** - アプリケーション用：
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   **Session mode (Direct connection)** - マイグレーション用：
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
   ```

   **重要**: Prismaでは両方の接続URLが必要です
   - `DATABASE_URL`: Transaction mode (ポート6543)
   - `DIRECT_URL`: Session mode (ポート5432、マイグレーション専用)

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
# データベース（Supabase）- Transaction mode（Connection Pooling）
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# データベース（Supabase）- Session mode（マイグレーション用）
DIRECT_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres

# 互換性のため（一部のコードで使用）
SUPABASE_DB_URL=${DATABASE_URL}
SUPABASE_DB_SSL=require

# DMData.jp OAuth設定（ユーザーがブラウザから認証する際に使用）
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://anpikakunin.xyz/oauth

# DMData.jp APIキー（オプション：環境変数フォールバック用）
# ※ 通常は管理画面から設定するため不要。環境変数は設定されていない場合のみ使用されます
# DMDATA_API_KEY=your_api_key_here

# 基本設定
NEXT_PUBLIC_BASE_URL=https://anpikakunin.xyz

# Slack設定
SLACK_SIGNING_SECRET=本番Slackアプリのsigning secret

# Slack Bot Token暗号化キー（openssl rand -base64 32 で生成）
SLACK_TOKEN_ENCRYPTION_KEY=生成した32バイトキー

# SMTP設定（お名前.com）- パスワードリセット・招待メール送信に必要
SMTP_HOST=mail1042.onamae.ne.jp
SMTP_PORT=465
SMTP_USER=noreply@anpikakunin.xyz
SMTP_PASSWORD=[お名前.comメールパスワード]
SMTP_FROM_EMAIL=noreply@anpikakunin.xyz

# Node環境
NODE_ENV=production
```

**重要:**
- `SLACK_TOKEN_ENCRYPTION_KEY` は新規生成すること（開発環境と別）
- すべての環境変数を **Production** 環境に設定
- `SLACK_SKIP_SIGNATURE_VERIFICATION` は本番では設定しない

### 4. ドメイン設定

#### Vercel でドメイン追加
1. Vercel ダッシュボード → プロジェクト → **Settings** → **Domains**
2. `anpikakunin.xyz` を入力して **Add** をクリック
3. Vercelが表示する **DNS設定の指示を確認**
   - 例: "Set the following record on your DNS provider to continue"
   - Aレコードの値（例: `216.198.79.1`）をメモ

**重要**: IPアドレスはプロジェクトごとに異なります。必ずVercelが表示する値を使用してください。

#### お名前.com でDNS設定
1. [お名前.com](https://www.onamae.com/) にログイン
2. ドメイン設定 → `anpikakunin.xyz` → DNS設定
3. **Vercelが指示した通り**にレコードを追加：
   ```
   Type: A
   Name: @ (または anpikakunin.xyz)
   Value: [Vercelが表示したIPアドレス]  # 例: 216.198.79.1

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
4. DNS設定を保存
5. Vercelダッシュボードに戻り、ドメインのステータスが「Valid Configuration」になるまで待つ（通常1〜10分）
6. SSL証明書の自動発行を待つ（数分〜1時間）

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
# マイグレーション用（Session mode、ポート5432）
SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres

# Vercel設定
VERCEL_TOKEN=Vercelトークン（Vercel → Settings → Tokens で生成）
VERCEL_ORG_ID=上記で取得した orgId
VERCEL_PROJECT_ID=上記で取得した projectId
```

**重要**: GitHub Actionsでは`SUPABASE_DB_URL`にSession mode（ポート5432）を使用してください。Connection Pooling（ポート6543）ではマイグレーションが失敗します。

### 8. 初回ログイン後の設定

デプロイ完了後、システム管理者が以下の初期設定を行ってください：

#### 8.1. 管理者アカウント作成

1. `https://anpikakunin.xyz/register` にアクセス
2. 管理者アカウントを作成
3. `https://anpikakunin.xyz/login` でログイン

#### 8.2. DMData.jp APIキー設定（地震情報取得）

**重要**: DMData.jp APIキーが設定されていないと地震情報が一切取得できません。

##### APIキーの設定手順

1. ログイン後、管理画面にアクセス `https://anpikakunin.xyz/admin`
2. **DMData.jp 設定** セクションで **APIキーを設定** をクリック
3. DMData.jp契約ページで取得したAPIキーを入力
4. **保存** をクリック

**取得方法**:
- [DMData.jp](https://dmdata.jp/) にログイン
- マイページ → API設定 → APIキーを発行・コピー

APIキーはデータベースに暗号化保存されます。

##### サーバーサイドcron（常時実行）

APIキー設定後、Vercel Cron Jobsが1分ごとに自動実行されます：
- `/api/cron/fetch-earthquakes` が自動実行
- DMData.jp APIから最新20件の地震情報を取得
- データベースに保存（重複は自動スキップ）

**動作確認**:
1. Vercel Dashboard → プロジェクト → **Cron Jobs** タブ
   - スケジュールが表示されることを確認
2. Vercel Dashboard → **Logs** タブ
   - `/api/cron/fetch-earthquakes` のログが1分ごとに表示されることを確認
3. システム管理画面 `https://anpikakunin.xyz/admin`
   - 「サーバーサイドcron - 1分ごと」セクションで最終実行時刻を確認

##### WebSocket接続（リアルタイム監視）
ユーザーがブラウザで `/monitor` にアクセスした際、リアルタイム地震情報を受信します：

1. ログイン後、`https://anpikakunin.xyz/monitor` にアクセス
2. **DMData.jp OAuth認証**を実行：
   - 画面上の **Login to DMData** ボタンをクリック
   - DMData.jp OAuth認証画面でログイン
   - 契約を選択（地震情報が含まれる契約を選択）
   - 認証を許可
   - リダイレクト後、「認証成功」と表示されることを確認
3. リアルタイム地震情報の受信を確認：
   - 画面右上の WebSocket ステータスが **接続中**（緑）になることを確認
   - 地震発生時に自動的にイベントが表示される

**トラブルシューティング**:
- Cron Jobが実行されない → 管理画面でDMData.jp APIキーが設定されているか確認
- WebSocket接続エラー → ブラウザのコンソールログを確認
- 認証失敗 → DMData.jpアカウントの契約状態を確認

#### 8.3. Slackワークスペース連携

1. **Slack連携** セクションで **Connect to Slack** をクリック
2. Slack OAuth認証画面で権限を承認
3. 通知先チャンネルを選択
4. 通知条件（最低震度、対象地域）を設定
5. **保存** をクリック

**確認方法**:
- テスト通知を送信して、指定チャンネルに届くことを確認

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
