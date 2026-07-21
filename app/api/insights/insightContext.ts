/**
 * Builds the supervisor's longitudinal clinical read model.
 * Unlike the daily client handoff, this module gathers multi-session evidence for
 * Insights questions about providers, goals, trends, ABC events, and context.
 */
import { MetricType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import type { ParsedInsightQuestion } from "./insightsEngine";
import type {
  InsightAbcEvent,
  InsightClinicalEvent,
  InsightContext,
} from "./insightContextTypes";
import {
  buildBehaviorRelationships,
  buildClientSignalScore,
  buildClinicalPicture,
  buildCollaborationMetrics,
  buildContinuityMetrics,
  buildDomainContributions,
  buildDomainRelationships,
  buildGoalRelationships,
  buildNormalizedSessionsWithSignals,
  buildPerformanceTrends,
  buildProviderDomainSeries,
  buildProviderGoalSeries,
  buildProviderOverlap,
  buildProviderRelationships,
  buildQuestionContributors,
  buildRelationshipMetrics,
  buildRelationshipSummary,
} from "./insightContextModel";

export type {
  InsightClinicalPictureKey,
  InsightContext,
  InsightDomainName,
  InsightMatchConfidence,
  InsightMatchType,
  InsightRelationshipDomain,
  InsightTrend,
  InsightTrendDirection,
} from "./insightContextTypes";

export async function buildInsightContext(
  clientId: string,
  parsed: ParsedInsightQuestion
): Promise<InsightContext | null> {
  const [client, providerAssignments, activeGoals, sessions, currentTeamFocus] =
    await Promise.all([
    db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        diagnosis: true,
      },
    }),
    db.providerClient.findMany({
      where: { clientId },
      orderBy: {
        provider: {
          firstName: "asc",
        },
      },
      select: {
        id: true,
        providerId: true,
        clientId: true,
        role: true,
        provider: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    }),
    db.goalDefinition.findMany({
      where: {
        clientId,
        isActive: true,
      },
      orderBy: [{ providerId: "asc" }, { weight: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        providerId: true,
        target: true,
        goal: true,
        metricType: true,
        domain: true,
        targetValue: true,
        comparison: true,
        weight: true,
        isMastered: true,
        provider: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
      db.entry.findMany({
      where: {
        clientId,
        OR: [
          {
            kind: {
              notIn: ["SupervisorObservation", "ClinicalNote"],
            },
          },
          {
            visibility: "Shared",
          },
        ],
        ...(parsed.providerRole
          ? {
              provider: {
                role: parsed.providerRole as Role,
              },
            }
          : {}),
        ...(parsed.dateRange
          ? {
              createdAt: {
                gte: parsed.dateRange.from,
                lt: parsed.dateRange.to,
              },
            }
          : {}),
        ...(parsed.metricType
          ? {
              items: {
                some: {
                  metricType: parsed.metricType as MetricType,
                },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        date: true,
        createdAt: true,
        note: true,
        finalScore: true,
        providerId: true,
        provider: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        items: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            goalId: true,
            target: true,
            goal: true,
            score: true,
            metricType: true,
            domain: true,
            rawValue: true,
            supportLevel: true,
            goalDefinition: {
              select: {
                id: true,
                target: true,
                goal: true,
                metricType: true,
                domain: true,
                targetValue: true,
                comparison: true,
                weight: true,
                providerId: true,
              },
            },
          },
        },
      },
      }),
      db.teamFocus.findFirst({
        where: {
          clientId,
          isActive: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
          author: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
    ]);

  if (!client) {
    return null;
  }

  const normalizedSessions = buildNormalizedSessionsWithSignals(sessions);
  const assessmentItems = normalizedSessions.flatMap((session) =>
    session.items.map((item) => ({
      itemId: item.id,
      sessionId: session.id,
      providerId: session.providerId,
      goalId: item.goalId,
      target: item.target,
      goal: item.goal,
      metricType: item.metricType,
      domain: item.domain,
      rawValue: item.rawValue,
      score: item.score,
      normalizedScore: item.normalizedScore,
      changeFromBaseline: item.changeFromBaseline,
      changeFromPrevious: item.changeFromPrevious,
      trendDirection: item.trendDirection,
      lowData: item.lowData,
      clinicallySmallButPositiveChange: item.clinicallySmallButPositiveChange,
      date: session.date.toISOString(),
    }))
  );

  const careTeam = providerAssignments.map((assignment) => ({
    providerId: assignment.providerId,
    providerName: `${assignment.provider.firstName} ${assignment.provider.lastName}`,
    accountRole: assignment.provider.role,
    assignmentRole: assignment.role,
  }));
  const providerAssignmentsContext = providerAssignments.map((assignment) => ({
    assignmentId: assignment.id,
    providerId: assignment.providerId,
    clientId: assignment.clientId,
    assignmentRole: assignment.role,
    provider: assignment.provider,
  }));
  const activeGoalsContext = activeGoals.map((goal) => ({
    goalId: goal.id,
    providerId: goal.providerId,
    providerName: `${goal.provider.firstName} ${goal.provider.lastName}`,
    target: goal.target,
    goal: goal.goal,
    metricType: goal.metricType,
    domain: goal.domain,
    targetValue: goal.targetValue,
    comparison: goal.comparison,
    weight: goal.weight,
    isMastered: goal.isMastered,
  }));
  const providerGoalSeries = buildProviderGoalSeries(normalizedSessions);
  const providerDomainSeries = buildProviderDomainSeries(normalizedSessions);
  const performanceTrends = buildPerformanceTrends(normalizedSessions);
  const abcEvents: InsightAbcEvent[] = [];
  const clinicalEvents: InsightClinicalEvent[] = [];
  const relationshipMetrics = buildRelationshipMetrics(normalizedSessions);
  const goalRelationships = buildGoalRelationships(normalizedSessions, activeGoalsContext);
  const providerRelationships = buildProviderRelationships(
    careTeam,
    activeGoalsContext,
    normalizedSessions,
    providerDomainSeries,
    performanceTrends
  );
  const providerOverlap = buildProviderOverlap(careTeam, goalRelationships, normalizedSessions);
  const domainRelationships = buildDomainRelationships(
    careTeam,
    activeGoalsContext,
    normalizedSessions,
    goalRelationships
  );
  const behaviorRelationships = buildBehaviorRelationships(normalizedSessions, abcEvents);
  const collaborationMetrics = buildCollaborationMetrics(
    careTeam,
    activeGoalsContext,
    goalRelationships,
    normalizedSessions
  );
  const continuityMetrics = buildContinuityMetrics(goalRelationships, normalizedSessions);
  const clinicalPicture = buildClinicalPicture(
    careTeam,
    activeGoalsContext,
    goalRelationships,
    normalizedSessions
  );
  const relationshipSummary = buildRelationshipSummary(
    careTeam,
    goalRelationships,
    domainRelationships,
    behaviorRelationships,
    providerRelationships,
    collaborationMetrics,
    continuityMetrics
  );
  const clientSignalScore = buildClientSignalScore(normalizedSessions);
  const domainContributions = buildDomainContributions(normalizedSessions);
  const questionContributors = buildQuestionContributors(domainContributions, parsed, normalizedSessions);
  const primaryContributors = questionContributors.filter(
    (contributor, index) => index < 3 && contributor.relevanceScore > 0
  );
  const secondaryContributors = questionContributors.filter(
    (contributor) =>
      contributor.relevanceScore > 0 &&
      !primaryContributors.some(
        (primary) => primary.providerId === contributor.providerId && primary.domain === contributor.domain
      )
  );

  return {
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      dateOfBirth: client.dateOfBirth?.toISOString() ?? null,
      diagnosis: client.diagnosis,
    },
    query: {
      providerRole: parsed.providerRole,
      metricType: parsed.metricType,
      dateRange: parsed.dateRange
        ? {
            from: parsed.dateRange.from.toISOString(),
            to: parsed.dateRange.to.toISOString(),
          }
        : undefined,
      threshold: parsed.threshold,
      comparison: parsed.comparison,
      domainFocus: parsed.domainFocus,
      intent: parsed.intent,
      context: parsed.context,
    },
    careTeam,
    currentTeamFocus: currentTeamFocus
      ? {
          id: currentTeamFocus.id,
          title: currentTeamFocus.title,
          content: currentTeamFocus.content,
          updatedAt: currentTeamFocus.updatedAt.toISOString(),
          authorName:
            `${currentTeamFocus.author.firstName} ${currentTeamFocus.author.lastName}`.trim(),
          authorRole: currentTeamFocus.author.role,
        }
      : null,
    providerAssignments: providerAssignmentsContext,
    activeGoals: activeGoalsContext,
    sessions: normalizedSessions,
    assessmentItems,
    providerGoalSeries,
    providerDomainSeries,
    performanceTrends,
    abcEvents,
    clinicalEvents,
    relationshipMetrics,
    clinicalPicture,
    providerRelationships,
    providerOverlap,
    goalRelationships,
    domainRelationships,
    behaviorRelationships,
    collaborationMetrics,
    continuityMetrics,
    relationshipSummary,
    clientSignalScore,
    domainContributions,
    questionContributors,
    primaryContributors,
    secondaryContributors,
    precomputedStatistics: {
      sessionCount: normalizedSessions.length,
      assessmentItemCount: assessmentItems.length,
      activeGoalCount: activeGoals.length,
      providersWithSessions: new Set(normalizedSessions.map((session) => session.providerId)).size,
    },
  };
}
