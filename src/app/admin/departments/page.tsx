"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { usePermissions } from "@/app/lib/hooks/usePermissions";

interface Department {
  id: string;
  name: string;
  slackEmoji: string;
  buttonColor: string;
  displayOrder: number;
  isActive: boolean;
}

interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
}

interface Emoji {
  name: string;
  url: string;
}

export default function DepartmentsPage() {
  const { hasPermission } = usePermissions();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // 新規追加フォーム
  const [newDept, setNewDept] = useState({
    name: "",
    slackEmoji: "",
    buttonColor: "#5B8FF9",
  });

  // 編集フォーム
  const [editDept, setEditDept] = useState({
    name: "",
    slackEmoji: "",
    buttonColor: "#5B8FF9",
  });

  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const response = await fetch("/api/slack/workspaces");
        if (response.ok) {
          const data = await response.json();
          const workspaceList = data.workspaces || [];
          setWorkspaces(workspaceList);
          if (workspaceList.length > 0) {
            setSelectedWorkspace(workspaceList[0].workspaceId);
          }
        }
      } catch (error) {
        console.error("Failed to load workspaces:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      void loadDepartments();
      void loadEmojis();
    }
  }, [selectedWorkspace]);

  const loadDepartments = async () => {
    try {
      const response = await fetch(`/api/departments?workspaceId=${selectedWorkspace}`);
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to load departments:", error);
    }
  };

  const loadEmojis = async () => {
    try {
      const response = await fetch(`/api/slack/emoji?workspaceId=${selectedWorkspace}`);
      if (response.ok) {
        const data = await response.json();
        setEmojis(data.emojis || []);
      }
    } catch (error) {
      console.error("Failed to load emojis:", error);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDept.name || !newDept.slackEmoji) {
      toast.error("部署名とスタンプを入力してください");
      return;
    }

    try {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: selectedWorkspace,
          name: newDept.name,
          slackEmoji: newDept.slackEmoji,
          buttonColor: newDept.buttonColor,
        }),
      });

      if (response.ok) {
        toast.success("部署を追加しました");
        setNewDept({ name: "", slackEmoji: "", buttonColor: "#5B8FF9" });
        setShowAddForm(false);
        setEmojiSearch("");
        await loadDepartments();
      } else {
        const error = await response.json();
        toast.error(error.error || "部署の追加に失敗しました");
      }
    } catch (error) {
      console.error("Failed to add department:", error);
      toast.error("部署の追加に失敗しました");
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm("この部署を削除しますか？")) return;

    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("部署を削除しました");
        await loadDepartments();
      } else {
        toast.error("部署の削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete department:", error);
      toast.error("部署の削除に失敗しました");
    }
  };

  const handleEditDepartment = async (id: string) => {
    if (!editDept.name || !editDept.slackEmoji) {
      toast.error("部署名とスタンプを入力してください");
      return;
    }

    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDept.name,
          slackEmoji: editDept.slackEmoji,
          buttonColor: editDept.buttonColor,
        }),
      });

      if (response.ok) {
        toast.success("部署を更新しました");
        setEditingId(null);
        setEmojiSearch("");
        await loadDepartments();
      } else {
        const error = await response.json();
        toast.error(error.error || "部署の更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update department:", error);
      toast.error("部署の更新に失敗しました");
    }
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditDept({
      name: dept.name,
      slackEmoji: dept.slackEmoji,
      buttonColor: dept.buttonColor,
    });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDept({ name: "", slackEmoji: "", buttonColor: "#5B8FF9" });
    setEmojiSearch("");
  };

  const filteredEmojis = emojis.filter((emoji) =>
    emoji.name.toLowerCase().includes(emojiSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">部署設定</h2>
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">
            ワークスペースが登録されていません
          </p>
          <a
            href="/admin/workspaces"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded inline-block"
          >
            ワークスペースを追加
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {/* ワークスペース選択 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <label className="block mb-2 text-sm font-semibold">ワークスペース</label>
        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="w-full bg-gray-700 p-2 rounded"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.workspaceId}>
              {ws.name}
            </option>
          ))}
        </select>
      </div>

      {/* 部署カードグリッド */}
      <div className="grid grid-cols-3 gap-4">
        {/* 既存の部署カード */}
        {departments.map((dept, index) => (
          <div
            key={dept.id}
            className={`bg-gray-800 rounded-lg p-6 border ${
              editingId === dept.id ? "border-2 border-blue-600" : "border border-gray-700"
            }`}
          >
            {editingId === dept.id ? (
              // 編集モード
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm">部署名</label>
                  <input
                    type="text"
                    value={editDept.name}
                    onChange={(e) => setEditDept({ ...editDept, name: e.target.value })}
                    className="w-full bg-gray-700 p-2 rounded"
                    placeholder="例: 開発部"
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm">スタンプ検索</label>
                  <input
                    type="text"
                    value={emojiSearch}
                    onChange={(e) => setEmojiSearch(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded mb-2"
                    placeholder="絵文字を検索..."
                  />
                  <div className="bg-gray-900 p-2 rounded max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-6 gap-1">
                      {filteredEmojis.map((emoji) => (
                        <button
                          key={emoji.name}
                          onClick={() => setEditDept({ ...editDept, slackEmoji: `:${emoji.name}:` })}
                          className={`p-1 rounded hover:bg-gray-700 ${
                            editDept.slackEmoji === `:${emoji.name}:` ? "bg-blue-600" : ""
                          }`}
                          title={emoji.name}
                        >
                          <img src={emoji.url} alt={emoji.name} className="w-6 h-6" />
                        </button>
                      ))}
                    </div>
                  </div>
                  {editDept.slackEmoji && (
                    <p className="text-xs text-gray-400 mt-1">
                      選択中: {editDept.slackEmoji}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 text-sm">ボタンカラー</label>
                  <input
                    type="color"
                    value={editDept.buttonColor}
                    onChange={(e) => setEditDept({ ...editDept, buttonColor: e.target.value })}
                    className="w-full h-10 rounded"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleEditDepartment(dept.id)}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                  >
                    更新
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              // 表示モード
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm">部署名</label>
                  <input
                    type="text"
                    value={dept.name}
                    className="w-full bg-gray-700 p-2 rounded"
                    disabled
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm">選択中のスタンプ</label>
                  <div className="flex items-center gap-2">
                    {emojis.find(e => `:${e.name}:` === dept.slackEmoji) ? (
                      <img
                        src={emojis.find(e => `:${e.name}:` === dept.slackEmoji)!.url}
                        alt={dept.slackEmoji}
                        className="w-12 h-12"
                      />
                    ) : (
                      <span className="text-3xl">{dept.slackEmoji}</span>
                    )}
                    <span className="text-sm text-gray-400">{dept.slackEmoji}</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm">ボタンカラー</label>
                  <div className="flex gap-2 items-center">
                    <div
                      className="w-10 h-10 rounded border border-gray-600"
                      style={{ backgroundColor: dept.buttonColor }}
                    />
                    <span className="text-sm text-gray-400">{dept.buttonColor}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(dept)}
                    disabled={!hasPermission("department:write")}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteDepartment(dept.id)}
                    disabled={!hasPermission("department:write")}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    削除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 新規追加フォームカード（showAddFormがtrueの時だけ表示） */}
        {showAddForm && (
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-blue-600">
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm">部署名</label>
                <input
                  type="text"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="例: 開発部"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm">スタンプ検索</label>
                <input
                  type="text"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  className="w-full bg-gray-700 p-2 rounded mb-2"
                  placeholder="絵文字を検索..."
                />
                <div className="bg-gray-900 p-2 rounded max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-6 gap-1">
                    {filteredEmojis.map((emoji) => (
                      <button
                        key={emoji.name}
                        onClick={() => setNewDept({ ...newDept, slackEmoji: `:${emoji.name}:` })}
                        className={`p-1 rounded hover:bg-gray-700 ${
                          newDept.slackEmoji === `:${emoji.name}:` ? "bg-blue-600" : ""
                        }`}
                        title={emoji.name}
                      >
                        <img src={emoji.url} alt={emoji.name} className="w-6 h-6" />
                      </button>
                    ))}
                  </div>
                </div>
                {newDept.slackEmoji && (
                  <p className="text-xs text-gray-400 mt-1">
                    選択中: {newDept.slackEmoji}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-2 text-sm">ボタンカラー</label>
                <input
                  type="color"
                  value={newDept.buttonColor}
                  onChange={(e) => setNewDept({ ...newDept, buttonColor: e.target.value })}
                  className="w-full h-10 rounded"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleAddDepartment}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  追加
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewDept({ name: "", slackEmoji: "", buttonColor: "#5B8FF9" });
                    setEmojiSearch("");
                  }}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* プラスボタンカード（フォーム非表示時のみ） */}
        {!showAddForm && hasPermission("department:write") && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-gray-800 rounded-lg p-6 border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors flex items-center justify-center h-full"
          >
            <div className="text-center">
              <div className="text-6xl text-gray-600 mb-2">+</div>
              <p className="text-gray-400">新しい部署を追加</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
