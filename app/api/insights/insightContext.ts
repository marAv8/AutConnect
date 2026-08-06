/**
 * Builds the supervisor's longitudinal clinical read model.
 * Unlike the daily client handoff, this module gathers multi-session evidence for
 * Insights questions about providers, goals, trends, ABC events, and context.
 */
import { MetricType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { isTeamFocusVisible } from "@/app/libs/teamFocusLifecycle";
import type { InsightCategory } from "@/app/libs/insights/categories";
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
  parsed: ParsedInsightQuestion,
  options: {
    viewerProviderId: string;
    category: InsightCategory;
  }
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
        status: "COMPLETED",
        OR: [
          { visibility: "Shared" },
          { providerId: options.viewerProviderId },
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
              date: {
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
        updatedAt: true,
        completedAt: true,
        kind: true,
        visibility: true,
        status: true,
        note: true,
        clinicalReflection: true,
        contextData: true,
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
            observation: true,
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
        abcObservations: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            antecedent: true,
            behavior: true,
            consequence: true,
          },
        },
        revisions: {
          orderBy: [{ revisionNumber: "desc" }],
          select: {
            id: true,
            revisionNumber: true,
            snapshot: true,
            changes: true,
            createdAt: true,
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
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
          displayStartedAt: true,
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

  const visibleCurrentTeamFocus =
    currentTeamFocus &&
    isTeamFocusVisible(currentTeamFocus.displayStartedAt)
      ? currentTeamFocus
      : null;

  const documentationRecords = sessions.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    visibility: entry.visibility,
    status: entry.status,
    date: entry.date.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    completedAt: entry.completedAt?.toISOString() ?? null,
    note: entry.note,
    clinicalReflection: entry.clinicalReflection,
    contextData: entry.contextData ?? null,
    providerId: entry.providerId,
    providerName:
      `${entry.provider.firstName} ${entry.provider.lastName}`.trim(),
    providerRole: entry.provider.role,
    observations: entry.items.flatMap((item) =>
      item.observation
        ? [{ target: item.target, observation: item.observation }]
        : []
    ),
    abcObservations: entry.abcObservations,
    revisions: entry.revisions.map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      createdAt: revision.createdAt.toISOString(),
      createdByName:
        `${revision.createdBy.firstName} ${revision.createdBy.lastName}`.trim(),
      createdByRole: revision.createdBy.role,
      snapshot: revision.snapshot,
      changes: revision.changes,
    })),
  }));

  const caseSupport =
    options.category === "caseSupport" || options.category === "overview"
      ? await loadAccessibleCaseSupport(clientId, options.viewerProviderId)
      : { requests: [], cases: [] };

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
    currentTeamFocus: visibleCurrentTeamFocus
      ? {
          id: visibleCurrentTeamFocus.id,
          title: visibleCurrentTeamFocus.title,
          content: visibleCurrentTeamFocus.content,
          updatedAt: visibleCurrentTeamFocus.updatedAt.toISOString(),
          authorName:
            `${visibleCurrentTeamFocus.author.firstName} ${visibleCurrentTeamFocus.author.lastName}`.trim(),
          authorRole: visibleCurrentTeamFocus.author.role,
        }
      : null,
    documentationRecords,
    caseSupport,
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

async function loadAccessibleCaseSupport(
  clientId: string,
  viewerProviderId: string
): Promise<InsightContext["caseSupport"]> {
  const [requests, cases] = await Promise.all([
    db.caseSupportRequest.findMany({
      where: {
        clientId,
        recipientSupervisorId: viewerProviderId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        concern: true,
        requestedSupport: true,
        status: true,
        responseNote: true,
        createdAt: true,
        updatedAt: true,
        requester: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        recipientSupervisor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    db.caseSupportCase.findMany({
      where: {
        clientId,
        OR: [
          { ownerSupervisorId: viewerProviderId },
          {
            members: {
              some: {
                providerId: viewerProviderId,
                revokedAt: null,
              },
            },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        concern: true,
        desiredOutcome: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        ownerSupervisor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        entries: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            entryType: true,
            occurredAt: true,
            whatOccurred: true,
            supportProvided: true,
            observableOutcome: true,
            communication: true,
            followUp: true,
            clarification: true,
            author: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        coordinations: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            path: true,
            status: true,
            occurredAt: true,
            actionTaken: true,
            requestOrDecision: true,
            responseSummary: true,
            nextStep: true,
            author: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    requests: requests.map((request) => ({
      id: request.id,
      concern: request.concern,
      requestedSupport: request.requestedSupport,
      status: request.status,
      responseNote: request.responseNote,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      requesterName:
        `${request.requester.firstName} ${request.requester.lastName}`.trim(),
      requesterRole: request.requester.role,
      recipientSupervisorName:
        `${request.recipientSupervisor.firstName} ${request.recipientSupervisor.lastName}`.trim(),
    })),
    cases: cases.map((caseRecord) => ({
      id: caseRecord.id,
      title: caseRecord.title,
      concern: caseRecord.concern,
      desiredOutcome: caseRecord.desiredOutcome,
      status: caseRecord.status,
      createdAt: caseRecord.createdAt.toISOString(),
      updatedAt: caseRecord.updatedAt.toISOString(),
      resolvedAt: caseRecord.resolvedAt?.toISOString() ?? null,
      ownerName:
        `${caseRecord.ownerSupervisor.firstName} ${caseRecord.ownerSupervisor.lastName}`.trim(),
      entries: caseRecord.entries.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        occurredAt: entry.occurredAt.toISOString(),
        whatOccurred: entry.whatOccurred,
        supportProvided: entry.supportProvided,
        observableOutcome: entry.observableOutcome,
        communication: entry.communication,
        followUp: entry.followUp,
        clarification: entry.clarification,
        authorName:
          `${entry.author.firstName} ${entry.author.lastName}`.trim(),
        authorRole: entry.author.role,
      })),
      coordinations: caseRecord.coordinations.map((coordination) => ({
        id: coordination.id,
        path: coordination.path,
        status: coordination.status,
        occurredAt: coordination.occurredAt.toISOString(),
        actionTaken: coordination.actionTaken,
        requestOrDecision: coordination.requestOrDecision,
        responseSummary: coordination.responseSummary,
        nextStep: coordination.nextStep,
        authorName:
          `${coordination.author.firstName} ${coordination.author.lastName}`.trim(),
      })),
    })),
  };
}
