-- CreateEnum
CREATE TYPE "MessageTemplateType" AS ENUM ('PRODUCTION', 'TRAINING');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slack_emoji" TEXT NOT NULL,
    "button_color" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earthquake_notification_conditions" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "min_intensity" TEXT NOT NULL,
    "target_prefectures" TEXT[],
    "notification_channel" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "earthquake_notification_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "type" "MessageTemplateType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_workspace_ref_idx" ON "departments"("workspace_ref");

-- CreateIndex
CREATE INDEX "departments_workspace_ref_display_order_idx" ON "departments"("workspace_ref", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "earthquake_notification_conditions_workspace_ref_key" ON "earthquake_notification_conditions"("workspace_ref");

-- CreateIndex
CREATE INDEX "earthquake_notification_conditions_workspace_ref_idx" ON "earthquake_notification_conditions"("workspace_ref");

-- CreateIndex
CREATE INDEX "message_templates_workspace_ref_type_idx" ON "message_templates"("workspace_ref", "type");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_workspace_ref_type_key" ON "message_templates"("workspace_ref", "type");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earthquake_notification_conditions" ADD CONSTRAINT "earthquake_notification_conditions_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
