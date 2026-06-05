"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { type AssessmentItemInput, createEntrySchema } from "@/app/libs/schemas/entry";
import { parseAssessmentItems } from "@/app/libs/entryItems";
import { Prisma } from "@prisma/client";
import { calculateSessionScore, normalizeItem } from "@/lib/sessionScoring";
import { revalidatePath } from "next/cache";

export async function createEntry(formData: FormData) {
  // 1. Auth
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const clientId = formData.get("clientId")?.toString();

  if (!clientId) {
    return { ok: false, reason: "missing_client" as const };
  }

  // 2. Normalize date to "today" (midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const raw = {
      clientId,
      note: formData.get("note")?.toString() ?? "",
      items: parseAssessmentItems(formData.get("items")),
    };

    const parsed = createEntrySchema.safeParse(raw);
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

    const itemsWithGoals = await ensureGoalDefinitions(
      parsed.data.clientId,
      session.providerId,
      parsed.data.items
    );

    if (itemsWithGoals.length === 0) {
      const existingEntry = await db.entry.findUnique({
        where: {
          providerId_clientId_date: {
            providerId: session.providerId,
            clientId: parsed.data.clientId,
            date: today,
          },
        },
        select: { id: true },
      });

      if (existingEntry) {
        const [entry, providerIds] = await Promise.all([
          db.entry.update({
            where: { id: existingEntry.id },
            data: {
              note: parsed.data.note || null,
            },
            select: { id: true },
          }),
          getAssignedProviderIds(parsed.data.clientId),
        ]);

        await resetEntryReads(entry.id, providerIds);

        revalidatePath("/dashboard");
        return { ok: true, entryId: entry.id };
      }
    }

    const goalIds = [
      ...new Set(
        itemsWithGoals
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
      itemsWithGoals.map((item) => ({
        metricType: item.metricType,
        score: item.score ?? null,
        rawValue: item.rawValue ?? null,
        goalDefinition: item.goalId ? goalDefinitionsById.get(item.goalId) ?? null : null,
      }))
    );

    const entryData = {
      note: parsed.data.note || null,
      finalScore,
      items:
        itemsWithGoals.length > 0
          ? {
              create: itemsWithGoals.map((item) => ({
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
            }
          : undefined,
    };

    const entry = await db.entry.upsert({
      where: {
        providerId_clientId_date: {
          providerId: session.providerId,
          clientId: parsed.data.clientId,
          date: today,
        },
      },
      create: {
        providerId: session.providerId,
        clientId: parsed.data.clientId,
        date: today,
        ...entryData,
      },
      update: {
        ...entryData,
        items: {
          deleteMany: {},
          ...(entryData.items ?? {}),
        },
      },
      select: { id: true },
    });

    await Promise.all([
      updateMasteredGoals(parsed.data.clientId, session.providerId, goalIds),
      getAssignedProviderIds(parsed.data.clientId).then((providerIds) =>
        resetEntryReads(entry.id, providerIds)
      ),
    ]);

    revalidatePath("/dashboard");
    return { ok: true, entryId: entry.id };
  } catch (error) {
    // Keep the response stable if a concurrent save hits the same daily entry.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "already_submitted" as const };
    }

    throw error;
  }
}

async function getAssignedProviderIds(clientId: string) {
  const providerClients = await db.providerClient.findMany({
    where: { clientId },
    select: { providerId: true },
  });

  return providerClients.map((pc) => pc.providerId);
}

async function resetEntryReads(entryId: string, providerIds: string[]) {
  if (providerIds.length === 0) {
    return;
  }

  // A submitted or updated note is unread for every assigned provider,
  // including the author, until each person opens it.
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

async function ensureGoalDefinitions(
  clientId: string,
  providerId: string,
  items: AssessmentItemInput[]
) {
  const itemsWithGoals: AssessmentItemInput[] = [];

  for (const item of items) {
    if (item.goalId) {
      itemsWithGoals.push(item);
      continue;
    }

    const existingGoal = await db.goalDefinition.findFirst({
      where: {
        clientId,
        providerId,
        target: item.target,
        goal: item.goal,
        metricType: item.metricType,
        isActive: true,
        isMastered: false,
      },
      select: {
        id: true,
      },
    });

    if (existingGoal) {
      itemsWithGoals.push({ ...item, goalId: existingGoal.id });
      continue;
    }

    const goalDefinition = await db.goalDefinition.create({
      data: {
        clientId,
        providerId,
        target: item.target,
        goal: item.goal,
        metricType: item.metricType,
        domain: item.domain ?? null,
      },
      select: {
        id: true,
      },
    });

    itemsWithGoals.push({ ...item, goalId: goalDefinition.id });
  }

  return itemsWithGoals;
}

async function updateMasteredGoals(
  clientId: string,
  providerId: string,
  goalIds: string[]
) {
  if (goalIds.length === 0) {
    return;
  }

  const goals = await db.goalDefinition.findMany({
    where: {
      id: { in: goalIds },
      clientId,
      providerId,
      isActive: true,
      isMastered: false,
    },
    select: {
      id: true,
      metricType: true,
      targetValue: true,
      comparison: true,
      weight: true,
      items: {
        orderBy: {
          entry: {
            date: "desc",
          },
        },
        take: 3,
        select: {
          metricType: true,
          score: true,
          rawValue: true,
        },
      },
    },
  });

  for (const goal of goals) {
    if (goal.items.length < 3) {
      continue;
    }

    const lastThreeSuccesses = goal.items.map((item) =>
      normalizeItem(
        {
          metricType: item.metricType,
          score: item.score,
          rawValue: item.rawValue,
        },
        goal
      )
    );

    if (
      lastThreeSuccesses.length === 3 &&
      lastThreeSuccesses.every((success) => success !== null && success >= 0.85)
    ) {
      await db.goalDefinition.update({
        where: {
          id: goal.id,
        },
        data: {
          isActive: false,
          isMastered: true,
        },
      });
    }
  }
}
