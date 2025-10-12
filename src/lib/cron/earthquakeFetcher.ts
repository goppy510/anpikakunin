import cron from "node-cron";

let cronJob: cron.ScheduledTask | null = null;

export function startEarthquakeFetchCron() {
  if (cronJob) {
    console.log("⚠️ Cron job already running");
    return;
  }

  // 1分ごとに実行
  cronJob = cron.schedule("*/1 * * * *", async () => {
    try {
      console.log("🔄 [Cron] Fetching earthquakes...");
      const response = await fetch("http://localhost:8080/api/cron/fetch-earthquakes");
      const data = await response.json();

      if (data.success) {
        console.log(`✅ [Cron] ${data.message}`);
      } else {
        console.error(`❌ [Cron] Error: ${data.error}`);
      }
    } catch (error) {
      console.error("❌ [Cron] Failed to fetch earthquakes:", error);
    }
  });

  console.log("✅ Earthquake fetch cron job started (every 1 minute)");
}

export function stopEarthquakeFetchCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("🛑 Earthquake fetch cron job stopped");
  }
}
