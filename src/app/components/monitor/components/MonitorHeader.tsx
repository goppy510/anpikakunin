"use client";

import cn from "classnames";

interface MonitorHeaderProps {
  authStatus: "checking" | "authenticated" | "not_authenticated";
  status: "open" | "connecting" | "closed" | "error";
  soundPlay: boolean;
  notificationThreshold: number;
  testMode: boolean;
  onLogin: () => void;
  onClearAuth: () => void;
  onRefreshAuth: () => void;
  onToggleSound: (enabled: boolean) => void;
  onNotificationThresholdChange: (threshold: number) => void;
  onToggleTestMode: () => void;
  onRunTestSimulation: () => void;
}

export function MonitorHeader({
  authStatus,
  status,
  soundPlay,
  notificationThreshold,
  testMode,
  onLogin,
  onClearAuth,
  onRefreshAuth,
  onToggleSound,
  onNotificationThresholdChange,
  onToggleTestMode,
  onRunTestSimulation,
}: MonitorHeaderProps) {
  return (
    <div className="flex text-white text-sm leading-[36px] min-h-[36px] bg-gray-800 border-b border-gray-700">
      {/* 認証状態 */}
      <div className="flex items-center mx-3">
        {authStatus === "not_authenticated" ? (
          <button
            className="mx-1 px-3 py-1 border border-blue-500 rounded bg-blue-900 hover:bg-blue-800 text-blue-300 transition-colors text-xs"
            onClick={onLogin}
          >
            DMDATA認証
          </button>
        ) : (
          <>
            <span
              className={cn(
                "mx-1 px-2 py-1 rounded text-xs font-medium",
                {
                  checking: "border border-yellow-500 bg-yellow-900 text-yellow-300",
                  authenticated: "border border-green-500 bg-green-900 text-green-300",
                  not_authenticated: "border border-red-500 bg-red-900 text-red-300",
                }[authStatus]
              )}
            >
              認証: {authStatus === "checking" ? "確認中" : "済"}
            </span>
            {authStatus === "authenticated" && (
              <button
                className="mx-1 px-2 py-1 border border-red-500 rounded bg-red-900 hover:bg-red-800 text-red-300 transition-colors text-xs"
                onClick={onClearAuth}
              >
                クリア
              </button>
            )}
          </>
        )}
        <button
          className="mx-1 px-2 py-1 border border-gray-500 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors text-xs"
          onClick={onRefreshAuth}
        >
          更新
        </button>
      </div>

      {/* WebSocket ステータス */}
      <div className="flex items-center mx-3">
        <span
          className={cn(
            "mx-1 px-2 py-1 rounded text-xs font-medium",
            {
              open: "border border-green-500 bg-green-900 text-green-300",
              connecting: "border border-yellow-500 bg-yellow-900 text-yellow-300",
              error: "border border-red-500 bg-red-900 text-red-300",
              closed: "border border-gray-500 bg-gray-700 text-gray-300",
            }[status]
          )}
        >
          WebSocket: {status}
        </span>
      </div>

      {/* sound */}
      <label className="flex items-center mx-3 cursor-pointer">
        <span className="text-xs">音声通知:</span>
        <input
          type="checkbox"
          checked={soundPlay}
          onChange={(e) => onToggleSound(e.target.checked)}
          className="mx-2 w-4 h-4"
        />
      </label>

      {/* 通知震度設定 */}
      <div className="flex items-center mx-3">
        <span className="text-xs mr-2">通知震度:</span>
        <select
          value={notificationThreshold}
          onChange={(e) => onNotificationThresholdChange(Number(e.target.value))}
          className="text-xs px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded"
        >
          <option value={0}>震度0以上</option>
          <option value={1}>震度1以上</option>
          <option value={2}>震度2以上</option>
          <option value={3}>震度3以上</option>
          <option value={4}>震度4以上</option>
          <option value={5.0}>震度5弱以上</option>
          <option value={5.5}>震度5強以上</option>
          <option value={6.0}>震度6弱以上</option>
          <option value={6.5}>震度6強以上</option>
          <option value={7}>震度7のみ</option>
        </select>
      </div>

      <div className="flex-grow" />

      {/* バージョン情報 */}
      <div className="flex items-center mx-3 text-xs text-gray-400">
        <span>anpikakunin v0.1.0</span>
      </div>

      {/* テストモード */}
      <div className="flex items-center mx-3">
        <button
          className={cn(
            "mx-1 px-3 py-1 border rounded transition-colors text-xs font-medium",
            testMode 
              ? "border-yellow-500 bg-yellow-900 text-yellow-300" 
              : "border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300"
          )}
          onClick={onToggleTestMode}
        >
          テストモード {testMode ? "ON" : "OFF"}
        </button>
        {testMode && (
          <button
            className="mx-1 px-3 py-1 border border-blue-500 rounded bg-blue-900 hover:bg-blue-800 text-blue-300 transition-colors text-xs"
            onClick={onRunTestSimulation}
          >
            地震シミュレーション実行
          </button>
        )}
      </div>

      {/* 安否確認システムリンク */}
      <div className="flex items-center mx-3">
        <a
          href="/safety-confirmation"
          className="px-3 py-1 border border-purple-500 rounded bg-purple-900 hover:bg-purple-800 text-purple-300 transition-colors text-xs"
        >
          🚨 安否確認システム
        </a>
      </div>

    </div>
  );
}