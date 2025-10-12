/**
 * IndexedDB → PostgreSQL 移行スクリプト
 *
 * 使用方法:
 * 1. http://localhost:8080/safety-confirmation をブラウザで開く
 * 2. F12でDevToolsを開く
 * 3. このスクリプトをコピー＆ペーストして実行
 */

(async () => {

    try {
        // IndexedDBを開く
        const { openDB } = await import('https://cdn.jsdelivr.net/npm/idb@7/+esm');
        const db = await openDB("@dmdata/app-etcm", 6554);

        // 既存設定を取得
        const settings = await db.get('safetySettings', 'default');

        if (!settings) {
            return;
        }


        // DB固有フィールドを除去
        const { id, createdAt, updatedAt, ...config } = settings;

        // PostgreSQLに移行

        const response = await fetch('/api/migrate/indexeddb-to-postgres', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ config }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            return;
        }

        const result = await response.json();

        if (result.results.failed > 0) {
        }

        // PostgreSQLデータを確認
        const checkResponse = await fetch('/api/slack/workspaces');
        const workspaces = await checkResponse.json();


    } catch (error) {
    }
})();
