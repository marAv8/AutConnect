"use server";

import { generateClinicalHandoffValidation } from "@/app/api/aiGateway";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EntryVisibility } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function completeSessionNote(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const clientId = formData.get("clientId")?.toString();
  if (!clientId) {
    return { ok: false, reason: "missing_client" as const };
  }

  const assignedClient = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
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
    },
  });

  if (entries.length === 0) {
    return { ok: false, reason: "no_saved_sections" as const };
  }

  const completedAt = new Date();
  await db.entry.updateMany({
    where: {
      id: {
        in: entries.map((entry) => entry.id),
      },
    },
    data: {
      status: "COMPLETED",
      completedAt,
    },
  });

  const providerIds = await getAssignedProviderIds(clientId);
  await Promise.all(
    entries.map(async (entry) => {
      const { legacyReflection } = await generateClinicalHandoffValidation(entry.id);
      await Promise.all([
        db.entry.update({
          where: { id: entry.id },
          data: { clinicalReflection: legacyReflection },
        }),
        resetEntryReads(entry.id, providerIds, entry.visibility),
      ]);
    })
  );

  revalidatePath("/dashboard");
  return {
    ok: true as const,
    completedEntryIds: entries.map((entry) => entry.id),
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
    where: { clientId },
    select: { providerId: true },
  });

  return providerClients.map((pc) => pc.providerId);
}

async function resetEntryReads(
  entryId: string,
  providerIds: string[],
  visibility: EntryVisibility = EntryVisibility.Shared
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
