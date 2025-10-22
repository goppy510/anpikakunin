-- Add user:read permission
INSERT INTO permissions (id, name, display_name, description, category, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'user:read',
  'ユーザー閲覧',
  'ユーザー情報の閲覧',
  'user',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (name) DO NOTHING;

-- Attach user:read permission to ADMIN group
DO $$
DECLARE
    admin_group_id TEXT;
    user_read_permission_id TEXT;
BEGIN
    -- Get ADMIN group ID
    SELECT id INTO admin_group_id FROM groups WHERE name = '管理者グループ' AND is_system = true LIMIT 1;

    -- Get user:read permission ID
    SELECT id INTO user_read_permission_id FROM permissions WHERE name = 'user:read' LIMIT 1;

    -- If both exist, attach permission to group
    IF admin_group_id IS NOT NULL AND user_read_permission_id IS NOT NULL THEN
        INSERT INTO group_permission_attachments (id, group_id, permission_id, created_at)
        VALUES (
            gen_random_uuid(),
            admin_group_id,
            user_read_permission_id,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (group_id, permission_id) DO NOTHING;
    END IF;
END $$;
