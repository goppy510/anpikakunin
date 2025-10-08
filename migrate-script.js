/**
 * IndexedDB → PostgreSQL 移行スクリプト
 *
 * 使用方法:
 * 1. http://localhost:8080/safety-confirmation をブラウザで開く
 * 2. F12でDevToolsを開く
 * 3. このスクリプトをコピー＆ペーストして実行
 */

(async () => {
    console.log('=== IndexedDB → PostgreSQL 移行開始 ===');

    try {
        // IndexedDBを開く
        const { openDB } = await import('https://cdn.jsdelivr.net/npm/idb@7/+esm');
        const db = await openDB("@dmdata/app-etcm", 6554);

        // 既存設定を取得
        const settings = await db.get('safetySettings', 'default');

        if (!settings) {
            console.error('❌ IndexedDBに設定が見つかりませんでした');
            return;
        }

        console.log('✅ IndexedDB設定を取得しました:');
        console.log('ワークスペース数:', settings.slack?.workspaces?.length || 0);
        console.log('詳細:', settings);

        // DB固有フィールドを除去
        const { id, createdAt, updatedAt, ...config } = settings;

        // PostgreSQLに移行
        console.log('\n📤 PostgreSQLに移行中...');

        const response = await fetch('/api/migrate/indexeddb-to-postgres', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ config }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ 移行エラー:', errorData);
            return;
        }

        const result = await response.json();
        console.log('✅ 移行成功!');
        console.log('結果:', result);
        console.log(`成功: ${result.results.success}/${result.results.total} ワークスペース`);

        if (result.results.failed > 0) {
            console.warn('⚠️ 失敗したワークスペース:', result.details.failed);
        }

        // PostgreSQLデータを確認
        console.log('\n📊 PostgreSQLデータを確認中...');
        const checkResponse = await fetch('/api/slack/workspaces');
        const workspaces = await checkResponse.json();
        console.log('PostgreSQL保存データ:', workspaces);

        console.log('\n=== 移行完了 ===');

    } catch (error) {
        console.error('❌ エラーが発生しました:', error);
    }
})();
