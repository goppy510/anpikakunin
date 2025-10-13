-- CreateTable
CREATE TABLE "aws_credentials" (
    "id" TEXT NOT NULL,
    "access_key_id" TEXT NOT NULL,
    "secret_access_key" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'ap-northeast-1',
    "eventbridge_role_arn" TEXT,
    "api_destination_arn" TEXT,
    "connection_arn" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aws_credentials_pkey" PRIMARY KEY ("id")
);

-- Insert AWS Settings menu
INSERT INTO "menus" ("id", "name", "path", "icon", "display_order", "category_permission", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'AWS設定', '/admin/aws-settings', 'fa-brands fa-aws', 10, 'system:admin', true, NOW(), NOW())
ON CONFLICT ("path") DO NOTHING;

-- Update display_order for existing menus
UPDATE "menus" SET "display_order" = 11, "updated_at" = NOW() WHERE "name" = '訓練モード';
UPDATE "menus" SET "display_order" = 12, "updated_at" = NOW() WHERE "name" = '本番応答履歴';
UPDATE "menus" SET "display_order" = 13, "updated_at" = NOW() WHERE "name" = '訓練応答履歴';
UPDATE "menus" SET "display_order" = 14, "updated_at" = NOW() WHERE "name" = 'Cron設定';
