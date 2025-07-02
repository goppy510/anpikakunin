"use client";

import cn from "classnames";

export interface RequiredScope {
  name: string;
  description: string;
  required: boolean;
}

export interface ScopeVerificationProps {
  actualScopes: string[];
  isVisible: boolean;
}

// このアプリケーションに必要な Slack スコープ
const REQUIRED_SCOPES: RequiredScope[] = [
  {
    name: "chat:write",
    description: "チャンネルにメッセージを送信するために必要",
    required: true
  },
  {
    name: "channels:read",
    description: "パブリックチャンネルの情報を取得するために必要",
    required: true
  },
  {
    name: "emoji:read",
    description: "カスタム絵文字を取得するために必要（オプション）",
    required: false
  },
  {
    name: "users:read",
    description: "ユーザー情報を取得するために必要（インタラクション用）",
    required: false
  }
];

export function ScopeVerification({ actualScopes, isVisible }: ScopeVerificationProps) {
  if (!isVisible) {
    return null;
  }

  const getScopeStatus = (scopeName: string) => {
    return actualScopes.includes(scopeName);
  };

  const getMissingRequiredScopes = () => {
    return REQUIRED_SCOPES.filter(scope => scope.required && !getScopeStatus(scope.name));
  };

  const missingRequired = getMissingRequiredScopes();

  return (
    <div className="space-y-3">
      {/* スコープ概要 */}
      <div className={cn(
        "text-xs px-3 py-2 rounded border",
        missingRequired.length > 0 
          ? "bg-red-900 text-red-300 border-red-500"
          : "bg-green-900 text-green-300 border-green-500"
      )}>
        {missingRequired.length > 0 ? (
          <>⚠️ 必須権限が不足しています ({missingRequired.length}個)</>
        ) : (
          <>✅ 全ての必須権限が設定されています</>
        )}
      </div>

      {/* 必要な権限一覧 */}
      <div className="bg-gray-800 border border-gray-600 rounded p-3">
        <h5 className="text-white font-medium text-sm mb-2">必要な Slack 権限</h5>
        <div className="space-y-2">
          {REQUIRED_SCOPES.map((scope) => {
            const hasScope = getScopeStatus(scope.name);
            return (
              <div key={scope.name} className="flex items-start gap-2 text-xs">
                <span className={cn(
                  "font-mono px-2 py-1 rounded flex-shrink-0",
                  hasScope 
                    ? "bg-green-900 text-green-300 border border-green-500"
                    : scope.required
                    ? "bg-red-900 text-red-300 border border-red-500"
                    : "bg-gray-700 text-gray-300 border border-gray-500"
                )}>
                  {hasScope ? "✓" : "✗"} {scope.name}
                </span>
                <div className="flex-1">
                  <span className={cn(
                    scope.required ? "text-white" : "text-gray-400"
                  )}>
                    {scope.description}
                    {scope.required && (
                      <span className="text-red-400 ml-1">(必須)</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 設定手順ガイド */}
        {missingRequired.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <h6 className="text-yellow-300 font-medium text-sm mb-2">権限設定手順</h6>
            <div className="text-xs text-gray-300 space-y-1">
              <div>1. <a href="https://api.slack.com/apps" target="_blank" className="text-blue-400 underline">api.slack.com/apps</a> でアプリを開く</div>
              <div>2. 「OAuth & Permissions」タブを開く</div>
              <div>3. 「Bot Token Scopes」で以下を追加:</div>
              <ul className="ml-4 mt-1">
                {missingRequired.map(scope => (
                  <li key={scope.name} className="text-red-300">• {scope.name}</li>
                ))}
              </ul>
              <div>4. 「Reinstall to Workspace」をクリック</div>
              <div>5. 新しいBot Tokenをコピーして貼り付け</div>
            </div>
          </div>
        )}

        {/* 現在のスコープ情報 */}
        {actualScopes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <h6 className="text-gray-300 font-medium text-sm mb-2">現在のトークン権限</h6>
            <div className="flex flex-wrap gap-1">
              {actualScopes.map(scope => (
                <span key={scope} className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded border border-blue-500">
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}