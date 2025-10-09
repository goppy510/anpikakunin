"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    workspaces: 0,
    departments: 0,
    members: 0,
    activeNotifications: 0,
  });

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
    fetchStats();
  }, []);









  const cards = [
    {
      title: "ワークスペース",
      value: stats.workspaces,
      icon: "🔗",
      color: "blue",
      href: "/admin/workspaces",
    },
    {
      title: "部署",
      value: stats.departments,
      icon: "👥",
      color: "green",
      href: "/admin/departments",
    },
    {
      title: "メンバー",
      value: stats.members,
      icon: "👤",
      color: "purple",
      href: "/admin/members",
    },
    {
      title: "有効な通知",
      value: stats.activeNotifications,
      icon: "🔔",
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
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{card.icon}</span>
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
            <div className="text-lg font-bold mb-2">🔗 ワークスペース追加</div>
            <p className="text-sm text-blue-100">新しいSlackワークスペースを接続</p>
          </Link>

          <Link
            href="/admin/members"
            className="p-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            <div className="text-lg font-bold mb-2">👤 メンバー招待</div>
            <p className="text-sm text-green-100">新しいメンバーを招待する</p>
          </Link>

          <Link
            href="/admin/conditions"
            className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <div className="text-lg font-bold mb-2">⚙️ 通知設定</div>
            <p className="text-sm text-purple-100">地震通知条件を設定する</p>
          </Link>
        </div>
      </div>

      {/* 最近のアクティビティ */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">最近のアクティビティ</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-blue-400">●</span>
            <span className="text-gray-400">2025-01-08 14:30</span>
            <span>ワークスペース「eviry」を接続しました</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-400">●</span>
            <span className="text-gray-400">2025-01-08 14:25</span>
            <span>部署「開発」を追加しました</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-purple-400">●</span>
            <span className="text-gray-400">2025-01-08 14:20</span>
            <span>通知条件を更新しました</span>
          </div>
        </div>
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
