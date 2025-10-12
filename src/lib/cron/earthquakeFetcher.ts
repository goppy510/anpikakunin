import cron from "node-cron";

let cronJob: cron.ScheduledTask | null = null;

export function startEarthquakeFetchCron() {
  if (cronJob) {
    return;
  }

  // 1分ごとに実行
  cronJob = cron.schedule("*/1 * * * *", async () => {
    try {
      // Silenced

      // 認証ヘッダーを追加（開発環境では空でも許可される）
      const headers: HeadersInit = {};
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret) {
        headers["Authorization"] = `Bearer ${cronSecret}`;
      }

      const response = await fetch("http://localhost:8080/api/cron/fetch-earthquakes", {
        headers,
      });
      const data = await response.json();

      if (data.success) {
        // Silenced
      } else {
        // Silenced
      }
    } catch (error) {
      // Silenced
    }
  });

  // Silenced
}

export function stopEarthquakeFetchCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}
