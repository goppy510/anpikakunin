-- AlterTable: UserInvitationにgroupIdカラムを追加
ALTER TABLE "user_invitations" ADD COLUMN "group_id" TEXT NOT NULL;

-- CreateIndex: groupIdにインデックスを追加
CREATE INDEX "user_invitations_group_id_idx" ON "user_invitations"("group_id");

-- AddForeignKey: groupIdに外部キー制約を追加
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
