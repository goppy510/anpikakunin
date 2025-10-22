"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email: string;
  role: "ADMIN" | "EDITOR";
  isActive: boolean;
  emailVerified: boolean;
}

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "EDITOR";
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/session");

        if (!response.ok) {
          router.push("/login");
          return;
        }

        const data = await response.json();
        const authenticatedUser = data.user;

        // 権限チェック
        if (requiredRole === "ADMIN" && authenticatedUser.role !== "ADMIN") {
          alert("この画面にアクセスする権限がありません");
          router.push("/admin"); // ダッシュボードへ
          return;
        }

        setUser(authenticatedUser);
      } catch (error) {
        // Silenced
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    void checkAuth();
  }, [router, requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
