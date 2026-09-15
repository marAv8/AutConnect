/**
 * Builds the supervisor's longitudinal clinical read model.
 * Unlike the daily client handoff, this module gathers multi-session evidence for
 * Insights questions about providers, goals, trends, ABC events, and context.
 */
import { MetricType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { isTeamFocusVisible } from "@/app/libs/teamFocusLifecycle";
import { formatProviderDisplayName } from "../../libs/providerDisplayName";
import type { InsightCategory } from "@/app/libs/insights/categories";
import type { ParsedInsightQuestion } from "./insightsEngine";
import type {
  InsightAbcEvent,
  InsightClinicalEvent,
  InsightContext,
  InsightFieldObservation,
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
    category?: InsightCategory;
    includeCaseSupport?: boolean;
  }
): Promise<InsightContext | null> {
  const [
    client,
    providerAssignments,
    goalDefinitions,
    sessions,
    currentTeamFocus,
    fieldObservationRecords,
  ] =
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
      where: { clientId, revokedAt: null },
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
        measurementProfile: true,
        weight: true,
        isActive: true,
        isMastered: true,
        masteryBasis: true,
        masteredAt: true,
        masteryEvidenceEntryIds: true,
        masteryRevokedAt: true,
        masteryRevokedEvidenceEntryIds: true,
        masteryThreshold: true,
        masteryRequiredSessions: true,
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
                measurementProfile: true,
                weight: true,
                providerId: true,
                isActive: true,
                isMastered: true,
                masteryBasis: true,
                masteredAt: true,
                masteryEvidenceEntryIds: true,
                masteryRevokedAt: true,
                masteryRevokedEvidenceEntryIds: true,
                masteryThreshold: true,
                masteryRequiredSessions: true,
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
      db.fieldObservation.findMany({
        where: { clientId },
        orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          observedAt: true,
          setting: true,
          durationMinutes: true,
          observedProviderId: true,
          observedProviderRole: true,
          rubricVersion: true,
          fidelityPercent: true,
          applicableItemCount: true,
          strengths: true,
          coachingFocus: true,
          followUp: true,
          observedProvider: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          supervisor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          items: {
            orderBy: { displayOrder: "asc" },
            select: {
              criterionKey: true,
              criterionLabel: true,
              rating: true,
              displayOrder: true,
              note: true,
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

  const fieldObservations: InsightFieldObservation[] =
    fieldObservationRecords.map((observation) => ({
      id: observation.id,
      observedAt: observation.observedAt.toISOString(),
      setting: observation.setting,
      durationMinutes: observation.durationMinutes,
      observedProvider: {
        id: observation.observedProviderId,
        name: formatProviderDisplayName(
          observation.observedProvider.firstName,
          observation.observedProvider.lastName
        ),
        role: observation.observedProviderRole,
      },
      supervisor: {
        name: formatProviderDisplayName(
          observation.supervisor.firstName,
          observation.supervisor.lastName
        ),
      },
      rubricVersion: observation.rubricVersion,
      fidelityPercent: observation.fidelityPercent,
      applicableItemCount: observation.applicableItemCount,
      items: observation.items,
      strengths: observation.strengths,
      coachingFocus: observation.coachingFocus,
      followUp: observation.followUp,
    }));

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
    providerName: formatProviderDisplayName(
      entry.provider.firstName,
      entry.provider.lastName
    ),
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
      createdByName: formatProviderDisplayName(
        revision.createdBy.firstName,
        revision.createdBy.lastName
      ),
      createdByRole: revision.createdBy.role,
      snapshot: revision.snapshot,
      changes: revision.changes,
    })),
  }));

  const caseSupport =
    options.includeCaseSupport === true ||
    options.category === "caseSupport" ||
    options.category === "overview"
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
    providerName: formatProviderDisplayName(
      assignment.provider.firstName,
      assignment.provider.lastName
    ),
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
  const goalDefinitionsContext = goalDefinitions.map((goal) => ({
    goalId: goal.id,
    providerId: goal.providerId,
    providerName: formatProviderDisplayName(
      goal.provider.firstName,
      goal.provider.lastName
    ),
    target: goal.target,
    goal: goal.goal,
    metricType: goal.metricType,
    domain: goal.domain,
    targetValue: goal.targetValue,
    comparison: goal.comparison,
    measurementProfile: goal.measurementProfile,
    weight: goal.weight,
    isActive: goal.isActive,
    isMastered: goal.isMastered,
    masteryBasis: goal.masteryBasis,
    masteredAt: goal.masteredAt?.toISOString() ?? null,
    masteryEvidenceEntryIds: stringArray(goal.masteryEvidenceEntryIds),
    masteryRevokedAt: goal.masteryRevokedAt?.toISOString() ?? null,
    masteryRevokedEvidenceEntryIds: stringArray(
      goal.masteryRevokedEvidenceEntryIds
    ),
    masteryThreshold: goal.masteryThreshold,
    masteryRequiredSessions: goal.masteryRequiredSessions,
  }));
  const activeGoalsContext = goalDefinitionsContext.filter(
    (goal) => goal.isActive
  );
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
          authorName: formatProviderDisplayName(
            visibleCurrentTeamFocus.author.firstName,
            visibleCurrentTeamFocus.author.lastName
          ),
          authorRole: visibleCurrentTeamFocus.author.role,
        }
      : null,
    fieldObservations,
    documentationRecords,
    caseSupport,
    providerAssignments: providerAssignmentsContext,
    activeGoals: activeGoalsContext,
    goalDefinitions: goalDefinitionsContext,
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
      activeGoalCount: activeGoalsContext.length,
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
      requesterName: formatProviderDisplayName(
        request.requester.firstName,
        request.requester.lastName
      ),
      requesterRole: request.requester.role,
      recipientSupervisorName: formatProviderDisplayName(
        request.recipientSupervisor.firstName,
        request.recipientSupervisor.lastName
      ),
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
      ownerName: formatProviderDisplayName(
        caseRecord.ownerSupervisor.firstName,
        caseRecord.ownerSupervisor.lastName
      ),
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
        authorName: formatProviderDisplayName(
          entry.author.firstName,
          entry.author.lastName
        ),
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
        authorName: formatProviderDisplayName(
          coordination.author.firstName,
          coordination.author.lastName
        ),
      })),
    })),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
