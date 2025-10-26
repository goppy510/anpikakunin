-- CreateTable: notification_snooze_configs
CREATE TABLE "notification_snooze_configs" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "duration_hours" INTEGER NOT NULL DEFAULT 24,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_snooze_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notification_snoozes
CREATE TABLE "notification_snoozes" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "snoozed_by" TEXT NOT NULL,
    "snoozed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_snoozes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_snooze_configs_workspace_ref_key" ON "notification_snooze_configs"("workspace_ref");

-- CreateIndex
CREATE INDEX "notification_snooze_configs_workspace_ref_idx" ON "notification_snooze_configs"("workspace_ref");

-- CreateIndex
CREATE UNIQUE INDEX "notification_snoozes_workspace_ref_key" ON "notification_snoozes"("workspace_ref");

-- CreateIndex
CREATE INDEX "notification_snoozes_workspace_ref_idx" ON "notification_snoozes"("workspace_ref");

-- CreateIndex
CREATE INDEX "notification_snoozes_expires_at_idx" ON "notification_snoozes"("expires_at");

-- AddForeignKey
ALTER TABLE "notification_snooze_configs" ADD CONSTRAINT "notification_snooze_configs_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_snoozes" ADD CONSTRAINT "notification_snoozes_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
