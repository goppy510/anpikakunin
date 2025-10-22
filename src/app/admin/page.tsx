"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface EarthquakeRecord {
  id: string;
  eventId: string;
  infoType: string;
  title: string;
  epicenter?: string;
  magnitude?: number;
  depth?: string;
  maxIntensity: string;
  occurrenceTime?: string;
  arrivalTime?: string;
  createdAt: string;
  prefectureObservations: Array<{
    prefectureName: string;
    maxIntensity: string;
  }>;
}

interface ActivityLog {
  id: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceName?: string;
  createdAt: string;
}

// アクションテキストを取得
function getActionText(action: string): string {
  const map: Record<string, string> = {
    created: "作成しました",
    updated: "更新しました",
    deleted: "削除しました",
    connected: "接続しました",
    disconnected: "切断しました",
    enabled: "有効化しました",
    disabled: "無効化しました",
    invited: "招待しました",
    login: "ログインしました",
    logout: "ログアウトしました",
  };
  return map[action] || action;
}

// リソースタイプテキストを取得
function getResourceTypeText(resourceType: string): string {
  const map: Record<string, string> = {
    workspace: "ワークスペース",
    department: "部署",
    user: "ユーザー",
    group: "グループ",
    condition: "通知条件",
    channel: "チャンネル",
    message_template: "メッセージテンプレート",
    earthquake: "地震情報",
    notification: "通知",
  };
  return map[resourceType] || resourceType;
}

