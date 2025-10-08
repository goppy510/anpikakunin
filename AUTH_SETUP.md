# 認証システムセットアップガイド

## 概要

このシステムは2段階認証（メール+パスワード → OTP）とロールベースアクセス制御（RBAC）を実装しています。

## 権限レベル

- **ADMIN（管理者）**: すべての機能にアクセス可能
  - Slackワークスペース管理
  - メンバー管理・招待
  - 地震通知設定
  - データ移行

- **EDITOR（設定権限）**: 地震通知設定のみ
  - 震度・エリア設定
  - メッセージテンプレート編集

## セットアップ手順

### 1. 環境変数設定

`.env`ファイルに以下を追加：

```env
# データベース
DATABASE_URL=postgres://postgres:postgres@postgres:5432/anpikakunin

# 暗号化キー（Bot Token用）
SLACK_TOKEN_ENCRYPTION_KEY=<32バイトのbase64文字列>

# メール送信（Resend）- オプション
RESEND_API_KEY=re_xxxxxxxxxxxx
SYSTEM_EMAIL_FROM=noreply@yourdomain.com

# 環境
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:8080
```

### 2. データベースマイグレーション

```bash
# Docker環境起動
docker-compose up -d

# マイグレーション実行（初回のみ）
docker-compose exec anpikakunin npx prisma migrate deploy
```

### 3. 初回管理者作成

```bash
docker-compose exec anpikakunin npx ts-node scripts/create-admin.ts
```

対話形式で以下を入力：
- メールアドレス
- パスワード（8文字以上、英数字含む）

## 使用方法

### ログイン

1. http://localhost:8080/login にアクセス
2. メールアドレスとパスワードを入力
3. Docker logsでOTPコードを確認:
   ```bash
   docker-compose logs anpikakunin -f | grep "OTPコード"
   ```
4. 6桁のOTPコードを入力
5. ログイン完了

### ダッシュボード

- **管理者**: http://localhost:8080/admin
- **設定権限**: http://localhost:8080/settings

## メール送信について

### 開発環境

Resend APIキーが未設定の場合、メールは送信されず、代わりにDocker logsに出力されます：

```bash
docker-compose logs anpikakunin -f
```

出力例：
```
=== 🔐 OTPコード（開発環境） ===
宛先: admin@example.com
認証コード: 123456
有効期限: 5分
==============================
```

### 本番環境

1. Resendでアカウント作成: https://resend.com
2. APIキーを取得
3. ドメイン認証（メール送信用）
4. `.env`にAPIキーとドメインを設定

## APIエンドポイント

### 認証API

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/auth/login` | POST | メール+パスワード認証、OTP送信 |
| `/api/auth/verify-otp` | POST | OTP検証、セッション作成 |
| `/api/auth/session` | GET | 現在のセッション取得 |
| `/api/auth/logout` | POST | ログアウト |

### リクエスト例

#### ログイン

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

#### OTP検証

```bash
curl -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","code":"123456"}'
```

## トラブルシューティング

### ログインできない

1. Docker logsでエラー確認:
   ```bash
   docker-compose logs anpikakunin --tail=50
   ```

2. データベース接続確認:
   ```bash
   docker-compose exec postgres psql -U postgres -d anpikakunin -c "SELECT email, role FROM users;"
   ```

### OTPコードが届かない

開発環境では、Docker logsにOTPコードが出力されます：
```bash
docker-compose logs anpikakunin -f | grep "OTPコード"
```

### セッションが切れる

セッション有効期限は7日です。再度ログインしてください。

## セキュリティ

- パスワード: bcrypt（saltRounds: 10）でハッシュ化
- Slack Bot Token: AES-256-GCM で暗号化
- OTP: 6桁数字、5分有効、使い捨て
- セッション: HttpOnly Cookie、7日有効

## 次のステップ

1. メンバー招待機能の実装
2. Slackワークスペース管理UIの実装
3. 地震通知設定の保存機能
4. メッセージテンプレート保存機能

詳細は `docs/2025_10_08-authentication-authorization-system-design.md` を参照してください。
