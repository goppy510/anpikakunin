# パスキー認証システム設計

## 概要

従来のパスワード+2FA認証から、パスキー（WebAuthn）ベースの認証システムへ移行する。

## 目的

- **セキュリティ向上**: フィッシング耐性、生体認証による多要素認証
- **UX改善**: パスワード入力不要、2FAメール待ち不要
- **緊急時対応**: 生体認証で即座にログイン可能

## 認証方式

### メイン認証: パスキー（WebAuthn）
- Touch ID / Face ID / Windows Hello
- デバイス内蔵の生体認証センサー使用
- 指紋データはデバイスから出ない（Secure Enclave/TPM保護）

### フォールバック認証: パスワード
- パスキーが使えない環境用（古いブラウザ等）
- 既存のパスワード認証を維持

### 2FA廃止
- パスキー自体が多要素認証（所有+生体）
- OTPメール送信を廃止

## データベーススキーマ

### Passkeyテーブル（新規作成）

```prisma
model Passkey {
  id                String    @id @default(uuid())
  userId            String    @map("user_id")
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // WebAuthn Credential情報
  credentialId      Bytes     @unique @map("credential_id")
  publicKey         Bytes     @map("public_key")
  counter           BigInt    @default(0)

  // デバイス情報
  deviceName        String?   @map("device_name")
  transports        String[]  @default([]) // ["usb", "nfc", "ble", "internal"]

  // タイムスタンプ
  createdAt         DateTime  @default(now()) @map("created_at")
  lastUsedAt        DateTime? @map("last_used_at")

  @@index([userId])
  @@map("passkeys")
}
```

### WebAuthnChallengeテーブル（新規作成）

```prisma
model WebAuthnChallenge {
  id         String   @id @default(uuid())
  userId     String?  @map("user_id") // 登録時はnull、ログイン時は設定
  challenge  String   @unique
  type       String   // "registration" | "authentication"
  expiresAt  DateTime @map("expires_at")
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([expiresAt])
  @@map("webauthn_challenges")
}
```

### Userテーブル（変更）

```prisma
model User {
  // 既存フィールド
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String?   @map("password_hash")

  // 削除するフィールド
  // twoFactorEnabled Boolean @default(false) @map("two_factor_enabled")

  // 新規リレーション
  passkeys      Passkey[]

  // その他既存フィールド
  // ...
}
```

## 技術スタック

### ライブラリ
- `@simplewebauthn/server@10.0.0` - サーバーサイドWebAuthn処理
- `@simplewebauthn/browser@10.0.0` - クライアントサイドWebAuthn処理

### ブラウザ要件
- Chrome 67+
- Safari 13+
- Firefox 60+
- Edge 18+

## API設計

### 1. パスキー登録

#### POST `/api/auth/passkey/registration-options`
**目的**: パスキー登録用のチャレンジ生成

**リクエスト**:
```json
{
  "userId": "uuid"
}
```

**レスポンス**:
```json
{
  "options": {
    "challenge": "base64-string",
    "rp": {
      "name": "安否確認システム",
      "id": "anpikakunin.xyz"
    },
    "user": {
      "id": "base64-user-id",
      "name": "user@example.com",
      "displayName": "user@example.com"
    },
    "pubKeyCredParams": [...],
    "timeout": 60000,
    "authenticatorSelection": {
      "residentKey": "preferred",
      "userVerification": "preferred"
    }
  }
}
```

#### POST `/api/auth/passkey/register`
**目的**: パスキー登録の検証・保存

**リクエスト**:
```json
{
  "userId": "uuid",
  "credential": {
    "id": "credential-id",
    "rawId": "base64-raw-id",
    "response": {
      "attestationObject": "base64-string",
      "clientDataJSON": "base64-string"
    },
    "type": "public-key"
  },
  "deviceName": "MacBook Pro" // オプション
}
```

**レスポンス**:
```json
{
  "success": true,
  "passkeyId": "uuid"
}
```

### 2. パスキーログイン

#### POST `/api/auth/passkey/authentication-options`
**目的**: ログイン用チャレンジ生成

**リクエスト**:
```json
{
  "email": "user@example.com"
}
```

