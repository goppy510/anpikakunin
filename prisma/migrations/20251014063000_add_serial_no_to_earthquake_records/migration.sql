-- AlterTable
ALTER TABLE "earthquake_records" ADD COLUMN "serial_no" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "earthquake_records_event_id_serial_no_key" ON "earthquake_records"("event_id", "serial_no");
