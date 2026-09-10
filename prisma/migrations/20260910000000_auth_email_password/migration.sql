-- Better Auth identity fields on the existing application user table.
ALTER TABLE "User"
    ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "image" TEXT;

-- Better Auth credential accounts and server-side sessions.
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

ALTER TABLE "auth_accounts"
    ADD CONSTRAINT "auth_accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

ALTER TABLE "auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");
