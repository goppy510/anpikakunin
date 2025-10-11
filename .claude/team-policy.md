# チームポリシー

## 🚨 最重要: 事前確認が必要な操作

**詳細は `.claude/critical-rules.md` を参照すること**

### 絶対に勝手に実行してはいけない操作
- ❌ データベースのマイグレーション操作（reset, resolve等）
- ❌ データ削除操作（DELETE, TRUNCATE, DROP等）
- ❌ 既存ファイル・機能の削除
- ❌ Dockerボリュームの削除
- ❌ 環境変数の変更

### エラー発生時の対応
1. エラー内容を報告
2. 現在の状態を報告
3. 複数の対応案を提示（リスク付き）
4. **プロジェクトマネージャーの指示を待つ**

---

## ローカル開発環境
**Docker Compose 必須**
- ローカル開発は必ず Docker Compose を使用
- **許可されているコマンド: `docker-compose up` と `docker-compose down` のみ**
- `yarn dev` などホストマシンで直接 Node.js を実行しない
- PostgreSQL は Docker Compose で起動（ポート: 5433）

## ブランチ運用
- `main`: 本番環境デプロイ用
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発ブランチ
- **必ず `develop` ブランチから分岐してタスクごとにブランチを作成する**
- **`main` と `develop` への直接pushは禁止**

## タスク管理
1. 実装着手前に `.claude/task.md` でタスクを確認・追記
2. タスクごとに新規ブランチを作成（命名: `feature/タスク概要`）
3. 実装完了後、`develop` へプルリクエスト

## 設計ドキュメント
- 新機能やアーキテクチャ変更時は `docs/YYYY_MM_DD-設計内容.md` を作成
- 重要な設計判断は必ずドキュメント化

## コーディング規約
- TypeScript strict モード有効
- ESLint / Prettier に従う
- コンポーネントはできるだけ関数コンポーネントで実装
- 型定義は必須（`any` 禁止）

## セキュリティ
- 機密情報（APIキー、トークン）は環境変数で管理
- Slackトークンは必ずAES-256-GCM暗号化して保存
- `.env` ファイルはGit管理対象外
