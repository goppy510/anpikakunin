-- AlterTable
ALTER TABLE "slack_workspaces" ALTER COLUMN "bot_token_ciphertext" SET DATA TYPE TEXT,
ALTER COLUMN "bot_token_iv" SET DATA TYPE TEXT,
ALTER COLUMN "bot_token_tag" SET DATA TYPE TEXT;
