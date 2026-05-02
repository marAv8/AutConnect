ALTER TABLE "Provider" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "providerRole" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "authType" TEXT;

ALTER TABLE "Provider" ALTER COLUMN "authType" SET DEFAULT 'email';

UPDATE "Provider"
SET "authType" = 'email'
WHERE "authType" IS NULL;

ALTER TABLE "Provider" ALTER COLUMN "authType" SET NOT NULL;

UPDATE "Provider"
SET "providerRole" = "role"
WHERE "providerRole" IS NULL AND "role" <> '';
