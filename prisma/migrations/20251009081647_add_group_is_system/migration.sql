-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "groups_is_system_idx" ON "groups"("is_system");
