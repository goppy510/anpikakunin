-- CreateTable
CREATE TABLE "dmdata_oauth_tokens" (
    "id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "dpop_keypair" JSONB,
    "code_verifier" TEXT,
    "state" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dmdata_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dmdata_oauth_tokens_refresh_token_key" ON "dmdata_oauth_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "dmdata_oauth_tokens_refresh_token_idx" ON "dmdata_oauth_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "dmdata_oauth_tokens_expires_at_idx" ON "dmdata_oauth_tokens"("expires_at");