**レスポンス**:
```json
{
  "options": {
    "challenge": "base64-string",
    "timeout": 60000,
    "rpId": "anpikakunin.xyz",
    "allowCredentials": [
      {
        "id": "base64-credential-id",
        "type": "public-key",
        "transports": ["internal"]
      }
    ],
    "userVerification": "preferred"
  }
}
```

#### POST `/api/auth/passkey/authenticate`
**目的**: パスキー認証の検証・ログイン

**リクエスト**:
```json
{
  "email": "user@example.com",
  "credential": {
    "id": "credential-id",
    "rawId": "base64-raw-id",
    "response": {
      "authenticatorData": "base64-string",
      "clientDataJSON": "base64-string",
      "signature": "base64-string",
      "userHandle": "base64-string"
    },
    "type": "public-key"
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "userId": "uuid",
  "sessionToken": "token"
}
```
+ Set-Cookie: session_token

### 3. パスキー再登録

#### POST `/api/auth/passkey/reset-request`
**目的**: パスキー再登録用のリンクをメール送信

**リクエスト**:
```json
{
  "email": "user@example.com"
}
```

**レスポンス**:
```json
{
  "message": "パスキー再登録用のリンクをメールで送信しました"
}
```

**メール内容**:
```
件名: パスキー再登録のご案内

以下のリンクからパスキーを再登録してください。
このリンクは24時間有効です。

https://anpikakunin.xyz/passkey-reset?token=xxxxx
```

#### POST `/api/auth/passkey/reset`
**目的**: トークン検証後、パスキー再登録

**リクエスト**:
```json
{
  "token": "reset-token",
  "credential": { ... }
}
```

**レスポンス**:
```json
{
  "success": true,
  "message": "パスキーを再登録しました"
}
```

### 4. パスキー管理

#### GET `/api/auth/passkey/list`
**目的**: ユーザーの登録済みパスキー一覧取得

**レスポンス**:
```json
{
  "passkeys": [
    {
      "id": "uuid",
      "deviceName": "MacBook Pro",
      "createdAt": "2025-01-25T10:00:00Z",
      "lastUsedAt": "2025-01-25T12:00:00Z"
    }
  ]
}
```

#### DELETE `/api/auth/passkey/:id`
**目的**: パスキー削除

**レスポンス**:
```json
{
  "success": true,
  "message": "パスキーを削除しました"
}
```

## フロー図

### 新規ユーザー登録フロー

```
1. メールアドレス入力
   ↓
2. パスワード設定
   ↓
3. パスキー登録（必須）
   ├─ POST /api/auth/passkey/registration-options
   ├─ ブラウザでWebAuthn API呼び出し
   ├─ 生体認証（Touch ID等）
   └─ POST /api/auth/passkey/register
   ↓
4. 登録完了・ログイン
```

### ログインフロー

```
1. メールアドレス入力
   ↓
2. 認証方式選択
   ├─ パスキー（推奨）
   │   ├─ POST /api/auth/passkey/authentication-options
   │   ├─ 生体認証（Touch ID等）
   │   └─ POST /api/auth/passkey/authenticate → ログイン成功
   │
   └─ パスワード（フォールバック）
       └─ POST /api/auth/login → ログイン成功（2FA廃止）
```

### パスキー再登録フロー

```
1. ログイン画面で「パスキーを再登録」クリック
   ↓
2. メールアドレス入力
   ↓
3. POST /api/auth/passkey/reset-request
   ↓
4. メール受信
   ↓
5. リンクをクリック
   ↓
6. パスキー登録画面
   ├─ POST /api/auth/passkey/registration-options
   ├─ 生体認証
   └─ POST /api/auth/passkey/reset
   ↓
7. 再登録完了
```

## UI設計

### ログイン画面

```
┌─────────────────────────────────┐
│    安否確認システム               │
│         ログイン                  │
├─────────────────────────────────┤
│                                 │
│  メールアドレス                   │
│  [________________]              │
│                                 │
│  ┌─────────────────────────┐   │
│  │  🔐 パスキーでログイン    │   │
│  └─────────────────────────┘   │
│                                 │
│  または                          │
│                                 │
│  パスワード                       │
│  [________________]              │
│                                 │
│  [ パスワードでログイン ]         │
│                                 │
│  パスワードをお忘れの方            │
│  パスキーを再登録                 │
└─────────────────────────────────┘
```

