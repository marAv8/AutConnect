import {
  EntryStatus,
  GoalMasteryBasis,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  evaluateMasteryCandidate,
  type MasteryCandidateMetricType,
  type MasteryCandidateResult,
} from "./masteryCandidatePolicy";
import {
  activateCorrectedGoal,
  masteryPersistenceAction,
} from "./masteryPersistenceState";

type ReconcileMasteryInput = {
  clientId: string;
  providerId: string;
  goalIds: string[];
};

export type MasteryReconciliation = {
  goalId: string;
  result: MasteryCandidateResult;
  persisted: boolean;
};

/**
 * Reconciles only automatic POLICY_V1 mastery. Legacy mastery is never
 * reclassified. When a correction invalidates POLICY_V1 evidence, the goal is
 * reopened and its automatic mastery provenance is cleared.
 */
export async function reconcileMasteryForCompletedGoals({
  clientId,
  providerId,
  goalIds,
}: ReconcileMasteryInput): Promise<MasteryReconciliation[]> {
  const uniqueGoalIds = [...new Set(goalIds.filter(Boolean))];
  if (uniqueGoalIds.length === 0) return [];

  const goals = await db.goalDefinition.findMany({
    where: {
      id: { in: uniqueGoalIds },
      clientId,
      providerId,
      OR: [
        {
          isActive: true,
          isMastered: false,
          masteryBasis: null,
        },
        {
          masteryBasis: GoalMasteryBasis.POLICY_V1,
        },
      ],
    },
    select: {
      id: true,
      providerId: true,
      target: true,
      goal: true,
      metricType: true,
      targetValue: true,
      comparison: true,
      masteryThreshold: true,
      masteryRequiredSessions: true,
      isMastered: true,
      masteryBasis: true,
      masteryEvidenceEntryIds: true,
      items: {
        where: {
          entry: {
            status: EntryStatus.COMPLETED,
          },
        },
        select: {
          metricType: true,
          target: true,
          goal: true,
          rawValue: true,
          score: true,
          entry: {
            select: {
              id: true,
              providerId: true,
              date: true,
              completedAt: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const reconciliations: MasteryReconciliation[] = [];
  for (const goal of goals) {
    const metadataConsistent = goal.items.every(
      (item) =>
        item.metricType === goal.metricType &&
        normalizeIdentity(item.target) === normalizeIdentity(goal.target) &&
        normalizeIdentity(item.goal) === normalizeIdentity(goal.goal)
    );
    const sessions = goal.items.map((item) => ({
      entryId: item.entry.id,
      occurredAt: item.entry.date.toISOString(),
      completedAt: item.entry.completedAt?.toISOString() ?? null,
      status: item.entry.status,
      providerId: item.entry.providerId,
      goalId: goal.id,
      metricType: item.metricType as MasteryCandidateMetricType,
      rawValue: item.rawValue,
      score: item.score,
      configuration: {
        percentageMasteryThreshold: goal.masteryThreshold,
        targetValue: goal.targetValue,
        comparison: goal.comparison,
        configuredMetricType: goal.metricType as MasteryCandidateMetricType,
        metadataConsistent,
      },
    }));
    const result = evaluateMasteryCandidate({
      providerId: goal.providerId,
      goalId: goal.id,
      metricType: goal.metricType as MasteryCandidateMetricType,
      percentageMasteryThreshold: goal.masteryThreshold,
      targetValue: goal.targetValue,
      comparison: goal.comparison,
      requiredConsecutiveSessions: goal.masteryRequiredSessions,
      metadataConsistent,
      sessions,
    });

    let persisted = false;
    const action = masteryPersistenceAction({
      isMastered: goal.isMastered,
      masteryBasis: goal.masteryBasis,
      candidateStatus: result.status,
    });
    if (action === "mark") {
      const masteredAt = latestEvidenceCompletion(
        result.evidenceEntryIds,
        sessions
      );
      const update = await db.goalDefinition.updateMany({
        where: {
          id: goal.id,
          clientId,
          providerId,
          OR: [
            {
              isActive: true,
              isMastered: false,
              masteryBasis: null,
            },
            {
              masteryBasis: GoalMasteryBasis.POLICY_V1,
            },
          ],
        },
        data: {
          isActive: false,
          isMastered: true,
          masteryBasis: GoalMasteryBasis.POLICY_V1,
          masteredAt,
          masteryEvidenceEntryIds:
            result.evidenceEntryIds as Prisma.InputJsonValue,
        },
      });
      persisted = update.count === 1;
    } else if (action === "clear") {
      const activeReplacement = await db.goalDefinition.findFirst({
        where: {
          id: { not: goal.id },
          clientId,
          providerId,
          target: goal.target,
          goal: goal.goal,
          metricType: goal.metricType,
          isActive: true,
          isMastered: false,
        },
        select: { id: true },
      });
      const update = await db.goalDefinition.updateMany({
        where: {
          id: goal.id,
          clientId,
          providerId,
          masteryBasis: GoalMasteryBasis.POLICY_V1,
        },
        data: {
          isActive: activateCorrectedGoal(Boolean(activeReplacement)),
          isMastered: false,
          masteryBasis: null,
          masteredAt: null,
          masteryEvidenceEntryIds: Prisma.DbNull,
          masteryRevokedAt: new Date(),
          masteryRevokedEvidenceEntryIds:
            goal.masteryEvidenceEntryIds === null
              ? Prisma.DbNull
              : (goal.masteryEvidenceEntryIds as Prisma.InputJsonValue),
        },
      });
      persisted = update.count === 1;
    }

    reconciliations.push({ goalId: goal.id, result, persisted });
  }

  return reconciliations;
}

function latestEvidenceCompletion(
  evidenceEntryIds: string[],
  sessions: Array<{
    entryId: string;
    occurredAt: string;
    completedAt: string | null;
  }>
) {
  const evidenceIds = new Set(evidenceEntryIds);
  const timestamps = sessions
    .filter((session) => evidenceIds.has(session.entryId))
    .map((session) =>
      Date.parse(session.completedAt ?? session.occurredAt)
    )
    .filter(Number.isFinite);
  return timestamps.length
    ? new Date(Math.max(...timestamps))
    : new Date();
}

function normalizeIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
