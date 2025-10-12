export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // サーバーサイドでのみ実行
    const { startEarthquakeFetchCron } = await import("./lib/cron/earthquakeFetcher");
    startEarthquakeFetchCron();
  }
}
