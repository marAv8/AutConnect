"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createEntrySchema } from "@/app/libs/schemas/entry";
import { parseAssessmentItems } from "@/app/libs/entryItems";
import { calculateSessionScore } from "@/lib/sessionScoring";
import { revalidatePath } from "next/cache";

export async function updateOwnEntry(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const clientId = formData.get("clientId")?.toString();
  const note = formData.get("note")?.toString();

  if (!clientId) {
    return { ok: false, reason: "missing_client" as const };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingEntry = await db.entry.findUnique({
    where: {
      providerId_clientId_date: {
        providerId: session.providerId,
        clientId,
        date: today,
      },
    },
    select: { id: true },
  });

  if (!existingEntry) {
    return { ok: false, reason: "missing_entry" as const };
  }

  const providerClients = await db.providerClient.findMany({
    where: { clientId },
    select: { providerId: true },
  });

  const providerIds = providerClients.map((pc) => pc.providerId);

  const parsed = createEntrySchema.safeParse({
    clientId,
    note: note ?? "",
    items: parseAssessmentItems(formData.get("items")),
  });

  if (!parsed.success) {
    return { ok: false, reason: "invalid_data" as const };
  }
  const canSubmitCommentOnly =
    session.role === "Supervisor" || session.role === "Caregiver";
  if (
    parsed.data.items.length === 0 &&
    (!canSubmitCommentOnly || parsed.data.note.trim().length === 0)
  ) {
    return { ok: false, reason: "invalid_data" as const };
  }

  if (parsed.data.items.length === 0) {
    await db.entry.update({
      where: { id: existingEntry.id },
      data: {
        note: parsed.data.note || null,
      },
    });

    if (providerIds.length > 0) {
      await db.entryRead.deleteMany({
        where: {
          entryId: existingEntry.id,
          providerId: {
            in: providerIds,
          },
        },
      });

      await db.entryRead.createMany({
        data: providerIds.map((providerId) => ({
          entryId: existingEntry.id,
          providerId,
          readAt: null,
        })),
      });
    }

    revalidatePath("/dashboard");
    return { ok: true };
  }

  const goalIds = [
    ...new Set(
      parsed.data.items
        .map((item) => item.goalId)
        .filter((goalId): goalId is string => Boolean(goalId))
    ),
  ];

  const goalDefinitions = goalIds.length
    ? await db.goalDefinition.findMany({
        where: {
          id: { in: goalIds },
          clientId: parsed.data.clientId,
        },
        select: {
          id: true,
          metricType: true,
          domain: true,
          targetValue: true,
          comparison: true,
          weight: true,
        },
      })
    : [];

  const goalDefinitionsById = new Map(
    goalDefinitions.map((goalDefinition) => [goalDefinition.id, goalDefinition])
  );

  const { finalScore } = calculateSessionScore(
    parsed.data.items.map((item) => ({
      metricType: item.metricType,
      score: item.score ?? null,
      rawValue: item.rawValue ?? null,
      goalDefinition: item.goalId ? goalDefinitionsById.get(item.goalId) ?? null : null,
    }))
  );

  await db.entry.update({
    where: { id: existingEntry.id },
    data: {
      note: parsed.data.note || null,
      finalScore,
      items: {
        deleteMany: {},
        create: parsed.data.items.map((item) => ({
          goalId: item.goalId ?? null,
          target: item.target,
          goal: item.goal,
          score: item.score ?? null,
          metricType: item.metricType,
          domain:
            item.domain ??
            (item.goalId ? goalDefinitionsById.get(item.goalId)?.domain ?? null : null),
          rawValue: item.rawValue ?? null,
          supportLevel: item.supportLevel ?? null,
        })),
      },
    },
  });

  if (providerIds.length > 0) {
    await db.entryRead.deleteMany({
      where: {
        entryId: existingEntry.id,
        providerId: {
          in: providerIds,
        },
      },
    });

    await db.entryRead.createMany({
      data: providerIds.map((providerId) => ({
        entryId: existingEntry.id,
        providerId,
        readAt: null,
      })),
    });
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
