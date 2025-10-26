-- AlterTable: Remove twoFactorEnabled from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_enabled";

-- CreateTable: passkeys
CREATE TABLE "passkeys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credential_id" BYTEA NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "device_name" TEXT,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: webauthn_challenges
CREATE TABLE "webauthn_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "challenge" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable: passkey_reset_tokens
CREATE TABLE "passkey_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "passkey_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");
CREATE INDEX "passkeys_user_id_idx" ON "passkeys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_challenges_challenge_key" ON "webauthn_challenges"("challenge");
CREATE INDEX "webauthn_challenges_user_id_idx" ON "webauthn_challenges"("user_id");
CREATE INDEX "webauthn_challenges_expires_at_idx" ON "webauthn_challenges"("expires_at");
CREATE INDEX "webauthn_challenges_challenge_idx" ON "webauthn_challenges"("challenge");

-- CreateIndex
CREATE UNIQUE INDEX "passkey_reset_tokens_token_key" ON "passkey_reset_tokens"("token");
CREATE INDEX "passkey_reset_tokens_token_idx" ON "passkey_reset_tokens"("token");
CREATE INDEX "passkey_reset_tokens_user_id_idx" ON "passkey_reset_tokens"("user_id");
CREATE INDEX "passkey_reset_tokens_expires_at_idx" ON "passkey_reset_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
