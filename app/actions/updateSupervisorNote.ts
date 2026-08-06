"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EntryKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ensureEntryRevision } from "@/app/libs/entryRevision";

export async function updateSupervisorNote(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (session.role !== "Supervisor") {
    return { ok: false, reason: "forbidden" as const };
  }

  const clientId = formData.get("clientId")?.toString();
  const note = formData.get("note")?.toString();

  if (!clientId) {
    return { ok: false, reason: "missing_client" as const };
  }

  if (!note) {
    return { ok: false, reason: "missing_note" as const };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingEntry = await db.entry.findUnique({
    where: {
      providerId_clientId_date_kind: {
        providerId: session.providerId,
        clientId,
        date: today,
        kind: EntryKind.SessionNote,
      },
    },
    select: { id: true, status: true, completedAt: true },
  });

  if (!existingEntry) {
    return { ok: false, reason: "missing_entry" as const };
  }

  if (existingEntry.status === "COMPLETED") {
    await db.$transaction(async (tx) => {
      await ensureEntryRevision(
        tx,
        existingEntry.id,
        session.providerId,
        existingEntry.completedAt ?? undefined
      );
      await tx.entry.update({
        where: { id: existingEntry.id },
        data: { note },
      });
      await ensureEntryRevision(tx, existingEntry.id, session.providerId);
    });
  } else {
    await db.entry.update({
      where: { id: existingEntry.id },
      data: { note },
    });
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
