"use client";

import { useState, useEffect } from "react";
import { SafetyResponse, SafetyResponseDatabase } from "../utils/responseDatabase";

interface ResponseListProps {
  messageTs?: string;
  channelId?: string;
}

export function ResponseList({ messageTs, channelId }: ResponseListProps) {
  const [responses, setResponses] = useState<SafetyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentCounts, setDepartmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadResponses();
  }, [messageTs, channelId]);

  const loadResponses = async () => {
    try {
      setLoading(true);
      
      if (messageTs && channelId) {
        // 特定メッセージの応答を取得
        const messageResponses = await SafetyResponseDatabase.getResponsesByMessage(messageTs, channelId);
        setResponses(messageResponses);
        
        // 部署別カウントを取得
        const counts = await SafetyResponseDatabase.getDepartmentCounts(messageTs, channelId);
        setDepartmentCounts(counts);
      } else {
        // 全体の最新応答を取得
        const latestResponses = await SafetyResponseDatabase.getLatestResponses(50);
        setResponses(latestResponses);
      }
    } catch (error) {
      console.error("応答データの読み込みに失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteResponse = async (id: string) => {
    if (confirm("この応答を削除しますか？")) {
      try {
        await SafetyResponseDatabase.deleteResponse(id);
        await loadResponses(); // リロード
      } catch (error) {
        console.error("応答の削除に失敗:", error);
        alert("応答の削除に失敗しました");
      }
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-400">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 部署別サマリー */}
      {messageTs && Object.keys(departmentCounts).length > 0 && (
        <div className="bg-gray-700 p-4 rounded">
          <h4 className="text-white font-medium mb-3">部署別応答状況</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(departmentCounts).map(([deptId, count]) => {
              const firstResponse = responses.find(r => r.departmentId === deptId);
              return (
                <div key={deptId} className="bg-gray-600 p-2 rounded text-center">
                  <div className="text-lg">{firstResponse?.departmentName || deptId}</div>
                  <div className="text-2xl font-bold text-green-400">{count}人</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 応答一覧 */}
      <div className="bg-gray-700 p-4 rounded">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">
            安否確認応答一覧 ({responses.length}件)
          </h4>
          <button
            onClick={loadResponses}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            更新
          </button>
        </div>

        {responses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            まだ応答がありません
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {responses.map(response => (
              <div key={response.id} className="bg-gray-600 p-3 rounded flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{response.departmentName}</span>
                    <span className="text-white font-medium">{response.userRealName}</span>
                    <span className="text-gray-400 text-sm">(@{response.userName})</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatTimestamp(response.timestamp)}
                    {response.channelId && (
                      <span className="ml-2">チャンネル: {response.channelId}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteResponse(response.id)}
                  className="text-red-400 hover:text-red-300 text-sm p-1"
                  title="削除"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* クリーンアップボタン */}
      <div className="flex justify-end">
        <button
          onClick={async () => {
            if (confirm("30日以上古い応答データを削除しますか？")) {
              try {
                await SafetyResponseDatabase.cleanupOldResponses(30);
                await loadResponses();
                alert("古いデータをクリーンアップしました");
              } catch (error) {
                console.error("クリーンアップに失敗:", error);
                alert("クリーンアップに失敗しました");
              }
            }
          }}
          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
        >
          古いデータをクリーンアップ
        </button>
      </div>
    </div>
  );
}