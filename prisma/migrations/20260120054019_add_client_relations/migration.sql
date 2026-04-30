/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `Provider` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Provider" DROP COLUMN "passwordHash";

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderClient" (
    "providerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "ProviderClient_pkey" PRIMARY KEY ("providerId","clientId")
);

-- AddForeignKey
ALTER TABLE "public"."ProviderClient" ADD CONSTRAINT "ProviderClient_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderClient" ADD CONSTRAINT "ProviderClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
