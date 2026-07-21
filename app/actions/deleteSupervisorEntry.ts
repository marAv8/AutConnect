"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EntryKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function deleteSupervisorEntry(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (session.role !== "Supervisor") {
    return { ok: false, reason: "forbidden" as const };
  }

  const clientId = formData.get("clientId")?.toString();
  const kindValue = formData.get("kind")?.toString();
  const kind =
    kindValue === EntryKind.SupervisorObservation ||
    kindValue === EntryKind.ClinicalNote
      ? kindValue
      : null;

  if (!clientId || !kind) {
    return { ok: false, reason: "invalid_data" as const };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entry = await db.entry.findUnique({
    where: {
      providerId_clientId_date_kind: {
        providerId: session.providerId,
        clientId,
        date: today,
        kind,
      },
    },
    select: { id: true },
  });

  if (!entry) {
    return { ok: false, reason: "missing_entry" as const };
  }

  await db.entry.delete({
    where: { id: entry.id },
  });

  revalidatePath("/dashboard");
  return { ok: true, entryId: entry.id };
}
