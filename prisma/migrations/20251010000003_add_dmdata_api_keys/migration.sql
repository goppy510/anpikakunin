-- CreateTable
CREATE TABLE "dmdata_api_keys" (
    "id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dmdata_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dmdata_api_keys_is_active_idx" ON "dmdata_api_keys"("is_active");
