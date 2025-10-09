-- CreateTable: NotificationChannel
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_channels_workspace_ref_purpose_idx" ON "notification_channels"("workspace_ref", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_workspace_ref_channel_id_purpose_key" ON "notification_channels"("workspace_ref", "channel_id", "purpose");

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: EarthquakeNotificationCondition - カラム名変更
ALTER TABLE "earthquake_notification_conditions" RENAME COLUMN "notification_channel" TO "channel_id";

-- DropTable: SlackNotificationSetting
DROP TABLE IF EXISTS "slack_notification_settings";
