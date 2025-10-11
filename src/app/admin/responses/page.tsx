"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

type Response = {
  id: string;
  slackUserId: string;
  slackUserName: string;
  departmentName: string;
  respondedAt: string;
  earthquakeInfo: {
    title: string;
    maxIntensity: string;
    epicenter: string;
    occurrenceTime: string;
  };
};

export default function ResponsesPage() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/responses");
      setResponses(response.data.responses || []);

      // 部署リストを抽出
      const uniqueDepartments = Array.from(
        new Set(response.data.responses?.map((r: Response) => r.departmentName) || [])
      );
      setDepartments(uniqueDepartments as string[]);
    } catch (error) {
      console.error("応答履歴取得エラー:", error);
      toast.error("応答履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const filteredResponses = responses.filter((response) => {
    if (filterDepartment && response.departmentName !== filterDepartment) {
      return false;
    }

    if (filterDateFrom) {
      const responseDate = new Date(response.respondedAt);
      const fromDate = new Date(filterDateFrom);
      if (responseDate < fromDate) {
        return false;
      }
    }

    if (filterDateTo) {
      const responseDate = new Date(response.respondedAt);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999); // 当日の終わりまで含める
      if (responseDate > toDate) {
        return false;
      }
    }

    return true;
  });

  const exportToCSV = () => {
    const header = ["回答日時", "ユーザー名", "SlackユーザーID", "部署", "地震情報", "最大震度", "震源地", "発生時刻"];
    const rows = filteredResponses.map((r) => [
      new Date(r.respondedAt).toLocaleString("ja-JP"),
      r.slackUserName,
      r.slackUserId,
      r.departmentName,
      r.earthquakeInfo.title,
      r.earthquakeInfo.maxIntensity,
      r.earthquakeInfo.epicenter,
      r.earthquakeInfo.occurrenceTime ? new Date(r.earthquakeInfo.occurrenceTime).toLocaleString("ja-JP") : "",
    ]);

    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `本番応答履歴_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">本番応答履歴</h1>
        <button
          onClick={exportToCSV}
          disabled={filteredResponses.length === 0}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i className="fa-solid fa-download"></i>
          <span>CSV出力</span>
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">フィルター</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              部署
            </label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">すべて</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              開始日
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              終了日
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-users text-blue-400 text-2xl"></i>
            <div>
              <div className="text-gray-400 text-sm">総回答数</div>
              <div className="text-white text-2xl font-bold">{filteredResponses.length}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-building text-green-400 text-2xl"></i>
            <div>
              <div className="text-gray-400 text-sm">回答部署数</div>
              <div className="text-white text-2xl font-bold">
                {new Set(filteredResponses.map((r) => r.departmentName)).size}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-user text-purple-400 text-2xl"></i>
            <div>
              <div className="text-gray-400 text-sm">回答ユーザー数</div>
              <div className="text-white text-2xl font-bold">
                {new Set(filteredResponses.map((r) => r.slackUserId)).size}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 応答一覧テーブル */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p>読み込み中...</p>
          </div>
        ) : filteredResponses.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <i className="fa-solid fa-inbox text-4xl mb-2"></i>
            <p>応答履歴がありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">回答日時</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ユーザー名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">部署</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">地震情報</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">最大震度</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">震源地</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredResponses.map((response) => (
                  <tr key={response.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(response.respondedAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{response.slackUserName}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
                        {response.departmentName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {response.earthquakeInfo.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-white font-bold">
                      震度{response.earthquakeInfo.maxIntensity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {response.earthquakeInfo.epicenter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
