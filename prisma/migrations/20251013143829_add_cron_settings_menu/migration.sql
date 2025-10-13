-- Insert Cron Settings menu
INSERT INTO "menus" ("id", "name", "path", "icon", "display_order", "category_permission", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'Cron設定', '/admin/cronjob-settings', 'fa-solid fa-clock', 13, 'system:admin', true, NOW(), NOW())
ON CONFLICT ("path") DO NOTHING;