### パスキー登録画面（新規ユーザー）

```
┌─────────────────────────────────┐
│    パスキーの登録                 │
├─────────────────────────────────┤
│                                 │
│  セキュリティ向上のため、        │
│  パスキーを登録してください。    │
│                                 │
│  パスキーを使うと：              │
│  ✓ パスワード入力不要            │
│  ✓ 生体認証で即座にログイン      │
│  ✓ フィッシング詐欺に強い        │
│                                 │
│  デバイス名（オプション）         │
│  [MacBook Pro__]                │
│                                 │
│  [ パスキーを登録 ]               │
│                                 │
│  ※ Touch ID/Face ID等で         │
│    認証します                    │
└─────────────────────────────────┘
```

### パスキー管理画面（ユーザー設定）

```
┌─────────────────────────────────┐
│    パスキー管理                   │
├─────────────────────────────────┤
│                                 │
│  登録済みパスキー                 │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 💻 MacBook Pro            │  │
│  │ 登録: 2025/01/20          │  │
│  │ 最終使用: 2025/01/25      │  │
│  │              [ 削除 ]     │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📱 iPhone 15              │  │
│  │ 登録: 2025/01/22          │  │
│  │ 最終使用: 2025/01/24      │  │
│  │              [ 削除 ]     │  │
│  └───────────────────────────┘  │
│                                 │
│  [ + 新しいパスキーを追加 ]      │
└─────────────────────────────────┘
```

## 実装の優先順位

### Phase 1: 基本実装
1. データベーススキーマ更新
2. WebAuthnライブラリインストール
3. パスキー登録API実装
4. パスキーログインAPI実装

### Phase 2: UI実装
5. 新規ユーザー登録フローにパスキー登録追加
6. ログイン画面にパスキーログイン追加

### Phase 3: 管理機能
7. パスキー管理画面実装
8. パスキー再登録機能実装

### Phase 4: マイグレーション
9. 既存ユーザーへのパスキー登録促進
10. 2FA関連コード削除

## セキュリティ考慮事項

### チャレンジ管理
- チャレンジは1回限り使用
- 有効期限: 60秒
- 使用後は即座に削除

### RP ID設定
- 開発環境: `localhost`
- 本番環境: `anpikakunin.xyz`

### Origin検証
- WebAuthnは自動的にOriginを検証
- フィッシングサイトでは動作しない

### Counter検証
- リプレイ攻撃防止
- counterが減少したら拒否

## 既存ユーザーの移行

### 移行戦略
1. パスワード認証は残す（フォールバック）
2. ログイン時にパスキー登録を促すバナー表示
3. 「後で登録」も可能（強制しない）
4. 一定期間後、パスキー未登録ユーザーにメール通知

### 移行期間
- 3ヶ月間は両方サポート
- その後、パスキーを推奨（パスワードも残す）

## 環境変数

```bash
# WebAuthn設定
NEXT_PUBLIC_RP_NAME=安否確認システム
NEXT_PUBLIC_RP_ID=anpikakunin.xyz  # 本番環境
# NEXT_PUBLIC_RP_ID=localhost  # 開発環境

# Origin
NEXT_PUBLIC_ORIGIN=https://anpikakunin.xyz  # 本番環境
# NEXT_PUBLIC_ORIGIN=http://localhost:3000  # 開発環境
```

## テスト計画

### 単体テスト
- チャレンジ生成・検証
- 公開鍵検証
- Counter検証

### 統合テスト
- 登録フロー
- ログインフロー
- 再登録フロー

### E2Eテスト（手動）
- 各種デバイスでの動作確認
  - MacBook (Touch ID)
  - iPhone (Face ID)
  - Windows (Windows Hello)
  - Android (指紋認証)

## 参考資料

- [WebAuthn Specification](https://www.w3.org/TR/webauthn/)
- [SimpleWebAuthn Documentation](https://simplewebauthn.dev/)
- [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
