# 地震監視・Slack通知システム設計書

**作成日**: 2025-10-08
**バージョン**: 1.0
**ステータス**: 設計中

---

## 1. システム概要

### 1.1 目的
DMData.jp APIから取得した地震情報を、設定したエリア・震度条件に基づいてSlackへ自動通知するシステム。

### 1.2 主要機能
1. リアルタイム地震情報取得（WebSocket）
2. REST APIによる定期ポーリング（フォールバック）
3. 通知条件フィルタリング（震度・都道府県）
4. Slack自動通知
5. 通知履歴の永続化（重複防止）
6. 通知設定管理UI

---

## 2. アーキテクチャ設計

### 2.1 システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                      DMData.jp API                          │
│  ┌──────────────┐              ┌─────────────────┐         │
│  │  WebSocket   │              │   REST API      │         │
│  │ (リアルタイム) │              │ (ポーリング)     │         │
│  └──────┬───────┘              └────────┬────────┘         │
└─────────┼──────────────────────────────┼──────────────────┘
          │                              │
          ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Next.js Application (Frontend)                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        WebSocketProvider / RestEarthquakePoller     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ 1. 地震イベント受信                           │   │   │
│  │  │ 2. IndexedDB キャッシュ保存                   │   │   │
│  │  │ 3. POST /api/earthquake-events/log (重複検知) │   │   │
│  │  │ 4. 通知条件チェック                           │   │   │
│  │  │ 5. Slack通知トリガー                          │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                Next.js API Routes (Backend)                 │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │ /api/earthquake- │  │ /api/slack/send-message        │  │
│  │ events/log       │  │ - 暗号化トークン復号            │  │
│  │ - 重複検知       │  │ - Slack API呼び出し             │  │
│  │ - PostgreSQL保存 │  │ - エラーハンドリング            │  │
│  └──────────────────┘  └────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐│
│  │ /api/slack/workspaces                                  ││
│  │ - ワークスペース・通知設定 CRUD                         ││
│  └────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                    │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │ EarthquakeEvent  │  │ SlackWorkspace               │    │
│  │ Log              │  │ SlackNotificationSetting     │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Slack Workspace                        │
│                  (通知先チャンネル)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. データフロー設計

### 3.1 地震イベント受信〜Slack通知フロー

```
1. WebSocket/REST から地震イベント受信
   ↓
2. IndexedDB にキャッシュ保存（UI表示用）
   ↓
3. POST /api/earthquake-events/log
   - eventId + payloadHash で重複検知
   - 新規イベントなら PostgreSQL に保存
   - レスポンス: { inserted: true/false }
   ↓
4. inserted === true の場合のみ通知処理へ
   ↓
5. 通知条件チェック（震度・都道府県）
   - 条件に合致しない場合は終了
   ↓
6. POST /api/slack/send-message
   - ワークスペースIDから暗号化トークン取得・復号
   - Slack API呼び出し
   - 通知成功/失敗ログ記録
   ↓
7. 完了
```

### 3.2 設定画面からの通知条件設定フロー

```
1. ユーザーが設定画面で条件を入力
   - 最低震度: 震度3、震度4、震度5弱、...
   - 対象都道府県: ["東京都", "神奈川県", ...]
   - 通知チャンネルID
   ↓
2. POST /api/slack/workspaces
   - SlackNotificationSetting を upsert
   - workspace_ref で関連付け
   ↓
3. 次回地震イベント受信時、最新設定を取得して判定
```

---

## 4. 通知条件フィルタリング設計

### 4.1 震度判定ロジック

#### 震度スケール定義
```typescript
const INTENSITY_SCALE: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5弱": 5,
  "5強": 6,
  "6弱": 7,
  "6強": 8,
  "7": 9,
};

function compareIntensity(intensity: string, minIntensity: string): boolean {
  const scale1 = INTENSITY_SCALE[intensity] ?? -1;
  const scale2 = INTENSITY_SCALE[minIntensity] ?? -1;
  return scale1 >= scale2;
}
```

#### 判定例
- 設定: 最低震度「震度4」
- イベント震度: 「震度5弱」
- 結果: `compareIntensity("5弱", "4")` → `true` → **通知する**

