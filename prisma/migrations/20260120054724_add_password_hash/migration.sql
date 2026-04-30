/*
  Warnings:

  - Added the required column `passwordHash` to the `Provider` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Provider" ADD COLUMN     "passwordHash" TEXT NOT NULL;
