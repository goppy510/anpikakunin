-- AlterTable: Add cronJobId column to training_notifications
ALTER TABLE "training_notifications" ADD COLUMN IF NOT EXISTS "cron_job_id" TEXT;

-- CreateIndex: Add index on cronJobId for faster lookups
CREATE INDEX IF NOT EXISTS "training_notifications_cron_job_id_idx" ON "training_notifications"("cron_job_id");