### 4.2 都道府県マッチングロジック

#### データ構造
```typescript
// EventItem 内の震度観測点情報
interface ObservationPoint {
  prefecture: string;   // "東京都"
  city: string;         // "千代田区"
  intensity: string;    // "5弱"
}

// 通知設定
interface NotificationSettings {
  targetPrefectures: string[];  // ["東京都", "神奈川県"]
}
```

#### マッチングロジック
```typescript
function matchesPrefecture(
  event: EventItem,
  settings: NotificationSettings
): boolean {
  // 設定が空配列の場合は全都道府県対象
  if (settings.targetPrefectures.length === 0) return true;

  // イベント内のいずれかの観測点が対象都道府県に含まれるか
  return event.observationPoints.some(point =>
    settings.targetPrefectures.includes(point.prefecture)
  );
}
```

### 4.3 統合判定関数

```typescript
export function shouldNotify(
  event: EventItem,
  settings: SlackNotificationSetting
): boolean {
  // 1. 震度条件チェック
  if (settings.minIntensity) {
    const maxIntensity = getMaxIntensity(event.observationPoints);
    if (!compareIntensity(maxIntensity, settings.minIntensity)) {
      return false;
    }
  }

  // 2. 都道府県条件チェック
  if (!matchesPrefecture(event, settings)) {
    return false;
  }

  // 3. その他の条件（将来拡張）
  // - 深さ条件
  // - マグニチュード条件
  // - 時間帯フィルタ

  return true;
}
```

---

## 5. Slack通知メッセージ設計

### 5.1 メッセージフォーマット

#### Blocks API を使用したリッチ通知

```json
{
  "channel": "C123456789",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 地震情報（震度5弱以上）",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*発生時刻:*\n2025-10-08 14:30:00"
        },
        {
          "type": "mrkdwn",
          "text": "*震源地:*\n千葉県北西部"
        },
        {
          "type": "mrkdwn",
          "text": "*マグニチュード:*\n5.2"
        },
        {
          "type": "mrkdwn",
          "text": "*最大震度:*\n震度5弱"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*各地の震度:*\n• 東京都千代田区: 震度5弱\n• 神奈川県横浜市: 震度4\n• 埼玉県さいたま市: 震度4"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "データ提供: DMData.jp | 配信元: WebSocket"
        }
      ]
    }
  ]
}
```

### 5.2 通知レベル別の絵文字・色分け

| 震度 | 絵文字 | Slackカラー | 用途 |
|------|--------|------------|------|
| 震度3 | ⚠️ | warning | 注意喚起 |
| 震度4 | 🔶 | warning | 警戒 |
| 震度5弱 | 🚨 | danger | 緊急 |
| 震度5強〜7 | 🔴 | danger | 最高警戒 |

---

## 6. エラーハンドリング設計

### 6.1 WebSocket切断時の再接続

```typescript
class WebSocketManager {
  private retryCount = 0;
  private maxRetries = 5;
  private baseDelay = 1000; // 1秒

  async reconnect() {
    if (this.retryCount >= this.maxRetries) {
      // REST APIポーリングに切り替え
      this.fallbackToRestPolling();
      return;
    }

    const delay = this.baseDelay * Math.pow(2, this.retryCount); // 指数バックオフ
    this.retryCount++;

    await new Promise(resolve => setTimeout(resolve, delay));

    this.connect();
  }
}
```

### 6.2 Slack通知失敗時のリトライ

