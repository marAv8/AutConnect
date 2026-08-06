"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EntryKind, EntryVisibility } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ensureEntryRevision } from "@/app/libs/entryRevision";

export async function updateEntryVisibility(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (session.role !== "Supervisor") {
    return { ok: false, reason: "forbidden" as const };
  }

  const clientId = formData.get("clientId")?.toString();
  const kindValue = formData.get("kind")?.toString();
  const visibilityValue = formData.get("visibility")?.toString();
  const kind =
    kindValue === EntryKind.SupervisorObservation ||
    kindValue === EntryKind.ClinicalNote
      ? kindValue
      : null;
  const visibility =
    visibilityValue === EntryVisibility.Private ||
    visibilityValue === EntryVisibility.Shared
      ? visibilityValue
      : null;

  if (!clientId || !kind || !visibility) {
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
    select: { id: true, status: true, completedAt: true, visibility: true },
  });

  if (!entry) {
    return { ok: false, reason: "missing_entry" as const };
  }

  const providerIds =
    visibility === EntryVisibility.Shared
      ? await getAssignedProviderIds(clientId)
      : [];

  if (entry.visibility !== visibility && entry.status === "COMPLETED") {
    await db.$transaction(async (tx) => {
      await ensureEntryRevision(
        tx,
        entry.id,
        session.providerId,
        entry.completedAt ?? undefined
      );
      await tx.entry.update({
        where: { id: entry.id },
        data: { visibility },
      });
      await ensureEntryRevision(tx, entry.id, session.providerId);
    });
  } else {
    await db.entry.update({
      where: { id: entry.id },
      data: { visibility },
    });
  }
  await resetEntryReads(entry.id, providerIds, visibility);

  revalidatePath("/dashboard");
  return { ok: true, entryId: entry.id, visibility };
}

async function getAssignedProviderIds(clientId: string) {
  const providerClients = await db.providerClient.findMany({
    where: { clientId },
    select: { providerId: true },
  });

  return providerClients.map((pc) => pc.providerId);
}

async function resetEntryReads(
  entryId: string,
  providerIds: string[],
  visibility: EntryVisibility
) {
  if (visibility === EntryVisibility.Private) {
    await db.entryRead.deleteMany({
      where: { entryId },
    });
    return;
  }

  if (providerIds.length === 0) {
    return;
  }

  await db.$transaction([
    db.entryRead.deleteMany({
      where: {
        entryId,
        providerId: {
          in: providerIds,
        },
      },
    }),
    db.entryRead.createMany({
      data: providerIds.map((providerId) => ({
        entryId,
        providerId,
        readAt: null,
      })),
    }),
  ]);
}
