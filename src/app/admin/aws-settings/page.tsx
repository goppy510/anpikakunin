"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface AwsCredentialInfo {
  id: string;
  region: string;
  eventBridgeRoleArn: string | null;
  apiDestinationArn: string | null;
  connectionArn: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AwsSettingsPage() {
  const [configured, setConfigured] = useState(false);
  const [credential, setCredential] = useState<AwsCredentialInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 入力フォーム
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("ap-northeast-1");

  useEffect(() => {
    fetchCredentialStatus();
  }, []);

  const fetchCredentialStatus = async () => {
    try {
      const response = await fetch("/api/admin/aws-credentials", {
        headers: {
          "x-admin-password": "admin123", // TODO: 実際の認証に置き換える
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConfigured(data.configured);
        if (data.credential) {
          setCredential(data.credential);
          setRegion(data.credential.region);
        }
      }
    } catch (error) {
      console.error("Failed to fetch AWS credentials:", error);
      toast.error("AWS認証情報の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accessKeyId || !secretAccessKey) {
      toast.error("Access Key IDとSecret Access Keyを入力してください");
      return;
    }

    // AWS Access Key ID形式チェック
    if (!/^AKIA[0-9A-Z]{16}$/.test(accessKeyId)) {
      toast.error("AWS Access Key IDの形式が正しくありません");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/aws-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": "admin123", // TODO: 実際の認証に置き換える
        },
        body: JSON.stringify({
          accessKeyId,
          secretAccessKey,
          region,
        }),
      });

      if (response.ok) {
        toast.success("AWS認証情報を保存しました");
        setAccessKeyId("");
        setSecretAccessKey("");
        fetchCredentialStatus();
      } else {
        const data = await response.json();
        toast.error(data.error || "保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save AWS credentials:", error);
      toast.error("AWS認証情報の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("AWS認証情報を削除しますか？")) {
      return;
    }

    try {
      const response = await fetch("/api/admin/aws-credentials", {
        method: "DELETE",
        headers: {
          "x-admin-password": "admin123", // TODO: 実際の認証に置き換える
        },
      });

      if (response.ok) {
        toast.success("AWS認証情報を削除しました");
        fetchCredentialStatus();
      } else {
        toast.error("削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete AWS credentials:", error);
      toast.error("AWS認証情報の削除に失敗しました");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AWS設定</h1>
      </div>

      {/* AWS認証情報の説明 */}
      <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <i className="fa-solid fa-info-circle text-blue-400 mt-1"></i>
          <div className="text-sm">
            <p className="font-semibold text-blue-300 mb-2">AWS認証情報について</p>
            <p className="text-blue-200">
              訓練モードのスケジュール自動設定にAWS EventBridge Schedulerを使用します。
              <br />
              AWS IAMでAccess Key / Secret Keyを作成し、以下の権限を付与してください：
            </p>
            <ul className="list-disc list-inside mt-2 text-blue-200 space-y-1">
              <li>scheduler:CreateSchedule</li>
              <li>scheduler:DeleteSchedule</li>
              <li>scheduler:GetSchedule</li>
              <li>events:PutRule</li>
              <li>events:DeleteRule</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 現在の設定状態 */}
      {configured && credential && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-check-circle text-green-500"></i>
            <span>設定済み</span>
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">リージョン:</span>
              <span>{credential.region}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">作成日時:</span>
              <span>{new Date(credential.createdAt).toLocaleString("ja-JP")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">最終更新:</span>
              <span>{new Date(credential.updatedAt).toLocaleString("ja-JP")}</span>
            </div>
          </div>
          <button
            onClick={handleDelete}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
          >
            <i className="fa-solid fa-trash mr-2"></i>
            削除
          </button>
        </div>
      )}

      {/* AWS認証情報入力フォーム */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-lg font-bold mb-4">
          {configured ? "AWS認証情報を更新" : "AWS認証情報を設定"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              AWS Access Key ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              AKIAで始まる20文字のAccess Key ID
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              AWS Secret Access Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              40文字のSecret Access Key（保存後は表示されません）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              AWS Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="ap-northeast-1">アジアパシフィック (東京)</option>
              <option value="us-east-1">米国東部 (バージニア北部)</option>
              <option value="us-west-2">米国西部 (オレゴン)</option>
              <option value="eu-west-1">欧州 (アイルランド)</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                保存中...
              </>
            ) : (
              <>
                <i className="fa-solid fa-save mr-2"></i>
                保存
              </>
            )}
          </button>
        </div>
      </div>

      {/* 補足情報 */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-lg font-bold mb-4">
          <i className="fa-solid fa-book mr-2"></i>
          セットアップガイド
        </h2>
        <div className="text-sm space-y-2 text-gray-300">
          <p>1. AWS IAMコンソールでIAMユーザーを作成</p>
          <p>2. EventBridge Schedulerの権限を付与</p>
          <p>3. Access Key / Secret Keyを生成</p>
          <p>4. このページで認証情報を登録</p>
          <p className="mt-4">
            <a
              href="https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/id_credentials_access-keys.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              <i className="fa-solid fa-external-link mr-1"></i>
              AWS IAM Access Keyの作成方法
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
