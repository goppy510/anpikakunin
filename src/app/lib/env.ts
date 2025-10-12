// src/app/lib/env.ts
export const env = {
  NEXT_PUBLIC_OAUTH_REDIRECT_URI:
    process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ?? "http://localhost:3000/oauth",
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
};
