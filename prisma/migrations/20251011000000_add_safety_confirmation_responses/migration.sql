-- CreateTable
CREATE TABLE "safety_confirmation_responses" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "slack_user_name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_confirmation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "safety_confirmation_responses_notification_id_idx" ON "safety_confirmation_responses"("notification_id");

-- CreateIndex
CREATE INDEX "safety_confirmation_responses_slack_user_id_idx" ON "safety_confirmation_responses"("slack_user_id");

-- CreateIndex
CREATE INDEX "safety_confirmation_responses_department_id_idx" ON "safety_confirmation_responses"("department_id");

-- CreateIndex
CREATE INDEX "safety_confirmation_responses_responded_at_idx" ON "safety_confirmation_responses"("responded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "safety_confirmation_responses_notification_id_slack_user_i_key" ON "safety_confirmation_responses"("notification_id", "slack_user_id");

-- AddForeignKey
ALTER TABLE "safety_confirmation_responses" ADD CONSTRAINT "safety_confirmation_responses_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "earthquake_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_confirmation_responses" ADD CONSTRAINT "safety_confirmation_responses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