interface RestPollerHealth {
  status: "healthy" | "warning" | "error";
  lastRunAt: string | null;
  elapsedMinutes: number | null;
  message: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    workspaces: 0,
    departments: 0,
    members: 0,
    activeNotifications: 0,
  });

  const [earthquakes, setEarthquakes] = useState<EarthquakeRecord[]>([]);
  const [fetchedEarthquakes, setFetchedEarthquakes] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [restPollerHealth, setRestPollerHealth] = useState<RestPollerHealth | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<{
    fetched: number;
    vxse51: number;
    vxse53: number;
  } | null>(null);

  const fetchEarthquakes = async () => {
    try {
      const response = await fetch("/api/admin/latest-earthquakes");
      if (response.ok) {
        const data = await response.json();
        setEarthquakes(data.earthquakes);
      }
    } catch (error) {
      console.error("Failed to fetch earthquakes:", error);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    const fetchActivityLogs = async () => {
      try {
        const response = await fetch("/api/admin/activity-logs?limit=10");
        if (response.ok) {
          const data = await response.json();
          setActivityLogs(data.logs);
        }
      } catch (error) {
        console.error("Failed to fetch activity logs:", error);
      }
    };

    const fetchRestPollerHealth = async () => {
      try {
        const response = await fetch("/api/admin/rest-poller-health");
        if (response.ok) {
          const data = await response.json();
          setRestPollerHealth(data);
        }
      } catch (error) {
        console.error("Failed to fetch rest poller health:", error);
      }
    };

    fetchStats();
    fetchEarthquakes();
    fetchActivityLogs();
    fetchRestPollerHealth();

    // 30秒ごとにヘルスチェックを更新
    const interval = setInterval(fetchRestPollerHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleFetchNow = async () => {
    setIsFetching(true);
    setFetchResult(null);

    try {
      const response = await fetch("/api/admin/fetch-earthquakes-now", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setFetchResult({
          fetched: data.fetched,
          vxse51: data.vxse51,
          vxse53: data.vxse53,
        });

        setFetchedEarthquakes(data.earthquakes || []);
      } else {
        const error = await response.json();
        alert(`エラー: ${error.error || "地震情報の取得に失敗しました"}`);
      }
    } catch (error) {
      console.error("Failed to fetch earthquakes now:", error);
      alert("地震情報の取得に失敗しました");
    } finally {
      setIsFetching(false);
    }
  };









  const cards = [
    {
      title: "ワークスペース",
      value: stats.workspaces,
      icon: "fa-brands fa-slack",
      color: "blue",
      href: "/admin/workspaces",
    },
    {
      title: "部署",
      value: stats.departments,
      icon: "fa-solid fa-users",
      color: "green",
      href: "/admin/departments",
    },
    {
      title: "メンバー",
      value: stats.members,
      icon: "fa-solid fa-user",
      color: "purple",
      href: "/admin/members",
    },
    {
      title: "有効な通知",
      value: stats.activeNotifications,
      icon: "fa-solid fa-bell",
      color: "yellow",
      href: "/admin/conditions",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700",
    green: "bg-green-600 hover:bg-green-700",
    purple: "bg-purple-600 hover:bg-purple-700",
    yellow: "bg-yellow-600 hover:bg-yellow-700",
  };

  return (
    <div className="space-y-6">
      {/* REST APIポーリングヘルスチェック */}
      {restPollerHealth && (
        <div
          className={`p-4 rounded-lg border ${
            restPollerHealth.status === "healthy"
              ? "bg-green-900/30 border-green-700"
              : restPollerHealth.status === "warning"
              ? "bg-yellow-900/30 border-yellow-700"
              : "bg-red-900/30 border-red-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  restPollerHealth.status === "healthy"
                    ? "bg-green-500"
                    : restPollerHealth.status === "warning"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <div>
                <h3 className="font-semibold">地震情報取得（サーバーサイドcron - 1分ごと）</h3>
                <p className="text-sm text-gray-400">{restPollerHealth.message}</p>
              </div>
            </div>
            {restPollerHealth.lastRunAt && (
              <div className="text-sm text-gray-400">
                最終実行: {new Date(restPollerHealth.lastRunAt).toLocaleString("ja-JP")}
                {restPollerHealth.elapsedMinutes !== null && (
                  <span className="ml-2">({restPollerHealth.elapsedMinutes}分前)</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <i className={`${card.icon} text-3xl`}></i>
              <span className="text-3xl font-bold">{card.value}</span>
            </div>
            <h3 className="text-gray-400 text-sm">{card.title}</h3>
          </Link>
        ))}
      </div>

      {/* クイックアクション */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/admin/workspaces"
            className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <div className="text-lg font-bold mb-2 flex items-center gap-2">
              <i className="fa-brands fa-slack"></i>
              <span>ワークスペース追加</span>
            </div>
            <p className="text-sm text-blue-100">新しいSlackワークスペースを接続</p>
          </Link>

          <Link
            href="/admin/members"
            className="p-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            <div className="text-lg font-bold mb-2 flex items-center gap-2">
              <i className="fa-solid fa-user"></i>
              <span>メンバー招待</span>
            </div>
            <p className="text-sm text-green-100">新しいメンバーを招待する</p>
          </Link>

          <Link
            href="/admin/conditions"
            className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <div className="text-lg font-bold mb-2 flex items-center gap-2">
              <i className="fa-solid fa-gear"></i>
              <span>通知設定</span>
            </div>
            <p className="text-sm text-purple-100">地震通知条件を設定する</p>
          </Link>
        </div>
      </div>

      {/* 保存済み地震情報（最新3件） */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-database"></i>
          <span>保存済みの地震情報（最新3件）</span>
        </h2>

        {earthquakes.length === 0 ? (
          <div className="text-gray-400 text-sm">地震情報はありません</div>
        ) : (
          <div className="space-y-4">
            {earthquakes.map((eq) => (
              <div
                key={eq.id}
                className="p-4 bg-gray-900 rounded-lg border border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-red-400">
                        震度{eq.maxIntensity}
                      </span>
                      <span className="text-sm text-gray-400">
                        {eq.infoType === "VXSE51" ? "震度速報" : "震源・震度情報"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold mt-1">{eq.title}</h3>
                  </div>
                  <div className="text-xs text-gray-400">
                    {eq.occurrenceTime
                      ? new Date(eq.occurrenceTime).toLocaleString("ja-JP")
                      : eq.arrivalTime
                      ? new Date(eq.arrivalTime).toLocaleString("ja-JP")
                      : new Date(eq.createdAt).toLocaleString("ja-JP")}
                  </div>
                </div>

                {eq.epicenter && (
                  <div className="grid grid-cols-3 gap-4 text-sm mt-3 mb-3">
                    <div>
                      <span className="text-gray-400">震源地:</span>
                      <span className="ml-2">{eq.epicenter}</span>
                    </div>
                    {eq.magnitude && (
                      <div>
                        <span className="text-gray-400">マグニチュード:</span>
                        <span className="ml-2">M{eq.magnitude}</span>
                      </div>
                    )}
                    {eq.depth && (
                      <div>
                        <span className="text-gray-400">深さ:</span>
                        <span className="ml-2">{eq.depth}</span>
                      </div>
                    )}
                  </div>
                )}

                {eq.prefectureObservations.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-2">
                      観測地域（最大5件表示）:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {eq.prefectureObservations.slice(0, 5).map((obs) => (
                        <span
                          key={obs.prefectureName}
                          className="px-2 py-1 bg-gray-800 rounded text-xs"
                        >
                          {obs.prefectureName} 震度{obs.maxIntensity}
                        </span>
                      ))}
                      {eq.prefectureObservations.length > 5 && (
                        <span className="px-2 py-1 text-gray-400 text-xs">
                          他{eq.prefectureObservations.length - 5}件
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 手動取得セクション */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">🔄 地震情報の手動取得</h2>
          <button
            onClick={handleFetchNow}
            disabled={isFetching}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-colors"
          >
            {isFetching ? "取得中..." : "今すぐ取得"}
          </button>
        </div>

        {fetchResult && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-gray-400">取得件数:</span>
                <span className="ml-2 font-bold">{fetchResult.fetched}</span>
              </div>
              <div>
                <span className="text-gray-400">VXSE51:</span>
                <span className="ml-2 font-bold text-blue-400">
                  {fetchResult.vxse51}
                </span>
              </div>
              <div>
                <span className="text-gray-400">VXSE53:</span>
                <span className="ml-2 font-bold text-green-400">
                  {fetchResult.vxse53}
                </span>
              </div>
            </div>
          </div>
        )}

        {fetchResult && (
          <div className="mb-4">
            <h3 className="text-lg font-bold mb-3">📡 取得した地震情報（全{fetchedEarthquakes.length}件）</h3>
            {fetchedEarthquakes.length === 0 ? (
              <div className="text-gray-400 text-sm p-4 bg-gray-900 rounded-lg border border-gray-700">
                地震情報が見つかりませんでした（震度情報がない電文のみの可能性があります）
              </div>
            ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {fetchedEarthquakes.map((eq, index) => (
                <div
                  key={`${eq.eventId}-${index}`}
                  className="p-3 bg-gray-900 rounded-lg border border-gray-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {eq.maxIntensity && (
                          <span className="text-lg font-bold text-red-400">
                            震度{eq.maxIntensity}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {eq.type === "VXSE51" ? "震度速報（VXSE51）" : "震源・震度に関する情報（VXSE53）"}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold mt-1">{eq.title}</h4>
                    </div>
                    <div className="text-xs text-gray-400">
                      {(() => {
                        // occurrenceTime または arrivalTime があればそれを使用
                        if (eq.occurrenceTime) {
                          return new Date(eq.occurrenceTime).toLocaleString("ja-JP");
                        }
                        if (eq.arrivalTime) {
                          return new Date(eq.arrivalTime).toLocaleString("ja-JP");
                        }

                        // タイトルから日時を抽出して月を補完
                        // 例: "１１日１２時３０分ころ" -> "2025年10月11日 12:30ころ"
                        const match = eq.title.match(/(\d+)日(\d+)時(\d+)分/);
                        if (match) {
                          const day = match[1];
                          const hour = match[2];
                          const minute = match[3];
                          const now = new Date();
                          const currentYear = now.getFullYear();
                          const currentMonth = now.getMonth() + 1;
                          return `${currentYear}年${currentMonth}月${day}日 ${hour}:${minute}ころ`;
                        }

                        return "";
                      })()}
                    </div>
                  </div>

                  {eq.epicenter && (
                    <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                      <div>
                        <span className="text-gray-400">震源地:</span>
                        <span className="ml-1">{eq.epicenter}</span>
                      </div>
                      {eq.magnitude && (
                        <div>
                          <span className="text-gray-400">M:</span>
                          <span className="ml-1">{eq.magnitude}</span>
                        </div>
                      )}
                      {eq.depth && (
                        <div>
                          <span className="text-gray-400">深さ:</span>
                          <span className="ml-1">{eq.depth}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {eq.prefectureObservations && eq.prefectureObservations.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">観測地域:</div>
                      <div className="flex flex-wrap gap-1">
                        {eq.prefectureObservations.slice(0, 10).map((obs, idx) => (
                          <span
                            key={`${obs.prefecture}-${idx}`}
                            className="px-2 py-0.5 bg-gray-800 rounded text-xs"
                          >
                            {obs.prefecture} 震度{obs.maxIntensity}
                          </span>
                        ))}
                        {eq.prefectureObservations.length > 10 && (
                          <span className="px-2 py-0.5 text-gray-400 text-xs">
                            他{eq.prefectureObservations.length - 10}件
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </div>

      {/* 最近のアクティビティ */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">📋 最近のアクティビティ</h2>
        {activityLogs.length === 0 ? (
          <div className="text-gray-400 text-sm">アクティビティはありません</div>
        ) : (
          <div className="space-y-3">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-sm">
                <span
                  className={`${
                    log.action === "created"
                      ? "text-green-400"
                      : log.action === "updated"
                      ? "text-blue-400"
                      : log.action === "deleted"
                      ? "text-red-400"
                      : log.action === "connected"
                      ? "text-purple-400"
                      : "text-gray-400"
                  }`}
                >
                  ●
                </span>
                <span className="text-gray-400">
                  {new Date(log.createdAt).toLocaleString("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-gray-400">{log.userEmail}</span>
                <span>
                  {getActionText(log.action)} {getResourceTypeText(log.resourceType)}
                  {log.resourceName && (
                    <span className="font-bold ml-1">「{log.resourceName}」</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* システム情報 */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">システム情報</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">バージョン:</span>
            <span className="ml-2">v1.0.0</span>
          </div>
          <div>
            <span className="text-gray-400">環境:</span>
            <span className="ml-2">{process.env.NODE_ENV}</span>
          </div>
          <div>
            <span className="text-gray-400">データベース:</span>
            <span className="ml-2 text-green-400">接続中</span>
          </div>
          <div>
            <span className="text-gray-400">WebSocket:</span>
            <span className="ml-2 text-green-400">接続中</span>
          </div>
        </div>
      </div>
    </div>
  );
}
