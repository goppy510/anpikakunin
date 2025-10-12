/**
 * このアプリケーションに必要なSlack Bot Token Scopes
 */
export const REQUIRED_SLACK_SCOPES = [
  'channels:read',
  'chat:write',
  'chat:write.public',
  'emoji:read',
  'groups:read',
  'users:read',
] as const;

export type RequiredSlackScope = typeof REQUIRED_SLACK_SCOPES[number];

/**
 * スコープの説明
 */
export const SCOPE_DESCRIPTIONS: Record<RequiredSlackScope, string> = {
  'channels:read': '通知先チャンネル情報の取得',
  'chat:write': '地震通知・訓練通知の送信',
  'chat:write.public': 'ボット未参加チャンネルへの通知送信',
  'emoji:read': '部署設定で絵文字選択に使用',
  'groups:read': 'プライベートチャンネルへの通知',
  'users:read': 'ユーザー名取得（安否確認応答）',
};

/**
 * 付与されているスコープと必要なスコープを比較
 */
export function checkMissingScopes(grantedScopes: string[]): {
  missing: RequiredSlackScope[];
  granted: RequiredSlackScope[];
  extra: string[];
} {
  const grantedSet = new Set(grantedScopes);
  const requiredSet = new Set(REQUIRED_SLACK_SCOPES);

  const missing = REQUIRED_SLACK_SCOPES.filter(scope => !grantedSet.has(scope));
  const granted = REQUIRED_SLACK_SCOPES.filter(scope => grantedSet.has(scope));
  const extra = grantedScopes.filter(scope => !requiredSet.has(scope));

  return { missing, granted, extra };
}
