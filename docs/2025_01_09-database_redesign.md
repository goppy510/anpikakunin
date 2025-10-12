# データベース設計見直し (2025-01-09)

## 現状の問題点

`SlackNotificationSetting`テーブルに以下の異なる責務が混在している：
- 地震通知条件（最小震度、対象都道府県）
- 通知先チャンネル情報
- その他の設定（extraSettings）

さらに、同じ責務を持つ`EarthquakeNotificationCondition`テーブルが重複して存在。

## 提案する設計

### 1. 地震通知条件テーブル（既存の`EarthquakeNotificationCondition`を使用）

```prisma
model EarthquakeNotificationCondition {
  id                 String         @id @default(uuid())
  workspaceRef       String         @unique @map("workspace_ref")
  workspace          SlackWorkspace @relation(fields: [workspaceRef], references: [id], onDelete: Cascade)
  minIntensity       String         @map("min_intensity") // 最小震度
  targetPrefectures  String[]       @map("target_prefectures") // 対象都道府県
  isEnabled          Boolean        @default(true) @map("is_enabled")
  createdAt          DateTime       @default(now()) @map("created_at")
  updatedAt          DateTime       @updatedAt @map("updated_at")

  @@map("earthquake_notification_conditions")
}
```

### 2. 通知チャンネル設定テーブル（新規）

```prisma
model NotificationChannel {
  id           String         @id @default(uuid())
  workspaceRef String         @map("workspace_ref")
  workspace    SlackWorkspace @relation(fields: [workspaceRef], references: [id], onDelete: Cascade)
  channelId    String         @map("channel_id") // SlackチャンネルID
  channelName  String         @map("channel_name") // チャンネル名（表示用）
  purpose      String         // "earthquake" | "safety_confirmation" | "general"
  isActive     Boolean        @default(true) @map("is_active")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  @@map("notification_channels")
  @@index([workspaceRef, purpose])
  @@unique([workspaceRef, channelId, purpose])
}
```

### 3. メッセージテンプレートテーブル（既存を維持）

```prisma
model MessageTemplate {
  id           String              @id @default(uuid())
  workspaceRef String              @map("workspace_ref")
  workspace    SlackWorkspace      @relation(fields: [workspaceRef], references: [id], onDelete: Cascade)
  type         MessageTemplateType // PRODUCTION | TRAINING
  title        String
  body         String              @db.Text
  isActive     Boolean             @default(true) @map("is_active")
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  @@map("message_templates")
  @@unique([workspaceRef, type])
}
```

### 4. スプレッドシート設定テーブル（既存を維持）

```prisma
model SpreadsheetConfig {
  id             String         @id @default(uuid())
  workspaceRef   String         @unique @map("workspace_ref")
  workspace      SlackWorkspace @relation(fields: [workspaceRef], references: [id], onDelete: Cascade)
  spreadsheetUrl String         @map("spreadsheet_url")
  isEnabled      Boolean        @default(true) @map("is_enabled")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  @@map("spreadsheet_configs")
}
```

### 5. 削除するテーブル

- `SlackNotificationSetting` - 責務が分散され、不要になる

## マイグレーション計画

### Phase 1: 新テーブル作成
1. `NotificationChannel`テーブルを作成
2. `EarthquakeNotificationCondition`を有効化（既に存在）

### Phase 2: データ移行
1. `SlackNotificationSetting`から`EarthquakeNotificationCondition`へ
   - `minIntensity`
   - `targetPrefectures`
2. `SlackNotificationSetting.notificationChannels`から`NotificationChannel`へ
   - JSONをパースしてレコードを作成

### Phase 3: コード修正
1. 通知条件API: `SlackNotificationSetting` → `EarthquakeNotificationCondition`を使用
2. チャンネル管理API: 新規作成
3. 既存コードの参照を更新

### Phase 4: 旧テーブル削除
1. `SlackNotificationSetting`テーブルを削除

## 利点

1. **単一責任の原則**: 各テーブルが1つの責務のみを持つ
2. **拡張性**: 通知先チャンネルを複数設定可能（地震用、安否確認用など）
3. **メンテナンス性**: 変更時の影響範囲が明確
4. **データ整合性**: 型安全性の向上（JsonではなくString型）

## 実装順序

1. ✅ 設計ドキュメント作成（このファイル）
2. ⬜ `NotificationChannel`テーブルのマイグレーション作成
3. ⬜ データ移行スクリプト作成
4. ⬜ API層の修正
5. ⬜ フロントエンド修正
6. ⬜ 旧テーブル削除
