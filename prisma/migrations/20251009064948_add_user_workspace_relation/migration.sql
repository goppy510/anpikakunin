/*
  Warnings:

  - You are about to drop the column `notification_channel` on the `earthquake_notification_conditions` table. All the data in the column will be lost.
  - You are about to drop the `slack_notification_settings` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `channel_id` to the `earthquake_notification_conditions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "slack_notification_settings" DROP CONSTRAINT "slack_notification_settings_workspace_ref_fkey";

-- AlterTable
ALTER TABLE "earthquake_notification_conditions" DROP COLUMN "notification_channel",
ADD COLUMN     "channel_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "slack_notification_settings";

-- CreateTable
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

-- CreateTable
CREATE TABLE "user_workspaces" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_channels_workspace_ref_purpose_idx" ON "notification_channels"("workspace_ref", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_workspace_ref_channel_id_purpose_key" ON "notification_channels"("workspace_ref", "channel_id", "purpose");

-- CreateIndex
CREATE INDEX "user_workspaces_user_id_idx" ON "user_workspaces"("user_id");

-- CreateIndex
CREATE INDEX "user_workspaces_workspace_ref_idx" ON "user_workspaces"("workspace_ref");

-- CreateIndex
CREATE UNIQUE INDEX "user_workspaces_user_id_workspace_ref_key" ON "user_workspaces"("user_id", "workspace_ref");

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_workspaces" ADD CONSTRAINT "user_workspaces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_workspaces" ADD CONSTRAINT "user_workspaces_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