```typescript
async function sendSlackNotificationWithRetry(
  workspaceId: string,
  message: SlackMessage,
  maxRetries = 3
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("/api/slack/send-message", {
        method: "POST",
        body: JSON.stringify({ workspaceId, message })
      });

      if (response.ok) {
        return true;
      }

      if (response.status === 429) {
        // Rate Limit エラー
        const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5");
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      throw new Error(`Slack API error: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) {
        // 最終試行失敗
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
    }
  }
  return false;
}
```

### 6.3 PostgreSQL接続エラー時のフォールバック

```typescript
async function saveEarthquakeEvent(event: EventItem) {
  try {
    await logEarthquakeEvent(event, "websocket");
  } catch (error) {
    // フォールバック: IndexedDBのみで運用
    await EventDatabase.saveEvent(event);
    // 管理者に通知
    await notifyAdminOfDBError(error);
  }
}
```

---

## 7. REST APIポーリング設計

### 7.1 ポーリング仕様

- **間隔**: 30秒
- **対象**: DMData.jp `/v2/telegram` API
- **条件**: WebSocket切断時のみ有効化
- **取得範囲**: 最終取得イベントID以降の新規イベント

### 7.2 実装イメージ

```typescript
class RestEarthquakePoller {
  private pollingInterval = 30000; // 30秒
  private lastEventId: string | null = null;
  private timerId: NodeJS.Timeout | null = null;

  start() {
    this.timerId = setInterval(() => this.poll(), this.pollingInterval);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  async poll() {
    try {
      const response = await fetch(
        `https://api.dmdata.jp/v2/telegram?type=VXSE53&limit=10${
          this.lastEventId ? `&cursorToken=${this.lastEventId}` : ""
        }`,
        {
          headers: {
            Authorization: `Basic ${btoa(DMDATA_API_KEY + ":")}`,
          },
        }
      );

      const data = await response.json();

      for (const item of data.items) {
        const event = parseEventFromTelegram(item);
        await processEarthquakeEvent(event);
        this.lastEventId = item.id;
      }
    } catch (error) {
    }
  }
}
```

---

## 8. セキュリティ設計

### 8.1 Slackトークン暗号化

- **アルゴリズム**: AES-256-GCM
- **鍵管理**: 環境変数 `SLACK_TOKEN_ENCRYPTION_KEY`（32バイト base64）
- **保存形式**: `ciphertext`, `iv`, `authTag` を別カラムで保存

### 8.2 API認証

- **DMData.jp**: Basic認証（APIキーをBase64エンコード）
- **Slack API**: Bearer トークン（復号したBot Token）

### 8.3 環境変数の保護

- `.env.local` はGit管理対象外
- 本番環境は環境変数でシークレットを注入
- デプロイ時の環境変数チェック

---

## 9. パフォーマンス最適化

### 9.1 PostgreSQLクエリ最適化

- `eventId` と `workspaceId` にインデックス設定済み
- N+1問題回避: Prisma の `include` でリレーション一括取得

### 9.2 IndexedDBクリーンアップ

- 保存上限: 30件
- 保持期間: 7日間
- 定期クリーンアップ: アプリ起動時 + 6時間ごと

### 9.3 Slack API レート制限対応

- Tier 3: 50+ requests/minute
- リトライ時は `Retry-After` ヘッダーを尊重
- 並列通知時はキュー管理

---

## 10. テスト計画

### 10.1 ユニットテスト

- [ ] `compareIntensity()` 震度判定ロジック
- [ ] `matchesPrefecture()` 都道府県マッチング
- [ ] `shouldNotify()` 統合判定
- [ ] 暗号化/復号化関数

### 10.2 統合テスト

- [ ] WebSocket → PostgreSQL → Slack 通知フロー
- [ ] REST APIポーリング → 通知フロー
- [ ] エラー時のリトライ処理

### 10.3 E2Eテスト

- [ ] 設定画面で条件設定 → 地震イベント受信 → Slack通知
- [ ] 複数ワークスペース並列通知

---

## 11. 今後の拡張予定

### 11.1 追加機能
- [ ] LINE通知対応
- [ ] メール通知対応
- [ ] 訓練モード（定期的なテスト通知）
- [ ] 通知履歴のエクスポート（CSV/JSON）

### 11.2 運用改善
- [ ] ログ監視ダッシュボード
- [ ] アラート設定（エラー率・通知遅延）
- [ ] A/Bテスト（通知メッセージフォーマット）

---

## 12. 参考資料

- [DMData.jp API v2 仕様](https://dmdata.jp/docs/reference/api/v2.html)
- [Slack Block Kit](https://api.slack.com/block-kit)
- [Prisma トランザクション](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [Web Crypto API (暗号化)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
