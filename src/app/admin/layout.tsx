"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "../components/auth/AuthGuard";

type SidebarItem = {
  href: string;
  label: string;
  icon: string;
  requiredPermissions?: string[];
};

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const response = await fetch("/api/auth/session");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    }
    void loadUser();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const sidebarItems: SidebarItem[] = [
    {
      href: "/admin",
      label: "ダッシュボード",
      icon: "🏠",
    },
    {
      href: "/admin/workspaces",
      label: "ワークスペース",
      icon: "🔗",
      requiredPermissions: ["ADMIN"],
    },
    {
      href: "/admin/departments",
      label: "部署設定",
      icon: "👥",
      requiredPermissions: ["ADMIN", "EDITOR"],
    },
    {
      href: "/admin/conditions",
      label: "通知条件",
      icon: "⚙️",
      requiredPermissions: ["ADMIN", "EDITOR"],
    },
    {
      href: "/admin/messages",
      label: "メッセージ設定",
      icon: "💬",
      requiredPermissions: ["ADMIN", "EDITOR"],
    },
    {
      href: "/admin/members",
      label: "メンバー管理",
      icon: "👤",
      requiredPermissions: ["ADMIN", "INVITER"],
    },
  ];

  // 権限チェック（仮実装 - 後でバックエンドから取得）
  const hasPermission = (requiredPermissions?: string[]) => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    if (user?.role === "ADMIN") return true;
    // TODO: 複数権限対応
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* サイドバー */}
      <aside
        className={`bg-gray-800 border-r border-gray-700 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        {/* サイドバーヘッダー */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {sidebarOpen && (
            <h2 className="font-bold text-lg">安否確認システム</h2>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-700 rounded"
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* ナビゲーション */}
        <nav className="p-4">
          <ul className="space-y-2">
            {sidebarItems.map((item) => {
              const hasAccess = hasPermission(item.requiredPermissions);
              const isActive = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={hasAccess ? item.href : "#"}
                    className={`flex items-center gap-3 p-3 rounded transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : hasAccess
                        ? "hover:bg-gray-700 text-gray-300"
                        : "text-gray-600 cursor-not-allowed"
                    }`}
                    onClick={(e) => {
                      if (!hasAccess) e.preventDefault();
                    }}
                    title={
                      !hasAccess ? "この機能へのアクセス権限がありません" : undefined
                    }
                  >
                    <span className="text-xl">{item.icon}</span>
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ユーザー情報 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          {sidebarOpen ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-400 truncate">{user?.email}</div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
                  {user?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full p-2 hover:bg-gray-700 rounded text-center"
              title="ログアウト"
            >
              🚪
            </button>
          )}
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        {/* トップバー */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">
              {sidebarItems.find((item) => item.href === pathname)?.label ||
                "管理画面"}
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                {new Date().toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </span>
            </div>
          </div>
        </header>

        {/* ページコンテンツ */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="ADMIN">
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthGuard>
  );
}
