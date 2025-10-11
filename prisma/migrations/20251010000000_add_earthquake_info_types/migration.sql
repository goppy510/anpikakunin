-- 地震情報種別マスターテーブル
CREATE TABLE "earthquake_info_types" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 初期データ投入
INSERT INTO "earthquake_info_types" ("code", "name", "description", "display_order", "is_active") VALUES
('VXSE51', '震度速報', '震度3以上を観測した地域名と地震の発生時刻を発表', 1, true),
('VXSE53', '震源・震度情報', '地震の発生場所（震源）やその規模（マグニチュード）、震度3以上の地域名と市町村毎の観測した震度を発表', 2, true);

-- earthquake_notification_conditions テーブルに earthquake_info_type カラムを追加
ALTER TABLE "earthquake_notification_conditions"
ADD COLUMN "earthquake_info_type" TEXT NOT NULL DEFAULT 'VXSE53';

-- 外部キー制約を追加
ALTER TABLE "earthquake_notification_conditions"
ADD CONSTRAINT "earthquake_notification_conditions_earthquake_info_type_fkey"
FOREIGN KEY ("earthquake_info_type") REFERENCES "earthquake_info_types"("code")
ON DELETE RESTRICT ON UPDATE CASCADE;
