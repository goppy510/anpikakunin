// src/app/lib/env.ts
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8080";

export const env = {
  NEXT_PUBLIC_BASE_URL: BASE_URL,
  NEXT_PUBLIC_OAUTH_REDIRECT_URI: `${BASE_URL}/api/admin/dmdata-oauth/callback`,
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : BASE_URL,
  DATABASE_URL:
    process.env.SUPABASE_DB_URL ??
    process.env.DATABASE_URL ??
    "",
  DATABASE_SSL:
    process.env.SUPABASE_DB_SSL ??
    process.env.DATABASE_SSL ??
    "require",
  SLACK_TOKEN_ENCRYPTION_KEY:
    process.env.SLACK_TOKEN_ENCRYPTION_KEY ?? "",
  CRON_SECRET:
    process.env.CRON_SECRET ?? "",
  DMDATA_API_KEY:
    process.env.DMDATA_API_KEY ?? "",
  CRONJOB_API_KEY:
    process.env.CRONJOB_API_KEY ?? "",
};
