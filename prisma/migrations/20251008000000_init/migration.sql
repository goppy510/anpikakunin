-- CreateTable
CREATE TABLE "earthquake_event_logs" (
    "id" SERIAL NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earthquake_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_workspaces" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bot_token_ciphertext" BYTEA NOT NULL,
    "bot_token_iv" BYTEA NOT NULL,
    "bot_token_tag" BYTEA NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_notification_settings" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "min_intensity" TEXT,
    "target_prefectures" TEXT[],
    "notification_channels" JSONB,
    "extra_settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_earthquake_event_logs_event_id" ON "earthquake_event_logs"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "earthquake_event_logs_event_id_payload_hash_key" ON "earthquake_event_logs"("event_id", "payload_hash");

-- CreateIndex
CREATE UNIQUE INDEX "slack_workspaces_workspace_id_key" ON "slack_workspaces"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_slack_workspaces_workspace_id" ON "slack_workspaces"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_notification_settings_workspace_ref_key" ON "slack_notification_settings"("workspace_ref");

-- AddForeignKey
ALTER TABLE "slack_notification_settings" ADD CONSTRAINT "slack_notification_settings_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
