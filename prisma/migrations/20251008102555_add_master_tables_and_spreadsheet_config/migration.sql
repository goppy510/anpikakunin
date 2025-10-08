-- CreateTable
CREATE TABLE "spreadsheet_configs" (
    "id" TEXT NOT NULL,
    "workspace_ref" TEXT NOT NULL,
    "spreadsheet_url" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spreadsheet_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prefectures" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_kana" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prefectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intensity_scales" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "numeric_value" DECIMAL(3,1) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intensity_scales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spreadsheet_configs_workspace_ref_key" ON "spreadsheet_configs"("workspace_ref");

-- CreateIndex
CREATE INDEX "spreadsheet_configs_workspace_ref_idx" ON "spreadsheet_configs"("workspace_ref");

-- CreateIndex
CREATE UNIQUE INDEX "prefectures_code_key" ON "prefectures"("code");

-- CreateIndex
CREATE UNIQUE INDEX "prefectures_name_key" ON "prefectures"("name");

-- CreateIndex
CREATE INDEX "prefectures_code_idx" ON "prefectures"("code");

-- CreateIndex
CREATE INDEX "prefectures_region_idx" ON "prefectures"("region");

-- CreateIndex
CREATE UNIQUE INDEX "intensity_scales_value_key" ON "intensity_scales"("value");

-- CreateIndex
CREATE INDEX "intensity_scales_value_idx" ON "intensity_scales"("value");

-- CreateIndex
CREATE INDEX "intensity_scales_numeric_value_idx" ON "intensity_scales"("numeric_value");

-- AddForeignKey
ALTER TABLE "spreadsheet_configs" ADD CONSTRAINT "spreadsheet_configs_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
