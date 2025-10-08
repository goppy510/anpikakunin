# 地震監視・Slack通知システム

## プロジェクト概要

DMData.jp の地震情報API（VXSE53）を利用して、設定したエリア・震度の地震発生時にSlackへ自動通知するシステムです。

### 主要機能
- リアルタイム地震情報監視（WebSocket接続）
- REST APIによる定期ポーリング（フォールバック）
- エリア・震度による通知条件フィルタリング
- Slackワークスペース・チャンネルへの自動通知
- 地震イベントログの永続化（PostgreSQL）
- 通知設定の管理UI

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

### 外部API
- **DMData.jp API v2** (地震情報取得)
  - WebSocket: リアルタイム配信
  - REST API: 過去データ・フォールバック
- **Slack Web API** (通知送信)

## データベーススキーマ

### EarthquakeEventLog
地震イベントの記録（重複検知用）
```prisma
model EarthquakeEventLog {
  id          Int      @id @default(autoincrement())
  eventId     String   @map("event_id")
  payloadHash String   @map("payload_hash")
  source      String   // "rest" | "websocket"
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

### データフロー

```
DMData.jp API
  ├─ WebSocket (リアルタイム)
  │   └─> WebSocketProvider
  │       └─> EventDatabase (IndexedDB)
  │       └─> POST /api/earthquake-events/log (PostgreSQL保存)
  │       └─> 通知条件チェック → Slack通知
  │
  └─ REST API (定期ポーリング)
      └─> RestEarthquakePoller
          └─> EventDatabase (IndexedDB)
          └─> POST /api/earthquake-events/log (PostgreSQL保存)
          └─> 通知条件チェック → Slack通知
```

### ディレクトリ構成

```
/src/app
  /api
    /earthquake-events/log/route.ts  # 地震ログ保存API
    /slack
      /workspaces/route.ts           # ワークスペース管理API
      /send-message/route.ts         # Slack通知API
      /interactions/route.ts         # Slackインタラクション
  /components
    /monitor                         # リアルタイム監視UI
    /safety-confirmation             # 設定画面
    /providers
      /WebSocketProvider.tsx         # WebSocket接続管理
  /lib
    /db
      /prisma.ts                     # Prismaクライアント
      /earthquakeEvents.ts           # 地震イベントDB操作
      /slackSettings.ts              # Slack設定DB操作
    /security
      /encryption.ts                 # AES-256-GCM暗号化
```

## 環境変数

```bash
# データベース
DATABASE_URL=postgres://postgres:postgres@localhost:5433/anpikakunin
DATABASE_SSL=disable  # ローカル開発時
SUPABASE_DB_URL=postgresql://...  # 本番環境（優先）
SUPABASE_DB_SSL=require

# DMData.jp API
DMDATA_API_KEY=your_api_key_here
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/oauth

# Slack トークン暗号化キー（32バイト base64）
SLACK_TOKEN_ENCRYPTION_KEY=openssl rand -base64 32で生成
```

## 開発ワークフロー

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
