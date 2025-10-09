-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_permission_attachments" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_permission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_attachments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

-- CreateIndex
CREATE INDEX "groups_name_idx" ON "groups"("name");

-- CreateIndex
CREATE INDEX "user_group_memberships_user_id_idx" ON "user_group_memberships"("user_id");

-- CreateIndex
CREATE INDEX "user_group_memberships_group_id_idx" ON "user_group_memberships"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_memberships_user_id_group_id_key" ON "user_group_memberships"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_category_idx" ON "permissions"("category");

-- CreateIndex
CREATE INDEX "permissions_name_idx" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "group_permission_attachments_group_id_idx" ON "group_permission_attachments"("group_id");

-- CreateIndex
CREATE INDEX "group_permission_attachments_permission_id_idx" ON "group_permission_attachments"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_permission_attachments_group_id_permission_id_key" ON "group_permission_attachments"("group_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_permission_attachments_user_id_idx" ON "user_permission_attachments"("user_id");

-- CreateIndex
CREATE INDEX "user_permission_attachments_permission_id_idx" ON "user_permission_attachments"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_attachments_user_id_permission_id_key" ON "user_permission_attachments"("user_id", "permission_id");

-- AddForeignKey
ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_permission_attachments" ADD CONSTRAINT "group_permission_attachments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_permission_attachments" ADD CONSTRAINT "group_permission_attachments_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_attachments" ADD CONSTRAINT "user_permission_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_attachments" ADD CONSTRAINT "user_permission_attachments_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
