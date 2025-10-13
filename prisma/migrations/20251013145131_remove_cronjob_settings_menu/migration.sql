-- Remove EventBridge Settings menu (formerly Cron Settings)
-- EventBridge Rulesは管理画面不要（AWS Consoleで設定）
DELETE FROM "menus" WHERE "path" = '/admin/cronjob-settings';
