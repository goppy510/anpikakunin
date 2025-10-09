"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

type MessageTemplate = {
  id: string;
  type: "PRODUCTION" | "TRAINING";
  title: string;
  body: string;
};

type Workspace = {
  id: string;
  workspaceId: string;
  name: string;
};

export default function MessagesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editingType, setEditingType] = useState<"PRODUCTION" | "TRAINING" | null>(null);

  const [productionForm, setProductionForm] = useState({
    title: "",
    body: "",
  });

  const [trainingForm, setTrainingForm] = useState({
    title: "",
    body: "",
  });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchTemplates(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const fetchWorkspaces = async () => {
    try {
      const res = await axios.get("/api/slack/workspaces");
      setWorkspaces(res.data.workspaces || []);

      // 最初のワークスペースを自動選択
      if (res.data.workspaces && res.data.workspaces.length > 0) {
        setSelectedWorkspaceId(res.data.workspaces[0].workspaceId);
      }
    } catch (error) {
      console.error("ワークスペース取得エラー:", error);
      toast.error("ワークスペースの取得に失敗しました");
    }
  };

  const fetchTemplates = async (wid: string) => {
    try {
      const res = await axios.get(`/api/message-templates?workspaceId=${wid}`);
      setTemplates(res.data);

      const production = res.data.find((t: MessageTemplate) => t.type === "PRODUCTION");
      const training = res.data.find((t: MessageTemplate) => t.type === "TRAINING");

      if (production) {
        setProductionForm({ title: production.title, body: production.body });
      }
      if (training) {
        setTrainingForm({ title: training.title, body: training.body });
      }
    } catch (error) {
      console.error("テンプレート取得エラー:", error);
      toast.error("テンプレートの取得に失敗しました");
    }
  };

  const handleSave = async (type: "PRODUCTION" | "TRAINING") => {
    if (!selectedWorkspaceId) {
      toast.error("ワークスペースが選択されていません");
      return;
    }

    try {
      const formData = type === "PRODUCTION" ? productionForm : trainingForm;

      await axios.post("/api/message-templates", {
        workspaceId: selectedWorkspaceId,
        [type === "PRODUCTION" ? "production" : "training"]: formData,
      });

      toast.success("保存しました");
      setEditingType(null);
      fetchTemplates(selectedWorkspaceId);
    } catch (error) {
      console.error("保存エラー:", error);
      toast.error("保存に失敗しました");
    }
  };

  const handleCancel = (type: "PRODUCTION" | "TRAINING") => {
    setEditingType(null);
    const template = templates.find((t) => t.type === type);

    if (template) {
      if (type === "PRODUCTION") {
        setProductionForm({ title: template.title, body: template.body });
      } else {
        setTrainingForm({ title: template.title, body: template.body });
      }
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">メッセージ設定</h2>
      </div>

      {/* ワークスペース選択 */}
      {!selectedWorkspaceId ? (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
          <p className="text-red-300">⚠️ ワークスペースが選択されていません</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="block text-sm font-medium mb-2">ワークスペース</label>
          <select
            value={selectedWorkspaceId}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className="w-full bg-gray-700 p-2 rounded"
          >
            {workspaces.map((ws) => (
              <option key={ws.workspaceId} value={ws.workspaceId}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 使用可能な変数と注意事項 */}
      <div className="space-y-4">
        <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold mb-2">📝 使用可能な変数</h4>
          <ul className="text-sm space-y-1 text-gray-300">
            <li>
              <code className="bg-gray-700 px-2 py-1 rounded">
                {"{intensity}"}
              </code>{" "}
              - 最大震度
            </li>
            <li>
              <code className="bg-gray-700 px-2 py-1 rounded">
                {"{epicenter}"}
              </code>{" "}
              - 震源地
            </li>
            <li>
              <code className="bg-gray-700 px-2 py-1 rounded">
                {"{magnitude}"}
              </code>{" "}
              - マグニチュード
            </li>
            <li>
              <code className="bg-gray-700 px-2 py-1 rounded">
                {"{depth}"}
              </code>{" "}
              - 震源の深さ
            </li>
            <li>
              <code className="bg-gray-700 px-2 py-1 rounded">
                {"{occurrence_time}"}
              </code>{" "}
              - 発生時刻
            </li>
          </ul>
        </div>

        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4">
          <h4 className="font-semibold mb-2">⚠️ 絵文字の使用について</h4>
          <p className="text-sm text-gray-300 mb-2">
            メッセージ内で絵文字を使用する場合は、ワークスペースに登録されている絵文字名をコロン（:）で囲んで記述してください。
          </p>
          <div className="text-sm space-y-1 text-gray-300">
            <p className="font-semibold">例:</p>
            <ul className="list-disc list-inside ml-2">
              <li>
                <code className="bg-gray-700 px-2 py-1 rounded">:sos:</code> - SOS絵文字
              </li>
              <li>
                <code className="bg-gray-700 px-2 py-1 rounded">:dev:</code> - 開発部署の絵文字
              </li>
              <li>
                <code className="bg-gray-700 px-2 py-1 rounded">:warning:</code> - 警告絵文字
              </li>
            </ul>
            <p className="mt-2 text-yellow-300">
              ※ このメッセージはカスタムボタン付きでSlackに送信されます
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 本番用メッセージ */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center">
              <span className="bg-red-600 text-white px-2 py-1 rounded text-sm mr-2">
                本番
              </span>
              本番用メッセージ
            </h3>
            {editingType !== "PRODUCTION" ? (
              <button
                onClick={() => setEditingType("PRODUCTION")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                編集
              </button>
            ) : (
              <div className="space-x-2">
                <button
                  onClick={() => handleCancel("PRODUCTION")}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSave("PRODUCTION")}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                >
                  保存
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">タイトル</label>
              {editingType === "PRODUCTION" ? (
                <input
                  type="text"
                  value={productionForm.title}
                  onChange={(e) =>
                    setProductionForm({ ...productionForm, title: e.target.value })
                  }
                  className="w-full bg-gray-700 p-3 rounded"
                  placeholder="地震発生通知"
                />
              ) : (
                <div className="w-full bg-gray-700 p-3 rounded">
                  {productionForm.title || (
                    <span className="text-gray-400">未設定</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">本文</label>
              {editingType === "PRODUCTION" ? (
                <textarea
                  value={productionForm.body}
                  onChange={(e) =>
                    setProductionForm({ ...productionForm, body: e.target.value })
                  }
                  className="w-full bg-gray-700 p-3 rounded h-64"
                  placeholder="【安否確認のため、下記対応をお願いします】&#10;各リーダー・上長の方は、自組織のメンバーの押下確認お願いします。&#10;• 無事な方は所属の絵文字を押してください,&#10;• 救助などが必要な方は:sos:を押してください,&#10;• 連続で通知された場合は最後の通知の絵文字を押してください,&#10;落ち着いて行動してください&#10;&#10;** 【地震情報詳細】 **&#10;📍 震源地: {epicenter}&#10;📊 最大震度{intensity}&#10;発生時刻: {occurrence_time}&#10;マグニチュード: {magnitude}&#10;震源の深さ: 約{depth}km&#10;📋 情報種別: 確定情報&#10;&#10;安否確認（該当部署のボタンを押してください）&#10;⚠️ 一人一回のみ回答可能です"
                />
              ) : (
                <div className="w-full bg-gray-700 p-3 rounded whitespace-pre-wrap min-h-[8rem]">
                  {productionForm.body || (
                    <span className="text-gray-400">未設定</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 訓練用メッセージ */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center">
              <span className="bg-yellow-600 text-white px-2 py-1 rounded text-sm mr-2">
                訓練
              </span>
              訓練用メッセージ
            </h3>
            {editingType !== "TRAINING" ? (
              <button
                onClick={() => setEditingType("TRAINING")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                編集
              </button>
            ) : (
              <div className="space-x-2">
                <button
                  onClick={() => handleCancel("TRAINING")}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSave("TRAINING")}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                >
                  保存
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">タイトル</label>
              {editingType === "TRAINING" ? (
                <input
                  type="text"
                  value={trainingForm.title}
                  onChange={(e) =>
                    setTrainingForm({ ...trainingForm, title: e.target.value })
                  }
                  className="w-full bg-gray-700 p-3 rounded"
                  placeholder="【訓練】地震発生通知"
                />
              ) : (
                <div className="w-full bg-gray-700 p-3 rounded">
                  {trainingForm.title || (
                    <span className="text-gray-400">未設定</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">本文</label>
              {editingType === "TRAINING" ? (
                <textarea
                  value={trainingForm.body}
                  onChange={(e) =>
                    setTrainingForm({ ...trainingForm, body: e.target.value })
                  }
                  className="w-full bg-gray-700 p-3 rounded h-64"
                  placeholder="🔔【これは訓練です】🔔&#10;&#10;【安否確認のため、下記対応をお願いします】&#10;各リーダー・上長の方は、自組織のメンバーの押下確認お願いします。&#10;• 無事な方は所属の絵文字を押してください,&#10;• 救助などが必要な方は:sos:を押してください,&#10;• 連続で通知された場合は最後の通知の絵文字を押してください,&#10;落ち着いて行動してください&#10;&#10;** 【地震情報詳細】 **&#10;📍 震源地: {epicenter}&#10;📊 最大震度{intensity}&#10;発生時刻: {occurrence_time}&#10;マグニチュード: {magnitude}&#10;震源の深さ: 約{depth}km&#10;📋 情報種別: 確定情報&#10;&#10;安否確認（該当部署のボタンを押してください）&#10;⚠️ 一人一回のみ回答可能です&#10;&#10;🔔【これは訓練です】🔔"
                />
              ) : (
                <div className="w-full bg-gray-700 p-3 rounded whitespace-pre-wrap min-h-[8rem]">
                  {trainingForm.body || (
                    <span className="text-gray-400">未設定</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
