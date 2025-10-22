-- AlterTable: UserInvitationにgroupIdカラムを追加（まずNULL許可で追加）
ALTER TABLE "user_invitations" ADD COLUMN "group_id" TEXT;

-- 既存レコードにデフォルトのグループIDを設定（ADMINグループ）
DO $$
DECLARE
    admin_group_id TEXT;
BEGIN
    SELECT id INTO admin_group_id FROM groups WHERE is_system = true AND name = '管理者グループ' LIMIT 1;
    IF admin_group_id IS NOT NULL THEN
        UPDATE user_invitations SET group_id = admin_group_id WHERE group_id IS NULL;
    END IF;
END $$;

-- group_idをNOT NULLに変更
ALTER TABLE "user_invitations" ALTER COLUMN "group_id" SET NOT NULL;

-- CreateIndex: groupIdにインデックスを追加
CREATE INDEX "user_invitations_group_id_idx" ON "user_invitations"("group_id");

-- AddForeignKey: groupIdに外部キー制約を追加
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
