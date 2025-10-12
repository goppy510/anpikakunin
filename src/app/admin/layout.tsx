"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { AuthGuard } from "../components/auth/AuthGuard";
import { usePermissions } from "../lib/hooks/usePermissions";
import {
  validatePasswordStrength,
  getPasswordStrengthLevel,
} from "@/app/lib/validation/password";

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
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const { hasAnyPermission, groups, loading: permissionsLoading } = usePermissions();

  const passwordsMatch = newPassword && newPasswordConfirm && newPassword === newPasswordConfirm;

  const passwordStrength = useMemo(
    () => validatePasswordStrength(newPassword),
    [newPassword]
  );
  const strengthLevel = useMemo(
    () => getPasswordStrengthLevel(passwordStrength.score),
    [passwordStrength.score]
  );

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

  useEffect(() => {
    async function loadMenus() {
      try {
        const response = await fetch("/api/menus");
        if (response.ok) {
          const data = await response.json();
          setSidebarItems(
            data.menus.map((menu: any) => ({
              href: menu.path,
              label: menu.name,
              icon: menu.icon,
              requiredPermissions: menu.requiredPermission
                ? [menu.requiredPermission]
                : [],
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load menus:", error);
      }
    }
    void loadMenus();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handlePasswordChange = async () => {
    if (!passwordStrength.isValid) {
      toast.error("新しいパスワードが要件を満たしていません");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      toast.error("新しいパスワードが一致しません");
      return;
    }

    try {
      setChangingPassword(true);

      await axios.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });

      toast.success("パスワードを変更しました");
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (error: any) {
      if (error.response?.status !== 400 && error.response?.status !== 401) {
        console.error("パスワード変更エラー:", error);
      }
      const errorMsg = error.response?.data?.error || "パスワード変更に失敗しました";
      toast.error(errorMsg);
    } finally {
      setChangingPassword(false);
    }
  };

  const checkPermission = (requiredPermissions?: string[]) => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    if (permissionsLoading) return true; // ロード中は表示
    return hasAnyPermission(requiredPermissions);
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex overflow-hidden">
      {/* サイドバー */}
      <aside
        className={`bg-gray-800 border-r border-gray-700 transition-all duration-300 flex-shrink-0 ${
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
        <nav className="p-4 flex flex-col h-[calc(100vh-73px)] overflow-y-auto">
          <ul className="space-y-2 flex-1">
            {sidebarItems.map((item) => {
              const hasAccess = checkPermission(item.requiredPermissions);
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
                    <i className={`${item.icon} text-xl`}></i>
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* ログアウトボタン */}
          <div className="mt-auto pt-4 border-t border-gray-700">
            {sidebarOpen ? (
              <div className="space-y-2 mb-2">
                <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1 flex-1">
                    {groups.length > 0 ? (
                      groups.map((groupName) => (
                        <span
                          key={groupName}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          {groupName}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">
                        グループなし
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                    title="パスワード変更"
                  >
                    <i className="fa-solid fa-key"></i>
                  </button>
                </div>
              </div>
            ) : null}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-3 rounded transition-colors hover:bg-gray-700 text-gray-300 w-full"
              title="ログアウト"
            >
              <i className="fa-solid fa-right-from-bracket text-xl"></i>
              {sidebarOpen && <span>ログアウト</span>}
            </button>
          </div>
        </nav>
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

      {/* パスワード変更モーダル */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Toaster position="top-right" />
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">パスワード変更</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  現在のパスワード
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-gray-700 text-white p-3 pr-10 rounded"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    <i className={showCurrentPassword ? "fa-solid fa-eye" : "fa-solid fa-eye-slash"}></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  新しいパスワード
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-700 text-white p-3 pr-10 rounded"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    <i className={showNewPassword ? "fa-solid fa-eye" : "fa-solid fa-eye-slash"}></i>
                  </button>
                </div>

                {/* パスワード強度インジケーター */}
                {newPassword && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            strengthLevel.color === "red"
                              ? "bg-red-500"
                              : strengthLevel.color === "yellow"
                                ? "bg-yellow-500"
                                : strengthLevel.color === "blue"
                                  ? "bg-blue-500"
                                  : "bg-green-500"
                          }`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          strengthLevel.color === "red"
                            ? "text-red-400"
                            : strengthLevel.color === "yellow"
                              ? "text-yellow-400"
                              : strengthLevel.color === "blue"
                                ? "text-blue-400"
                                : "text-green-400"
                        }`}
                      >
                        {strengthLevel.label}
                      </span>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-3 space-y-1 text-sm">
                      {[
                        { key: "minLength", label: "8文字以上" },
                        { key: "hasUppercase", label: "大文字を含む (A-Z)" },
                        { key: "hasLowercase", label: "小文字を含む (a-z)" },
                        { key: "hasNumber", label: "数字を含む (0-9)" },
                        { key: "hasSymbol", label: "記号を含む (!@#$%...)" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span
                            className={
                              passwordStrength.requirements[
                                key as keyof typeof passwordStrength.requirements
                              ]
                                ? "text-green-400"
                                : "text-gray-400"
                            }
                          >
                            {passwordStrength.requirements[
                              key as keyof typeof passwordStrength.requirements
                            ]
                              ? "✓"
                              : "○"}
                          </span>
                          <span className="text-gray-300">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  新しいパスワード（確認）
                </label>
                <div className="relative">
                  <input
                    type={showNewPasswordConfirm ? "text" : "password"}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className="w-full bg-gray-700 text-white p-3 pr-10 rounded"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    <i className={showNewPasswordConfirm ? "fa-solid fa-eye" : "fa-solid fa-eye-slash"}></i>
                  </button>
                </div>
                {/* パスワード一致確認 */}
                {newPasswordConfirm && (
                  <div className={`mt-2 text-sm flex items-center gap-1 ${
                    passwordsMatch ? "text-green-400" : "text-red-400"
                  }`}>
                    {passwordsMatch ? "✓" : "✗"}
                    {passwordsMatch ? "パスワードが一致しています" : "パスワードが一致しません"}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setNewPasswordConfirm("");
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                disabled={changingPassword}
              >
                キャンセル
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !newPasswordConfirm ||
                  !passwordStrength.isValid
                }
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingPassword ? "変更中..." : "変更"}
              </button>
            </div>
          </div>
        </div>
      )}
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
