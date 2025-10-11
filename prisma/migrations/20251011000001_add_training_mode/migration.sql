-- 訓練通知履歴テーブル
CREATE TABLE "training_notifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_ts" TEXT,
    "notification_status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_notifications_pkey" PRIMARY KEY ("id")
);

-- 訓練安否確認回答テーブル
CREATE TABLE "training_confirmation_responses" (
    "id" TEXT NOT NULL,
    "training_notification_id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "slack_user_name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_confirmation_responses_pkey" PRIMARY KEY ("id")
);

-- インデックス作成
CREATE INDEX "training_notifications_workspace_id_idx" ON "training_notifications"("workspace_id");
CREATE INDEX "training_notifications_notification_status_idx" ON "training_notifications"("notification_status");
CREATE INDEX "training_notifications_scheduled_at_idx" ON "training_notifications"("scheduled_at" ASC);
CREATE INDEX "training_notifications_created_at_idx" ON "training_notifications"("created_at" DESC);

CREATE UNIQUE INDEX "training_confirmation_responses_training_notification_id_slack_user_id_key" ON "training_confirmation_responses"("training_notification_id", "slack_user_id");
CREATE INDEX "training_confirmation_responses_training_notification_id_idx" ON "training_confirmation_responses"("training_notification_id");
CREATE INDEX "training_confirmation_responses_slack_user_id_idx" ON "training_confirmation_responses"("slack_user_id");
CREATE INDEX "training_confirmation_responses_department_id_idx" ON "training_confirmation_responses"("department_id");
CREATE INDEX "training_confirmation_responses_responded_at_idx" ON "training_confirmation_responses"("responded_at" DESC);

-- 外部キー制約
ALTER TABLE "training_notifications" ADD CONSTRAINT "training_notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_confirmation_responses" ADD CONSTRAINT "training_confirmation_responses_training_notification_id_fkey" FOREIGN KEY ("training_notification_id") REFERENCES "training_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_confirmation_responses" ADD CONSTRAINT "training_confirmation_responses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
