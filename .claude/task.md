# タスク管理

## 現在の開発ブランチ
`anpiconfig`

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

### 4. REST APIポーリング機能
**ブランチ**: `feature/rest-polling`
**概要**: WebSocket切断時のフォールバック用REST API定期ポーリング
**タスク**:
- [ ] DMData.jp REST API呼び出し実装
- [ ] 定期ポーリング処理（30秒間隔）
- [ ] WebSocket接続状態による自動切り替え
- [ ] 最終取得イベントIDの管理（重複防止）

**設計ドキュメント**: `docs/2025_10_08-rest-polling.md`

### 5. エラーハンドリング強化
**ブランチ**: `feature/error-handling`
**概要**: ネットワークエラー、API障害時の堅牢性向上
**タスク**:
- [ ] WebSocket再接続ロジック改善（指数バックオフ）
- [ ] Slack通知失敗時のリトライ処理
- [ ] PostgreSQL接続エラー時のフォールバック
- [ ] エラー通知機能（管理者向けSlack通知）

### 6. ログ監視・アラート
**ブランチ**: `feature/logging-monitoring`
**概要**: システムログの構造化と監視
**タスク**:
- [ ] 構造化ログ実装（JSON形式）
- [ ] ログレベル設定（DEBUG/INFO/WARN/ERROR）
- [ ] エラーログの集約・通知

## 優先度: 低（余裕があれば）

### 7. 通知履歴表示
**ブランチ**: `feature/notification-history`
**概要**: 過去の通知履歴をUI表示
**タスク**:
- [ ] 通知履歴取得API（`/api/notifications/history`）
- [ ] 履歴表示UI
- [ ] フィルタリング・検索機能

### 8. 訓練モード実装
**ブランチ**: `feature/training-mode`
**概要**: テスト通知を送信する訓練機能
**タスク**:
- [ ] 訓練モード用の地震イベント作成
- [ ] 訓練通知送信機能
- [ ] 訓練モードON/OFF切り替えUI

### 9. マルチワークスペース対応UI改善
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

## 備考

### 次のステップ
1. 優先度「高」のタスクから順に着手
2. タスクごとに新規ブランチを作成
3. 設計が必要な場合は `docs/` にドキュメント作成
4. 実装完了後、`develop` へプルリクエスト

### ブランチ命名規則
- 機能追加: `feature/機能名`
- バグ修正: `fix/バグ内容`
- ドキュメント: `docs/ドキュメント名`

### 設計ドキュメント命名規則
`docs/YYYY_MM_DD-設計内容.md`
