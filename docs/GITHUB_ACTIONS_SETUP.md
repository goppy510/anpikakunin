# GitHub Actions セットアップガイド

このドキュメントでは、GitHub Actions で本番デプロイを行うための設定手順を説明します。

## 前提条件

- GitHub リポジトリの管理者権限
- Vercel アカウント
- Supabase プロジェクト

## 1. GitHub Secrets の設定

リポジトリ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 必要なSecrets

| Secret名 | 説明 | 取得方法 |
|---------|------|---------|
| `SUPABASE_DB_URL` | Supabase データベース接続URL | Supabase → Settings → Database → Connection string |
| `VERCEL_TOKEN` | Vercel デプロイトークン | Vercel → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Vercel Organization ID | `.vercel/project.json` から取得 |
| `VERCEL_PROJECT_ID` | Vercel Project ID | `.vercel/project.json` から取得 |

### Vercel情報の取得手順

```bash
# Vercel CLIをインストール
npm install -g vercel

# ログイン
vercel login

# プロジェクトをリンク
cd /path/to/anpikakunin
vercel link

# project.jsonを確認
cat .vercel/project.json
```

`.vercel/project.json` の内容:
```json
{
  "orgId": "team_xxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxx"
}
```

- `orgId` → `VERCEL_ORG_ID`
- `projectId` → `VERCEL_PROJECT_ID`

## 2. GitHub Environment の設定（手動承認）

マイグレーション実行時に手動承認を必要とするため、Environment を設定します。

### 手順

1. リポジトリ → **Settings** → **Environments**
2. **New environment** をクリック
3. Environment name: `production-migration` を入力
4. **Configure environment** をクリック

### Protection rules を設定

1. **Required reviewers** にチェック
2. レビュアーを追加（自分自身または信頼できるメンバー）
3. **Save protection rules**

### その他の設定（オプション）

- **Wait timer**: 承認までの待機時間（デフォルト: なし）
- **Deployment branches**: `main` ブランチのみに制限（推奨）

## 3. ワークフローの動作確認

### テストPRを作成

```bash
# developブランチで適当な変更をコミット
git checkout develop
git commit --allow-empty -m "test: GitHub Actions動作確認"
git push origin develop

# mainへのPRを作成
gh pr create --base main --head develop --title "Test: GitHub Actions" --body "動作確認用PR"
```

### ワークフロー実行フロー

1. PR作成時、GitHub Actions が自動実行
2. **Check Database Migration** ジョブでマイグレーション差分を確認
3. マイグレーションがある場合：
   - **Approve Migration** ジョブで承認待ち
   - GitHub Actions → 該当ワークフロー → **Review deployments** をクリック
   - レビュー・承認
4. **Run Database Migration** ジョブでマイグレーション実行
5. **Deploy to Vercel** ジョブでデプロイ

### 承認方法

1. GitHub Actions のワークフロー実行ページを開く
2. **Approve Migration** ジョブが **Waiting** 状態になる
3. 右側の **Review deployments** ボタンをクリック
4. マイグレーション内容を確認
5. **Approve and deploy** をクリック

## 4. トラブルシューティング

### Secrets が見つからないエラー

```
Error: Secret SUPABASE_DB_URL not found
```

**解決方法:**
1. Settings → Secrets and variables → Actions で Secrets が正しく設定されているか確認
2. Secret 名のスペルミスがないか確認
3. Repository secrets（Organization secrets ではない）に設定されているか確認

### Vercel デプロイが失敗する

```
Error: Failed to deploy to Vercel
```

**解決方法:**
1. `VERCEL_TOKEN` が有効か確認（期限切れの場合は再発行）
2. `VERCEL_ORG_ID` と `VERCEL_PROJECT_ID` が正しいか確認
3. Vercel ダッシュボードでプロジェクトが存在するか確認

### マイグレーションが失敗する

```
Error: Migration failed
```

**解決方法:**
1. `SUPABASE_DB_URL` が正しいか確認
2. Supabase プロジェクトが起動しているか確認
3. マイグレーションファイルに構文エラーがないか確認
4. 既に適用済みのマイグレーションでないか確認

### Environment が見つからないエラー

```
Error: Environment production-migration not found
```

**解決方法:**
1. Settings → Environments で `production-migration` が作成されているか確認
2. Environment 名が完全一致しているか確認（大文字小文字区別）

## 5. ワークフローのカスタマイズ

### マイグレーションをスキップしてデプロイ

緊急時など、マイグレーションをスキップしたい場合：

1. GitHub Actions → **Deploy to Production** ワークフロー
2. **Run workflow** をクリック
3. `skip_migration` を `true` に設定
4. **Run workflow** を実行

### 通知の追加

Slack 通知を追加する場合（オプション）:

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "🚀 本番デプロイが完了しました"
      }
```

## 6. セキュリティのベストプラクティス

### Secrets の管理

1. **定期的なローテーション**: 3〜6ヶ月ごとにトークンを再発行
2. **最小権限**: Vercel トークンは必要最小限の権限のみ付与
3. **アクセス制限**: GitHub リポジトリのアクセス権限を適切に管理

### Environment の保護

1. **Required reviewers**: 必ず設定する
2. **複数人承認**: 重要なデプロイは2人以上の承認を必須にする
3. **Deployment branches**: `main` ブランチのみに制限

### 監査ログ

GitHub Actions の実行履歴は自動的に記録されます：
- リポジトリ → **Actions** → 各ワークフロー実行
- 誰が承認したか、いつ実行されたかを確認可能

## まとめ

これで GitHub Actions による本番デプロイ環境が整いました。

### 通常のデプロイフロー

```
1. develop で開発
2. PR を main へ作成
3. GitHub Actions が自動実行
4. マイグレーションを確認・承認
5. 自動デプロイ
6. https://anpikakunin.xyz で確認
```

### 緊急時のロールバック

Vercel ダッシュボードから前のデプロイメントを **Promote to Production** で即座にロールバック可能。
