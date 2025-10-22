-- Add member:invite permission
INSERT INTO permissions (id, name, display_name, description, category, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'member:invite',
  'メンバー招待',
  '新しいメンバーを招待する権限',
  'member',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (name) DO NOTHING;

-- Attach member:invite permission to ADMIN group
DO $$
DECLARE
    admin_group_id TEXT;
    invite_permission_id TEXT;
BEGIN
    -- Get ADMIN group ID
    SELECT id INTO admin_group_id FROM groups WHERE name = 'ADMIN' AND is_system = true LIMIT 1;

    -- Get member:invite permission ID
    SELECT id INTO invite_permission_id FROM permissions WHERE name = 'member:invite' LIMIT 1;

    -- If both exist, attach permission to group
    IF admin_group_id IS NOT NULL AND invite_permission_id IS NOT NULL THEN
        INSERT INTO group_permission_attachments (id, group_id, permission_id, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            admin_group_id,
            invite_permission_id,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (group_id, permission_id) DO NOTHING;
    END IF;
END $$;
