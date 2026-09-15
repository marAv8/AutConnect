"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EntryKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { syncEntryReadsAfterAuthorSave } from "@/app/libs/entryReadState";

type AbcRowInput = {
  antecedent?: unknown;
  behavior?: unknown;
  consequence?: unknown;
};

const abcDataRoles = new Set([
  "Supervisor",
  "BehaviorTherapist",
  "Educator",
  "Caregiver",
]);

export async function createAbcData(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!abcDataRoles.has(session.role)) {
    return { ok: false, reason: "forbidden" as const };
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
    select: {
      id: true,
    },
  });

  if (!assignedClient) {
    return { ok: false, reason: "missing_client" as const };
  }

  const rows = parseAbcRows(formData.get("rows"));
  if (rows.length === 0) {
    return { ok: false, reason: "invalid_data" as const };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entry = await db.entry.upsert({
    where: {
      providerId_clientId_date_kind: {
        providerId: session.providerId,
        clientId,
        date: today,
        kind: EntryKind.SessionNote,
      },
    },
    create: {
      providerId: session.providerId,
      clientId,
      date: today,
      kind: EntryKind.SessionNote,
      status: "IN_PROGRESS",
      completedAt: null,
      clinicalReflection: null,
      abcObservations: {
        create: rows,
      },
    },
    update: {
      status: "IN_PROGRESS",
      completedAt: null,
      clinicalReflection: null,
      abcObservations: {
        create: rows,
      },
    },
    select: {
      id: true,
    },
  });

  const providerIds = await getAssignedProviderIds(clientId);

  await syncEntryReadsAfterAuthorSave({
    entryId: entry.id,
    authorProviderId: session.providerId,
    assignedProviderIds: providerIds,
  });

  revalidatePath("/dashboard");
  return { ok: true as const, entryId: entry.id, status: "IN_PROGRESS" as const };
}

function parseAbcRows(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((row) => normalizeAbcRow(row as AbcRowInput))
      .filter((row): row is NonNullable<ReturnType<typeof normalizeAbcRow>> => row !== null);
  } catch {
    return [];
  }
}

function normalizeAbcRow(row: AbcRowInput) {
  const antecedent = stringValue(row.antecedent);
  const behavior = stringValue(row.behavior);
  const consequence = stringValue(row.consequence);

  if (!antecedent || !behavior || !consequence) {
    return null;
  }

  return {
    antecedent,
    behavior,
    consequence,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getAssignedProviderIds(clientId: string) {
  const providerClients = await db.providerClient.findMany({
    where: { clientId, revokedAt: null },
    select: { providerId: true },
  });

  return providerClients.map((pc) => pc.providerId);
}
