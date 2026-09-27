"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { type AssessmentItemInput, createEntrySchema } from "@/app/libs/schemas/entry";
import { parseAssessmentItems } from "@/app/libs/entryItems";
import { EntryKind, EntryVisibility, Prisma } from "@prisma/client";
import { calculateSessionScore } from "@/lib/sessionScoring";
import { ensureEntryRevision } from "@/app/libs/entryRevision";
import { statusAfterEntrySave } from "@/app/libs/entryLifecycle";
import { reconcileMasteryForCompletedGoals } from "@/app/libs/mastery/masteryPersistence";
import { syncEntryReadsAfterAuthorSave } from "@/app/libs/entryReadState";
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

  // 2. Normalize date to "today" (midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const kindValue = formData.get("kind")?.toString() ?? EntryKind.SessionNote;
    const defaultVisibility =
      kindValue === EntryKind.SupervisorObservation ||
      kindValue === EntryKind.ClinicalNote
        ? EntryVisibility.Private
        : EntryVisibility.Shared;
    const raw = {
      clientId,
      kind: kindValue,
      visibility: formData.get("visibility")?.toString() ?? defaultVisibility,
      note: formData.get("note")?.toString() ?? "",
      items: parseAssessmentItems(formData.get("items")),
    };

    const parsed = createEntrySchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_data" as const };
    }
    const canSubmitCommentOnly =
      session.role === "Supervisor" || session.role === "Caregiver";
    const isCaretakerContext =
      parsed.data.kind === EntryKind.MorningContext ||
      parsed.data.kind === EntryKind.EveningContext;
    const isSupervisorDocumentation =
      parsed.data.kind === EntryKind.SupervisorObservation ||
      parsed.data.kind === EntryKind.ClinicalNote;
    const visibility = isSupervisorDocumentation
      ? parsed.data.visibility
      : EntryVisibility.Shared;
    const isSensoryObservation =
      parsed.data.kind === EntryKind.SensoryObservation;
    const isSpeechProgress =
      parsed.data.kind === EntryKind.SpeechProgress;
    const isCommunicationObservation =
      parsed.data.kind === EntryKind.CommunicationObservation;
    if (isCaretakerContext && session.role !== "Caregiver") {
      return { ok: false, reason: "forbidden" as const };
    }
    if (isSupervisorDocumentation && session.role !== "Supervisor") {
      return { ok: false, reason: "forbidden" as const };
    }
    if (isSensoryObservation && session.role !== "OccupationalTherapist") {
      return { ok: false, reason: "forbidden" as const };
    }
    if (
      (isSpeechProgress || isCommunicationObservation) &&
      session.role !== "SpeechPathologist"
    ) {
      return { ok: false, reason: "forbidden" as const };
    }
    if (
      !isCaretakerContext &&
      !isSupervisorDocumentation &&
      !isSensoryObservation &&
      !isCommunicationObservation &&
      parsed.data.items.length === 0 &&
      (!canSubmitCommentOnly || parsed.data.note.trim().length === 0)
    ) {
      return { ok: false, reason: "invalid_data" as const };
    }

    const shouldStoreContextData =
      isCaretakerContext ||
      isSupervisorDocumentation ||
      isSensoryObservation ||
      isCommunicationObservation;
    const contextData = shouldStoreContextData
      ? parseContextData(formData.get("contextData")) ?? Prisma.JsonNull
      : undefined;
    const submittedGoalIds = uniqueGoalIds(parsed.data.items);
    if (
      !shouldStoreContextData &&
      !(await goalIdsAreAllowedForEntry(
        submittedGoalIds,
        parsed.data.clientId,
        session.providerId,
        today,
        parsed.data.kind
      ))
    ) {
      return { ok: false, reason: "invalid_data" as const };
    }
    const itemsWithGoals = shouldStoreContextData
      ? []
      : await ensureGoalDefinitions(
          parsed.data.clientId,
          session.providerId,
          parsed.data.items
        );

    if (!shouldStoreContextData && itemsWithGoals.length === 0) {
      const existingEntry = await db.entry.findUnique({
        where: {
          providerId_clientId_date_kind: {
            providerId: session.providerId,
            clientId: parsed.data.clientId,
            date: today,
            kind: parsed.data.kind,
          },
        },
        select: {
          id: true,
          status: true,
          completedAt: true,
          items: {
            select: { goalId: true },
          },
          _count: {
            select: {
              revisions: true,
            },
          },
        },
      });

      if (existingEntry) {
        const nextStatus = statusAfterEntrySave(
          existingEntry.status,
          existingEntry._count.revisions
        );
        const isCompletedUpdate = nextStatus === "COMPLETED";
        const nextCompletedAt = isCompletedUpdate ? new Date() : null;
        const [entry, providerIds] = await Promise.all([
          db.$transaction(async (tx) => {
            if (isCompletedUpdate) {
              await ensureEntryRevision(
                tx,
                existingEntry.id,
                session.providerId,
                existingEntry.completedAt ?? undefined
              );
            }
            const updatedEntry = await tx.entry.update({
              where: { id: existingEntry.id },
              data: {
                note: parsed.data.note || null,
                visibility,
                status: nextStatus,
                completedAt: nextCompletedAt,
                clinicalReflection: null,
              },
              select: { id: true },
            });
            if (isCompletedUpdate) {
              await ensureEntryRevision(
                tx,
                existingEntry.id,
                session.providerId,
                nextCompletedAt ?? undefined
              );
            }
            return updatedEntry;
          }),
          getAssignedProviderIds(parsed.data.clientId),
        ]);

        await syncEntryReadsAfterAuthorSave({
          entryId: entry.id,
          authorProviderId: session.providerId,
          assignedProviderIds: providerIds,
          visibility,
          reactivateForTeammates: isCompletedUpdate,
        });

        if (isCompletedUpdate) {
          await reconcileMasteryForCompletedGoals({
            clientId: parsed.data.clientId,
            providerId: session.providerId,
            goalIds: existingEntry.items
              .map((item) => item.goalId)
              .filter((goalId): goalId is string => Boolean(goalId)),
          });
        }

        revalidatePath("/dashboard");
        return { ok: true, entryId: entry.id, visibility, status: nextStatus };
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

    const existingEntry = await db.entry.findUnique({
      where: {
        providerId_clientId_date_kind: {
          providerId: session.providerId,
          clientId: parsed.data.clientId,
          date: today,
          kind: parsed.data.kind,
        },
      },
      select: {
        id: true,
        status: true,
        completedAt: true,
        items: {
          select: { goalId: true },
        },
        _count: {
          select: {
            revisions: true,
          },
        },
      },
    });
    const nextStatus = statusAfterEntrySave(
      existingEntry?.status,
      existingEntry?._count.revisions ?? 0,
      isCaretakerContext
    );
    const isCompletedUpdate = nextStatus === "COMPLETED";
    const nextCompletedAt = isCompletedUpdate ? new Date() : null;

    const entryData = {
      note: parsed.data.note || null,
      visibility,
      status: nextStatus,
      completedAt: nextCompletedAt,
      clinicalReflection: null,
      finalScore: shouldStoreContextData ? null : finalScore,
      contextData: shouldStoreContextData ? contextData : undefined,
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
                observation: item.observation ?? null,
              })),
            }
          : undefined,
    };

    const entry = await db.$transaction(async (tx) => {
      if (existingEntry && isCompletedUpdate) {
        await ensureEntryRevision(
          tx,
          existingEntry.id,
          session.providerId,
          existingEntry.completedAt ?? undefined
        );
      }

      const updatedEntry = await tx.entry.upsert({
        where: {
          providerId_clientId_date_kind: {
            providerId: session.providerId,
            clientId: parsed.data.clientId,
            date: today,
            kind: parsed.data.kind,
          },
        },
        create: {
          providerId: session.providerId,
          clientId: parsed.data.clientId,
          date: today,
          kind: parsed.data.kind,
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
      if (existingEntry && isCompletedUpdate) {
        await ensureEntryRevision(
          tx,
          existingEntry.id,
          session.providerId,
          nextCompletedAt ?? undefined
        );
      }
      return updatedEntry;
    });

    if (!shouldStoreContextData && isCompletedUpdate) {
      await reconcileMasteryForCompletedGoals({
        clientId: parsed.data.clientId,
        providerId: session.providerId,
        goalIds: [
          ...goalIds,
          ...(existingEntry?.items
            .map((item) => item.goalId)
            .filter((goalId): goalId is string => Boolean(goalId)) ?? []),
        ],
      });
    }
    const providerIds = await getAssignedProviderIds(parsed.data.clientId);
    await syncEntryReadsAfterAuthorSave({
      entryId: entry.id,
      authorProviderId: session.providerId,
      assignedProviderIds: providerIds,
      visibility,
      reactivateForTeammates: isCompletedUpdate,
    });

    revalidatePath("/dashboard");
    return { ok: true, entryId: entry.id, visibility, status: nextStatus };
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

function parseContextData(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

async function getAssignedProviderIds(clientId: string) {
  const providerClients = await db.providerClient.findMany({
    where: { clientId, revokedAt: null },
    select: { providerId: true },
  });

  return providerClients.map((pc) => pc.providerId);
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

function uniqueGoalIds(items: AssessmentItemInput[]) {
  return [
    ...new Set(
      items
        .map((item) => item.goalId)
        .filter((goalId): goalId is string => Boolean(goalId))
    ),
  ];
}

async function goalIdsAreAllowedForEntry(
  goalIds: string[],
  clientId: string,
  providerId: string,
  date: Date,
  kind: EntryKind
) {
  if (goalIds.length === 0) return true;

  const scopedGoals = await db.goalDefinition.findMany({
    where: {
      id: { in: goalIds },
      clientId,
      providerId,
    },
    select: {
      id: true,
      isActive: true,
      isMastered: true,
    },
  });

  if (scopedGoals.length !== goalIds.length) return false;

  const historicalGoalIds = scopedGoals
    .filter((goal) => !goal.isActive || goal.isMastered)
    .map((goal) => goal.id);

  if (historicalGoalIds.length === 0) return true;

  const existingEntry = await db.entry.findUnique({
    where: {
      providerId_clientId_date_kind: {
        providerId,
        clientId,
        date,
        kind,
      },
    },
    select: {
      items: {
        where: { goalId: { in: historicalGoalIds } },
        select: { goalId: true },
      },
    },
  });
  const existingGoalIds = new Set(
    existingEntry?.items
      .map((item) => item.goalId)
      .filter((goalId): goalId is string => Boolean(goalId)) ?? []
  );

  return historicalGoalIds.every((goalId) => existingGoalIds.has(goalId));
}
