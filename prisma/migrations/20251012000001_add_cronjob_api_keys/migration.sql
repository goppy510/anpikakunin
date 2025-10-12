-- CreateTable: Add cronjob_api_keys table
CREATE TABLE IF NOT EXISTS "cronjob_api_keys" (
    "id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cronjob_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cronjob_api_keys_is_active_idx" ON "cronjob_api_keys"("is_active");
