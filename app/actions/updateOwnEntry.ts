"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createEntrySchema } from "@/app/libs/schemas/entry";
import { parseAssessmentItems } from "@/app/libs/entryItems";
import { calculateSessionScore } from "@/lib/sessionScoring";
import { ensureEntryRevision } from "@/app/libs/entryRevision";
import { statusAfterEntrySave } from "@/app/libs/entryLifecycle";
import { reconcileMasteryForCompletedGoals } from "@/app/libs/mastery/masteryPersistence";
import { syncEntryReadsAfterAuthorSave } from "@/app/libs/entryReadState";
import { EntryKind, EntryVisibility, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateOwnEntry(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const clientId = formData.get("clientId")?.toString();
  const kindValue = formData.get("kind")?.toString() ?? EntryKind.SessionNote;
  const kind =
    kindValue === EntryKind.MorningContext ||
    kindValue === EntryKind.EveningContext ||
    kindValue === EntryKind.SupervisorObservation ||
    kindValue === EntryKind.ClinicalNote ||
    kindValue === EntryKind.SensoryObservation ||
    kindValue === EntryKind.SpeechProgress ||
    kindValue === EntryKind.CommunicationObservation
      ? kindValue
      : EntryKind.SessionNote;
  const note = formData.get("note")?.toString();

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

  const existingEntry = await db.entry.findUnique({
    where: {
      providerId_clientId_date_kind: {
        providerId: session.providerId,
        clientId,
        date: today,
        kind,
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

  if (!existingEntry) {
    return { ok: false, reason: "missing_entry" as const };
  }

  const providerClients = await db.providerClient.findMany({
    where: { clientId, revokedAt: null },
    select: { providerId: true },
  });

  const providerIds = providerClients.map((pc) => pc.providerId);

  const parsed = createEntrySchema.safeParse({
    clientId,
    kind,
    visibility:
      formData.get("visibility")?.toString() ??
      (kind === EntryKind.SupervisorObservation || kind === EntryKind.ClinicalNote
        ? EntryVisibility.Private
        : EntryVisibility.Shared),
    note: note ?? "",
    items: parseAssessmentItems(formData.get("items")),
  });

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
  const nextStatus = statusAfterEntrySave(
    existingEntry.status,
    existingEntry._count.revisions,
    isCaretakerContext
  );
  const isCompletedUpdate = nextStatus === "COMPLETED";
  const nextCompletedAt = isCompletedUpdate ? new Date() : null;

  if (shouldStoreContextData || parsed.data.items.length === 0) {
    await db.$transaction(async (tx) => {
      if (isCompletedUpdate) {
        await ensureEntryRevision(
          tx,
          existingEntry.id,
          session.providerId,
          existingEntry.completedAt ?? undefined
        );
      }
      await tx.entry.update({
        where: { id: existingEntry.id },
        data: {
          note: parsed.data.note || null,
          visibility,
          status: nextStatus,
          completedAt: nextCompletedAt,
          clinicalReflection: null,
          contextData: shouldStoreContextData
            ? parseContextData(formData.get("contextData")) ?? Prisma.JsonNull
            : undefined,
        },
      });
      if (isCompletedUpdate) {
        await ensureEntryRevision(
          tx,
          existingEntry.id,
          session.providerId,
          nextCompletedAt ?? undefined
        );
      }
    });

    await syncEntryReadsAfterAuthorSave({
      entryId: existingEntry.id,
      authorProviderId: session.providerId,
      assignedProviderIds: providerIds,
      visibility,
      reactivateForTeammates: isCompletedUpdate,
    });

    revalidatePath("/dashboard");
    return { ok: true, status: nextStatus };
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
          providerId: session.providerId,
        },
        select: {
          id: true,
          isActive: true,
          isMastered: true,
          metricType: true,
          domain: true,
          targetValue: true,
          comparison: true,
          weight: true,
        },
      })
    : [];

  const existingGoalIds = new Set(
    existingEntry.items
      .map((item) => item.goalId)
      .filter((goalId): goalId is string => Boolean(goalId))
  );
  const hasInvalidGoalAssociation = goalDefinitions.some(
    (goalDefinition) =>
      (!goalDefinition.isActive || goalDefinition.isMastered) &&
      !existingGoalIds.has(goalDefinition.id)
  );

  if (goalDefinitions.length !== goalIds.length || hasInvalidGoalAssociation) {
    return { ok: false, reason: "invalid_data" as const };
  }

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

  await db.$transaction(async (tx) => {
    if (isCompletedUpdate) {
      await ensureEntryRevision(
        tx,
        existingEntry.id,
        session.providerId,
        existingEntry.completedAt ?? undefined
      );
    }
    await tx.entry.update({
      where: { id: existingEntry.id },
      data: {
        note: parsed.data.note || null,
        visibility,
        status: nextStatus,
        completedAt: nextCompletedAt,
        clinicalReflection: null,
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
            observation: item.observation ?? null,
          })),
        },
      },
    });
    if (isCompletedUpdate) {
      await ensureEntryRevision(
        tx,
        existingEntry.id,
        session.providerId,
        nextCompletedAt ?? undefined
      );
    }
  });

  if (isCompletedUpdate) {
    await reconcileMasteryForCompletedGoals({
      clientId,
      providerId: session.providerId,
      goalIds: [
        ...goalIds,
        ...existingEntry.items
          .map((item) => item.goalId)
          .filter((goalId): goalId is string => Boolean(goalId)),
      ],
    });
  }

  await syncEntryReadsAfterAuthorSave({
    entryId: existingEntry.id,
    authorProviderId: session.providerId,
    assignedProviderIds: providerIds,
    visibility,
    reactivateForTeammates: isCompletedUpdate,
  });

  revalidatePath("/dashboard");
  return { ok: true, status: nextStatus };
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
