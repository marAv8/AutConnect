-- CreateTable
CREATE TABLE "public"."Entry" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "q1" INTEGER NOT NULL,
    "q2" INTEGER NOT NULL,
    "q3" INTEGER NOT NULL,
    "q4" INTEGER NOT NULL,
    "q5" INTEGER NOT NULL,
    "q6" INTEGER NOT NULL,
    "q7" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EntryRead" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "EntryRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entry_providerId_clientId_date_key" ON "public"."Entry"("providerId", "clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EntryRead_entryId_providerId_key" ON "public"."EntryRead"("entryId", "providerId");

-- AddForeignKey
ALTER TABLE "public"."Entry" ADD CONSTRAINT "Entry_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Entry" ADD CONSTRAINT "Entry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EntryRead" ADD CONSTRAINT "EntryRead_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EntryRead" ADD CONSTRAINT "EntryRead_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
