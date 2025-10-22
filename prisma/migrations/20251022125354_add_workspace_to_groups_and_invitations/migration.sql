-- AlterTable
-- Add workspace_ref to groups table (nullable for system groups)
ALTER TABLE "groups" ADD COLUMN "workspace_ref" TEXT;

-- AlterTable
-- Add workspace_ref to user_invitations table (nullable initially)
ALTER TABLE "user_invitations" ADD COLUMN "workspace_ref" TEXT;

-- Get the first workspace ID (or create one if none exists)
DO $$
DECLARE
    first_workspace_id TEXT;
BEGIN
    -- Get the first workspace
    SELECT id INTO first_workspace_id FROM slack_workspaces LIMIT 1;

    -- If there's a workspace, update existing invitations
    IF first_workspace_id IS NOT NULL THEN
        UPDATE user_invitations SET workspace_ref = first_workspace_id WHERE workspace_ref IS NULL;
    END IF;
END $$;

-- Now make it NOT NULL
ALTER TABLE "user_invitations" ALTER COLUMN "workspace_ref" SET NOT NULL;

-- CreateIndex
CREATE INDEX "groups_workspace_ref_idx" ON "groups"("workspace_ref");

-- CreateIndex
CREATE INDEX "user_invitations_workspace_ref_idx" ON "user_invitations"("workspace_ref");

-- CreateIndex
-- Create unique constraint for workspace + group name combination
CREATE UNIQUE INDEX "unique_workspace_group_name" ON "groups"("workspace_ref", "name");

-- DropIndex
-- Drop the old unique index on name only (since we now have workspace-scoped uniqueness)
DROP INDEX IF EXISTS "groups_name_key";

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_workspace_ref_fkey" FOREIGN KEY ("workspace_ref") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
