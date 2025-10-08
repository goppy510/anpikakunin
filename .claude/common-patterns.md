# 頻繁に使用するパターン

## コマンド

### 開発サーバー起動
**重要: ローカル開発は必ず Docker Compose を使用**

```bash
# アプリケーション起動
docker-compose up

# アプリケーション停止・削除
docker-compose down
```

**禁止事項:**
- `yarn dev` などホストマシンで直接 Node.js を実行しない
- Docker 以外でのローカル開発は行わない

### データベース操作
```bash
# Prismaクライアント生成
npx prisma generate

# マイグレーション適用
npx prisma migrate deploy

# マイグレーション作成（開発時）
npx prisma migrate dev --name migration_name

# Prisma Studio起動（DBブラウザ）
npx prisma studio
```

### Git操作
```bash
# 新規ブランチ作成
git checkout -b feature/タスク名

# developから最新を取得してマージ
git checkout develop
git pull origin develop
git checkout feature/タスク名
git merge develop
```

## 実装テンプレート

### Next.js API Route
```typescript
// src/app/api/example/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const data = await prisma.model.findMany();
    return NextResponse.json({ items: data });
  } catch (error) {
    console.error("Failed to fetch data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

### Prisma トランザクション
```typescript
const result = await prisma.$transaction(async (tx) => {
  const workspace = await tx.slackWorkspace.create({ data: {...} });
  const settings = await tx.slackNotificationSetting.create({ data: {...} });
  return { workspace, settings };
});
```

### 暗号化/復号化
```typescript
import { encrypt, decrypt } from "@/app/lib/security/encryption";

// 暗号化
const encrypted = encrypt(plainText);
// { ciphertext: Buffer, iv: Buffer, authTag: Buffer }

// 復号化
const plainText = decrypt({
  ciphertext: encrypted.ciphertext,
  iv: encrypted.iv,
  authTag: encrypted.authTag
});
```

### IndexedDB操作
```typescript
import { EventDatabase } from "@/app/components/monitor/utils/eventDatabase";

// イベント保存
await EventDatabase.saveEvent(eventItem);

// 最新イベント取得
const events = await EventDatabase.getLatestEvents(30);

// クリーンアップ
await EventDatabase.performComprehensiveCleanup(30, 7);
```

## 環境変数設定パターン

### .env.local (ローカル開発)
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5433/anpikakunin
DATABASE_SSL=disable
SLACK_TOKEN_ENCRYPTION_KEY=base64_encoded_32bytes_key
DMDATA_API_KEY=your_dmdata_api_key
```

### .env.production (本番環境)
```bash
SUPABASE_DB_URL=postgresql://user:pass@host:5432/db?sslmode=require
SUPABASE_DB_SSL=require
SLACK_TOKEN_ENCRYPTION_KEY=production_key
DMDATA_API_KEY=production_api_key
```

## デバッグコマンド

### PostgreSQL接続確認
```bash
# Dockerコンテナ内で接続
docker exec -it anpikakunin-postgres psql -U postgres -d anpikakunin
```

### ログ確認
```bash
# Dockerログ
docker-compose logs -f anpikakunin

# PostgreSQLログ
docker-compose logs -f postgres
```
