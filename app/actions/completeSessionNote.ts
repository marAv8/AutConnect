"use server";

import { generateClinicalHandoffValidation } from "@/app/api/aiGateway";
import { ensureEntryRevision } from "@/app/libs/entryRevision";
import { reconcileMasteryForCompletedGoals } from "@/app/libs/mastery/masteryPersistence";
import { syncEntryReadsAfterAuthorSave } from "@/app/libs/entryReadState";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function completeSessionNote(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Caregiver context is shared as it is saved and never uses the clinical
  // provider completion workflow.
  if (session.role === "Caregiver") {
    return { ok: false, reason: "not_applicable" as const };
  }

  const clientId = formData.get("clientId")?.toString();
  if (!clientId) {
    return { ok: false, reason: "missing_client" as const };
  }

  const assignedClient = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      revokedAt: null,
    },
    select: { id: true },
  });

  if (!assignedClient) {
    return { ok: false, reason: "missing_client" as const };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries = await db.entry.findMany({
    where: {
      clientId,
      providerId: session.providerId,
      date: today,
      OR: meaningfulEntryWhere(),
    },
    select: {
      id: true,
      visibility: true,
      items: {
        select: { goalId: true },
      },
    },
  });

  if (entries.length === 0) {
    return { ok: false, reason: "no_saved_sections" as const };
  }

  const completedAt = new Date();
  const revisedEntryIds = await db.$transaction(async (tx) => {
    const revisedIds: string[] = [];

    for (const entry of entries) {
      await tx.entry.update({
        where: { id: entry.id },
        data: {
          status: "COMPLETED",
          completedAt,
        },
      });

      const revision = await ensureEntryRevision(
        tx,
        entry.id,
        session.providerId,
        completedAt
      );
      if (revision.created) {
        revisedIds.push(entry.id);
      }
    }

    return revisedIds;
  });

  await reconcileMasteryForCompletedGoals({
    clientId,
    providerId: session.providerId,
    goalIds: entries.flatMap((entry) =>
      entry.items
        .map((item) => item.goalId)
        .filter((goalId): goalId is string => Boolean(goalId))
    ),
  });

  const providerIds = await getAssignedProviderIds(clientId);
  await Promise.all(
    entries.map(async (entry) => {
      // Validate normalized clinical output when the provider finalizes the note.
      // The provider note remains the source of truth; no generated prose is stored on it.
      await generateClinicalHandoffValidation(entry.id);
      if (revisedEntryIds.includes(entry.id)) {
        await syncEntryReadsAfterAuthorSave({
          entryId: entry.id,
          authorProviderId: session.providerId,
          assignedProviderIds: providerIds,
          visibility: entry.visibility,
        });
      }
    })
  );

  revalidatePath("/dashboard");
  return {
    ok: true as const,
    completedEntryIds: revisedEntryIds,
  };
}

function meaningfulEntryWhere() {
  return [
    {
      note: {
        not: null,
      },
    },
    {
      items: {
        some: {},
      },
    },
    {
      abcObservations: {
        some: {},
      },
    },
  ];
}

async function getAssignedProviderIds(clientId: string) {
  const providerClients = await db.providerClient.findMany({
    where: { clientId, revokedAt: null },
    select: { providerId: true },
  });

  return providerClients.map((pc) => pc.providerId);
}
