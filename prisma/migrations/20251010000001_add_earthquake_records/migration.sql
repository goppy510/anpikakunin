-- 地震情報記録テーブル（震度3以上の地震を記録）
CREATE TABLE "earthquake_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "info_type" TEXT NOT NULL, -- VXSE51 or VXSE53
    "title" TEXT NOT NULL,
    "epicenter" TEXT, -- 震源地
    "magnitude" DOUBLE PRECISION, -- マグニチュード
    "depth" TEXT, -- 震源の深さ
    "max_intensity" TEXT NOT NULL, -- 最大震度
    "occurrence_time" TIMESTAMP(3), -- 発生時刻
    "arrival_time" TIMESTAMP(3), -- 到達時刻（VXSE51の場合）
    "raw_data" JSONB NOT NULL, -- 元のAPIレスポンス
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 都道府県別震度記録テーブル
CREATE TABLE "earthquake_prefecture_observations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "earthquake_record_id" TEXT NOT NULL,
    "prefecture_code" TEXT NOT NULL,
    "prefecture_name" TEXT NOT NULL,
    "max_intensity" TEXT NOT NULL, -- その都道府県での最大震度
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earthquake_prefecture_observations_earthquake_record_id_fkey"
    FOREIGN KEY ("earthquake_record_id") REFERENCES "earthquake_records"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "earthquake_prefecture_observations_prefecture_code_fkey"
    FOREIGN KEY ("prefecture_code") REFERENCES "prefectures"("code")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 通知履歴テーブル
CREATE TABLE "earthquake_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "earthquake_record_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_ts" TEXT, -- Slackメッセージのタイムスタンプ
    "notification_status" TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
    "error_message" TEXT,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earthquake_notifications_earthquake_record_id_fkey"
    FOREIGN KEY ("earthquake_record_id") REFERENCES "earthquake_records"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "earthquake_notifications_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "slack_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- インデックス
CREATE INDEX "earthquake_records_event_id_idx" ON "earthquake_records"("event_id");
CREATE INDEX "earthquake_records_info_type_idx" ON "earthquake_records"("info_type");
CREATE INDEX "earthquake_records_max_intensity_idx" ON "earthquake_records"("max_intensity");
CREATE INDEX "earthquake_records_occurrence_time_idx" ON "earthquake_records"("occurrence_time" DESC);
CREATE INDEX "earthquake_records_created_at_idx" ON "earthquake_records"("created_at" DESC);

CREATE UNIQUE INDEX "earthquake_prefecture_observations_earthquake_record_id_prefecture_code_key"
ON "earthquake_prefecture_observations"("earthquake_record_id", "prefecture_code");
CREATE INDEX "earthquake_prefecture_observations_prefecture_code_idx" ON "earthquake_prefecture_observations"("prefecture_code");
CREATE INDEX "earthquake_prefecture_observations_max_intensity_idx" ON "earthquake_prefecture_observations"("max_intensity");

CREATE INDEX "earthquake_notifications_workspace_id_idx" ON "earthquake_notifications"("workspace_id");
CREATE INDEX "earthquake_notifications_notification_status_idx" ON "earthquake_notifications"("notification_status");
CREATE INDEX "earthquake_notifications_created_at_idx" ON "earthquake_notifications"("created_at" DESC);
