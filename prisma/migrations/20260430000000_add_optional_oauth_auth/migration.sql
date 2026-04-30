ALTER TABLE "Provider" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "Provider" ADD COLUMN "providerRole" TEXT;
ALTER TABLE "Provider" ADD COLUMN "authType" TEXT NOT NULL DEFAULT 'email';

UPDATE "Provider"
SET "providerRole" = "role"
WHERE "providerRole" IS NULL;
