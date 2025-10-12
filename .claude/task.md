# タスク管理

## 現在の開発ブランチ
`feature/dmdata-api-integration`

## 進行中: DMData.jp API統合

### DMData.jp REST API定期取得バッチ実装
**ブランチ**: `feature/dmdata-api-integration`
**概要**: DMData.jp APIから1分間隔で地震情報を取得し、通知条件に合致する場合にSlack通知
**実行環境**: Docker Compose（バッチ処理用コンテナ）

**タスク**:
- [ ] task.mdを作成（このファイル）
- [ ] Docker Composeにバッチコンテナを追加
- [ ] DMData.jp REST API取得処理を実装
  - 既存のWebSocket認証ロジックを共通化（`DMDATA_API_KEY`使用）
  - `/v2/telegram` エンドポイントから地震情報取得
  - パラメータ: `type=VXSE53&limit=10`
- [ ] 1分間隔バッチスクリプトを実装
  - Node.jsスクリプト（`scripts/fetch-earthquakes-batch.ts`）
  - cron形式で1分ごとに実行
  - 重複検知（eventId + payloadHash）
- [ ] 通知条件フィルタリング統合
  - 既存の通知条件テーブルから設定取得
  - 条件に合致する場合のみSlack通知
- [ ] PostgreSQLへのイベントログ保存
  - 既存の `/api/earthquake-events/log` を使用
- [ ] エラーハンドリング・リトライ処理
  - API障害時の指数バックオフ
  - ログ出力

**技術スタック**:
- Docker Compose: バッチコンテナ定義
- Node.js + TypeScript: バッチスクリプト
- node-cron: スケジューリング
- axios: HTTP通信
- Prisma: データベース操作

**参考実装**:
- `/src/app/components/providers/WebSocketProvider.tsx`: DMData.jp WebSocket接続（認証ロジック参考）
- `/src/app/components/monitor/utils/restEarthquakePoller.ts`: REST API取得実装（既存）
- `/src/app/api/earthquake-events/log/route.ts`: イベントログ保存API

**設計ドキュメント**: `docs/2025_10_10-dmdata-api-batch-integration.md`

---

## 優先度: 高（即時着手）

### 1. 通知条件フィルタリング実装
**ブランチ**: `feature/notification-filtering`
**概要**: 設定した震度・エリア条件に合致する地震のみSlack通知
**タスク**:
- [ ] 震度判定ロジック実装（震度文字列の大小比較）
- [ ] 都道府県マッチング実装（配列内検索）
- [ ] 通知条件チェック関数作成（`shouldNotify(event, settings)`）
- [ ] WebSocketProvider / RestPollerから呼び出し
- [ ] ユニットテスト作成

**設計ドキュメント**: `docs/2025_10_08-notification-filtering.md`

### 2. Slack自動通知機能
**ブランチ**: `feature/slack-auto-notification`
**概要**: 地震イベント受信時に自動でSlackへメッセージ送信
**タスク**:
- [ ] Slack通知メッセージフォーマット設計
- [ ] `/api/slack/send-message` APIの修正（ワークスペースID対応）
- [ ] WebSocketProviderからの通知トリガー実装
- [ ] エラーハンドリング・リトライ処理
- [ ] 通知成功/失敗ログ記録

**設計ドキュメント**: `docs/2025_10_08-slack-notification.md`

### 3. 設定画面UI完成
**ブランチ**: `feature/settings-ui`
**概要**: 通知条件を設定するUIの完成
**タスク**:
- [ ] 震度選択UI（ドロップダウン or ラジオボタン）
- [ ] 都道府県選択UI（チェックボックス or マルチセレクト）
- [ ] 通知チャンネル選択UI（Slack APIからチャンネル一覧取得）
- [ ] 設定保存APIとの連携
- [ ] バリデーション追加

**参考**: 既存の `SafetyConfirmationSettings.tsx` を拡張

## 優先度: 中（高優先度完了後）

### 4. エラーハンドリング強化
**ブランチ**: `feature/error-handling`
**概要**: ネットワークエラー、API障害時の堅牢性向上
**タスク**:
- [ ] WebSocket再接続ロジック改善（指数バックオフ）
- [ ] Slack通知失敗時のリトライ処理
- [ ] PostgreSQL接続エラー時のフォールバック
- [ ] エラー通知機能（管理者向けSlack通知）

### 5. ログ監視・アラート
**ブランチ**: `feature/logging-monitoring`
**概要**: システムログの構造化と監視
**タスク**:
- [ ] 構造化ログ実装（JSON形式）
- [ ] ログレベル設定（DEBUG/INFO/WARN/ERROR）
- [ ] エラーログの集約・通知

## 優先度: 低（余裕があれば）

### 6. 通知履歴表示
**ブランチ**: `feature/notification-history`
**概要**: 過去の通知履歴をUI表示
**タスク**:
- [ ] 通知履歴取得API（`/api/notifications/history`）
- [ ] 履歴表示UI
- [ ] フィルタリング・検索機能

### 7. 訓練モード実装
**ブランチ**: `feature/training-mode`
**概要**: テスト通知を送信する訓練機能
**タスク**:
- [ ] 訓練モード用の地震イベント作成
- [ ] 訓練通知送信機能
- [ ] 訓練モードON/OFF切り替えUI

### 8. マルチワークスペース対応UI改善
**ブランチ**: `feature/multi-workspace-ui`
**概要**: 複数ワークスペース管理UIの改善
**タスク**:
- [ ] ワークスペース切り替えUI
- [ ] ワークスペースごとの設定表示
- [ ] 一括設定機能

## 完了済み

- [x] PostgreSQL / Prisma セットアップ
- [x] 地震イベントログ保存機能
- [x] Slackワークスペース管理（暗号化保存）
- [x] リアルタイムモニタリング画面
- [x] WebSocket接続実装
- [x] IndexedDBキャッシュ
- [x] 認証・認可システム実装
- [x] 管理画面実装（メンバー管理、グループ管理、権限管理）
- [x] メンバー招待機能（メール送信）
- [x] パスワード変更機能

## 備考

### 次のステップ
1. 現在のタスク（DMData.jp API統合）を完了
2. 優先度「高」のタスクから順に着手
3. タスクごとに新規ブランチを作成
4. 設計が必要な場合は `docs/` にドキュメント作成
5. 実装完了後、`develop` へプルリクエスト

### ブランチ命名規則
- 機能追加: `feature/機能名`
- バグ修正: `fix/バグ内容`
- ドキュメント: `docs/ドキュメント名`

### 設計ドキュメント命名規則
`docs/YYYY_MM_DD-設計内容.md`
