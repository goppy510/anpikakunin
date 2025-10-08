"use client";

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">部署設定</h2>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">
          + 新規追加
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">部署設定機能は準備中です</p>
      </div>
    </div>
  );
}
