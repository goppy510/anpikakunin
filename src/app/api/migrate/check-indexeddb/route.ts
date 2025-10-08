import { NextResponse } from "next/server";

/**
 * IndexedDB設定データの存在確認用エンドポイント
 *
 * このエンドポイントは、クライアント側でIndexedDBデータの存在を確認するためのものです。
 * 実際のデータチェックはクライアント側で行い、このエンドポイントは説明のみを返します。
 */
export async function GET() {
  return NextResponse.json({
    message: "IndexedDBの確認はクライアント側で行ってください",
    instructions: {
      step1: "ブラウザのDevToolsを開く (F12)",
      step2: "Applicationタブ → IndexedDB → @dmdata/app-etcm → safetySettings を確認",
      step3: "データが存在する場合、Setupタブの「既存設定を確認」ボタンをクリック",
      step4: "「PostgreSQLに移行」ボタンで移行を実行"
    }
  });
}
