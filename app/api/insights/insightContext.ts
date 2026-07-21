import { AssessmentDomain, ComparisonType, MetricType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeItem } from "@/lib/sessionScoring";
import type { ParsedInsightQuestion } from "./insightsEngine";

export type InsightTrend = "up" | "down" | "flat";
export type InsightTrendDirection = InsightTrend | "insufficientData";
export type InsightDomainName = AssessmentDomain | "Unspecified";
export type InsightMatchType = "goalId" | "targetGoal" | "targetOnly" | "domainOnly";
export type InsightMatchConfidence = "high" | "medium" | "low";
export type InsightClinicalPictureKey =
  | "behavior"
  | "communication"
  | "occupational"
  | "education"
  | "caregiver";
export type InsightRelationshipDomain =
  | "Behavior"
  | "Communication"
  | "Speech"
  | "Occupational"
  | "Education"
  | "Caregiver"
  | "Adaptive"
  | "Regulation"
  | "SkillAcquisition"
  | "Other"
  | "Unspecified";

type InsightGoalReference = {
  goalKey: string;
  goalId: string | null;
  target: string;
  goal: string;
  domain: InsightDomainName;
  metricType: MetricType;
  providers: Array<{
    providerId: string;
    providerName: string;
    role: string;
  }>;
  sessionCount: number;
  lastMeasuredAt: string | null;
  trend?: InsightTrend;
  averagePerformance: number | null;
};

type InsightRelationshipMatch = {
  matchType: InsightMatchType;
  confidence: InsightMatchConfidence;
  providerA: InsightGoalReference;
  providerB: InsightGoalReference;
};

type InsightDomainContribution = {
  providerId: string;
  providerName: string;
  providerRole: string;
  domain: InsightDomainName;
  assessmentCount: number;
  sessionCount: number;
  normalizedAverage: number | null;
  goalsCovered: string[];
  targetsCovered: string[];
  lastContributionDate: string | null;
};

type InsightQuestionContributor = InsightDomainContribution & {
  relevanceScore: number;
  matchedDomains: InsightDomainName[];
  evidenceWeight: {
    assessmentCount: number;
    sessionCount: number;
    recencyScore: number;
    domainCoverage: number;
  };
};

type InsightAbcEvent = {
  id: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  providerId: string;
  providerName: string;
  date: string;
  linkedSessionId: string | null;
};

type InsightClinicalEvent = {
  id: string;
  type: "ABC";
  providerId: string;
  date: string;
  linkedSessionId: string | null;
  data: Record<string, string | null>;
};

export type InsightContext = {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    diagnosis: string | null;
  };
  query: {
    providerRole?: string;
    metricType?: string;
    dateRange?: {
      from: string;
      to: string;
    };
    domainFocus?: ParsedInsightQuestion["domainFocus"];
    threshold?: number;
    comparison?: "above" | "below";
    intent: ParsedInsightQuestion["intent"];
    context?: string[];
  };
  careTeam: Array<{
    providerId: string;
    providerName: string;
    accountRole: string;
    assignmentRole: string;
  }>;
  currentTeamFocus: {
    id: string;
    title: string | null;
    content: string;
    updatedAt: string;
    authorName: string;
    authorRole: string;
  } | null;
  providerAssignments: Array<{
    assignmentId: string;
    providerId: string;
    clientId: string;
    assignmentRole: string;
    provider: {
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
  activeGoals: Array<{
    goalId: string;
    providerId: string;
    providerName: string;
    target: string;
    goal: string;
    metricType: MetricType;
    domain: AssessmentDomain | null;
    targetValue: number | null;
    comparison: ComparisonType | null;
    weight: number;
    isMastered: boolean;
  }>;
  sessions: Array<{
    id: string;
    date: Date;
    createdAt: Date;
    note: string | null;
    finalScore: number | null;
    providerId: string;
    provider: {
      firstName: string;
      lastName: string;
      role: string;
    };
    items: Array<{
      id: string;
      goalId: string | null;
      target: string;
      goal: string;
      score: number | null;
      metricType: MetricType;
      domain: AssessmentDomain | null;
      rawValue: number | null;
      supportLevel: number | null;
      normalizedScore: number | null;
      changeFromBaseline: number | null;
      changeFromPrevious: number | null;
      trendDirection: InsightTrendDirection;
      lowData: boolean;
      clinicallySmallButPositiveChange: boolean;
      goalDefinition: {
        id: string;
        target: string;
        goal: string;
        metricType: MetricType;
        domain: AssessmentDomain | null;
        targetValue: number | null;
        comparison: ComparisonType | null;
        weight: number;
        providerId: string;
      } | null;
    }>;
  }>;
  assessmentItems: Array<{
    itemId: string;
    sessionId: string;
    providerId: string;
    goalId: string | null;
    target: string;
    goal: string;
    metricType: MetricType;
    domain: AssessmentDomain | null;
    rawValue: number | null;
    score: number | null;
    normalizedScore: number | null;
    changeFromBaseline: number | null;
    changeFromPrevious: number | null;
    trendDirection: InsightTrendDirection;
    lowData: boolean;
    clinicallySmallButPositiveChange: boolean;
    date: string;
  }>;
  providerGoalSeries: Array<{
    providerId: string;
    providerName: string;
    goalKey: string;
    goalId: string | null;
    target: string;
    goal: string;
    domain: AssessmentDomain | null;
    metricType: MetricType;
    sessions: Array<{
      sessionId: string;
      date: string;
      rawValue: number | null;
      score: number | null;
      normalizedScore: number | null;
      changeFromBaseline: number | null;
      changeFromPrevious: number | null;
      trendDirection: InsightTrendDirection;
      lowData: boolean;
      clinicallySmallButPositiveChange: boolean;
    }>;
    trend?: InsightTrend;
  }>;
  providerDomainSeries: Array<{
    providerId: string;
    providerName: string;
    domain: AssessmentDomain | "Unspecified";
    sessions: Array<{
      sessionId: string;
      date: string;
      averageScore: number | null;
      itemCount: number;
    }>;
    trend?: InsightTrend;
  }>;
  performanceTrends: Array<{
    providerId: string;
    providerName: string;
    trend?: InsightTrend;
    sessions: number;
    firstAverage: number | null;
    secondAverage: number | null;
  }>;
  abcEvents: InsightAbcEvent[];
  clinicalEvents: InsightClinicalEvent[];
  relationshipMetrics: {
    providerPairs: Array<{
      providerAId: string;
      providerBId: string;
      sharedTargets: string[];
      sharedGoals: string[];
    }>;
    providerCoverage: Array<{
      providerId: string;
      providerName: string;
      sessions: number;
      domains: Array<AssessmentDomain | "Unspecified">;
      goals: string[];
    }>;
  };
  clinicalPicture: Record<
    InsightClinicalPictureKey,
    {
      activeTargets: string[];
      recentlyMeasuredGoals: InsightGoalReference[];
      improvingGoals: InsightGoalReference[];
      decliningGoals: InsightGoalReference[];
      stableGoals: InsightGoalReference[];
      newlyIntroducedGoals: InsightGoalReference[];
      inactiveGoals: InsightGoalReference[];
      lowDataGoals: InsightGoalReference[];
    }
  >;
  providerRelationships: Array<{
    providerId: string;
    providerName: string;
    accountRole: string;
    assignmentRole: string;
    totalSessions: number;
    activeGoals: InsightGoalReference[];
    domainsWorked: InsightDomainName[];
    averageNormalizedPerformance: number | null;
    strongestDomains: InsightDomainName[];
    weakestDomains: InsightDomainName[];
    consistency: number | null;
    trend?: InsightTrend;
    coverage: {
      goalCount: number;
      domainCount: number;
      sessionCount: number;
      recentSessionCount: number;
      firstSessionAt: string | null;
      lastSessionAt: string | null;
      hasSessions: boolean;
      hasActiveGoals: boolean;
      daysSinceLastSession: number | null;
      domainsCovered: InsightDomainName[];
      goalsCovered: string[];
    };
  }>;
  providerOverlap: Array<{
    providerAId: string;
    providerAName: string;
    providerBId: string;
    providerBName: string;
    sharedGoals: InsightGoalReference[];
    sharedTargets: string[];
    sharedDomains: InsightDomainName[];
    exactSharedGoals: InsightRelationshipMatch[];
    relatedTargets: InsightRelationshipMatch[];
    relatedDomains: InsightRelationshipMatch[];
    relationshipMatches: InsightRelationshipMatch[];
    overlappingSessions: Array<{
      providerASessionId: string;
      providerBSessionId: string;
      date: string;
    }>;
    uniqueGoals: {
      providerA: InsightGoalReference[];
      providerB: InsightGoalReference[];
    };
    uniqueDomains: {
      providerA: InsightDomainName[];
      providerB: InsightDomainName[];
    };
  }>;
  goalRelationships: Array<{
    goalKey: string;
    goalId: string | null;
    target: string;
    goal: string;
    metricType: MetricType;
    domains: InsightDomainName[];
    providers: Array<{
      providerId: string;
      providerName: string;
      role: string;
    }>;
    sessions: Array<{
      sessionId: string;
      providerId: string;
      providerName: string;
      date: string;
      normalizedScore: number | null;
      rawValue: number | null;
      score: number | null;
    }>;
    averagePerformance: number | null;
    trend?: InsightTrend;
    currentStatus: "active" | "inactive" | "mastered" | "unlinked";
  }>;
  domainRelationships: Array<{
    domain: InsightRelationshipDomain;
    providersInvolved: Array<{
      providerId: string;
      providerName: string;
      role: string;
    }>;
    activeGoals: InsightGoalReference[];
    averageTrend?: InsightTrend;
    recentActivity: {
      lastMeasuredAt: string | null;
      recentSessionCount: number;
      recentGoalCount: number;
    };
    sessionCount: number;
  }>;
  behaviorRelationships: Array<{
    target: string;
    sessionsObserved: number;
    providersObserving: Array<{
      providerId: string;
      providerName: string;
      role: string;
    }>;
    averageFrequency: number | null;
    trend?: InsightTrend;
    associatedABCEvents: InsightAbcEvent[];
  }>;
  collaborationMetrics: {
    providersWorkingOnCommonGoals: Array<{
      goalKey: string;
      goalId: string | null;
      target: string;
      goal: string;
      providers: Array<{
        providerId: string;
        providerName: string;
        role: string;
      }>;
      matchType: InsightMatchType;
      confidence: InsightMatchConfidence;
    }>;
    providersWorkingIndependently: Array<{
      providerId: string;
      providerName: string;
      independentGoals: InsightGoalReference[];
      independentDomains: InsightDomainName[];
    }>;
    goalsSpanningMultipleProfessions: InsightGoalReference[];
    goalsIsolatedToOneProvider: InsightGoalReference[];
    exactSharedGoals: InsightRelationshipMatch[];
    relatedTargets: InsightRelationshipMatch[];
    relatedDomains: InsightRelationshipMatch[];
    careTeamCoverage: Array<{
      providerId: string;
      providerName: string;
      assigned: boolean;
      hasSessions: boolean;
      hasActiveGoals: boolean;
      daysSinceLastSession: number | null;
      domains: InsightDomainName[];
      domainsCovered: InsightDomainName[];
      goalsCovered: string[];
      sessionCount: number;
    }>;
    missingProviderParticipation: Array<{
      providerId: string;
      providerName: string;
      reason: "no_sessions" | "no_active_goals" | "no_recent_sessions";
    }>;
  };
  continuityMetrics: {
    daysBetweenSessions: Array<{
      providerId: string | null;
      providerName: string | null;
      fromSessionId: string;
      toSessionId: string;
      days: number;
    }>;
    providerGaps: Array<{
      providerId: string;
      providerName: string;
      maxDaysBetweenSessions: number | null;
      daysSinceLastSession: number | null;
    }>;
    goalContinuity: Array<{
      goalKey: string;
      goalId: string | null;
      target: string;
      goal: string;
      sessionCount: number;
      maxDaysBetweenMeasurements: number | null;
      daysSinceLastMeasurement: number | null;
      providers: string[];
    }>;
    providerTransitions: Array<{
      fromProviderId: string;
      fromProviderName: string;
      toProviderId: string;
      toProviderName: string;
      fromSessionId: string;
      toSessionId: string;
      daysBetween: number;
    }>;
    missingFollowUp: Array<{
      goalKey: string;
      goalId: string | null;
      target: string;
      goal: string;
      daysSinceLastMeasurement: number | null;
    }>;
  };
  relationshipSummary: {
    totalProviders: number;
    exactSharedGoals: number;
    relatedTargets: number;
    relatedDomains: number;
    isolatedGoals: number;
    collaborativeGoals: number;
    activeDomains: InsightDomainName[];
    recentBehaviorTargets: string[];
    providerCoverage: Array<{
      providerId: string;
      providerName: string;
      sessionCount: number;
      domainCount: number;
      activeGoalCount: number;
    }>;
    continuityScore: number | null;
  };
  clientSignalScore: {
    normalizedTotalScore: number | null;
    trendDirection: InsightTrendDirection;
    confidence: "high" | "medium" | "low";
    contributingDomains: InsightDomainName[];
    contributingProviders: Array<{
      providerId: string;
      providerName: string;
    }>;
    lowDataWarning: boolean;
    lastUpdatedAt: string | null;
  };
  domainContributions: InsightDomainContribution[];
  questionContributors: InsightQuestionContributor[];
  primaryContributors: InsightQuestionContributor[];
  secondaryContributors: InsightQuestionContributor[];
  precomputedStatistics: {
    sessionCount: number;
    assessmentItemCount: number;
    activeGoalCount: number;
    providersWithSessions: number;
  };
};

type InsightSession = InsightContext["sessions"][number];
type InsightAssessmentItem = InsightSession["items"][number];
type RawInsightAssessmentItem = Omit<
  InsightAssessmentItem,
  | "normalizedScore"
  | "changeFromBaseline"
  | "changeFromPrevious"
  | "trendDirection"
  | "lowData"
  | "clinicallySmallButPositiveChange"
>;
type RawInsightSession = Omit<InsightSession, "items"> & {
  items: RawInsightAssessmentItem[];
};
type InsightCareTeamMember = InsightContext["careTeam"][number];
type InsightActiveGoal = InsightContext["activeGoals"][number];
type InsightGoalRelationship = InsightContext["goalRelationships"][number];
type InsightProviderDomainSeries = InsightContext["providerDomainSeries"][number];
type InsightPerformanceTrend = InsightContext["performanceTrends"][number];
type InsightProviderRelationship = InsightContext["providerRelationships"][number];
type InsightDomainRelationship = InsightContext["domainRelationships"][number];
type InsightBehaviorRelationship = InsightContext["behaviorRelationships"][number];
type InsightCollaborationMetrics = InsightContext["collaborationMetrics"];
type InsightContinuityMetrics = InsightContext["continuityMetrics"];

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

function normalizeContextScore(item: {
  metricType: MetricType;
  target: string;
  goal: string;
  score: number | null;
  rawValue: number | null;
  goalDefinition: {
    metricType: MetricType;
    target?: string | null;
    goal?: string | null;
    targetValue: number | null;
    comparison: ComparisonType | null;
    weight: number;
  } | null;
}) {
  const success = normalizeItem(
    {
      metricType: item.metricType,
      target: item.target,
      goal: item.goal,
      score: item.score,
      rawValue: item.rawValue,
      goalDefinition: item.goalDefinition,
    },
    item.goalDefinition
  );

  if (success !== null) {
    return Math.max(1, Math.min(10, success * 10));
  }

  if (item.metricType === MetricType.Percentage && typeof item.rawValue === "number") {
    return Math.max(1, Math.min(10, item.rawValue / 10));
  }

  if (item.metricType === MetricType.Subjective && typeof item.score === "number") {
    return Math.max(1, Math.min(10, item.score));
  }

  if (
    (item.metricType === MetricType.Duration || item.metricType === MetricType.Frequency) &&
    typeof item.rawValue === "number"
  ) {
    return Math.max(1, Math.min(10, 10 - item.rawValue));
  }

  return null;
}

function signalTrendDirection(change: number | null): InsightTrendDirection {
  if (change === null) return "insufficientData";
  if (Math.abs(change) < 0.35) return "flat";
  return change > 0 ? "up" : "down";
}

function buildNormalizedSessionsWithSignals(sessions: RawInsightSession[]): InsightSession[] {
  const historyByGoal = new Map<string, number[]>();

  return sessions.map((session) => ({
    ...session,
    items: session.items.map((item) => {
      const normalizedScore = normalizeContextScore(item);
      const key = goalKey({
        ...item,
        normalizedScore,
        changeFromBaseline: null,
        changeFromPrevious: null,
        trendDirection: "insufficientData",
        lowData: true,
        clinicallySmallButPositiveChange: false,
      });
      const history = historyByGoal.get(key) ?? [];
      const baseline = history[0] ?? null;
      const previous = history.at(-1) ?? null;
      const changeFromBaseline =
        normalizedScore !== null && baseline !== null ? round(normalizedScore - baseline) : null;
      const changeFromPrevious =
        normalizedScore !== null && previous !== null ? round(normalizedScore - previous) : null;
      const positiveChange = changeFromPrevious ?? changeFromBaseline;

      if (normalizedScore !== null) {
        historyByGoal.set(key, [...history, normalizedScore]);
      }

      return {
        ...item,
        normalizedScore,
        changeFromBaseline,
        changeFromPrevious,
        trendDirection: signalTrendDirection(changeFromPrevious ?? changeFromBaseline),
        lowData: history.length + (normalizedScore !== null ? 1 : 0) < 3,
        clinicallySmallButPositiveChange:
          positiveChange !== null && positiveChange > 0 && positiveChange < 0.35,
      };
    }),
  }));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trendFromValues(values: Array<{ date: number; score: number | null }>): {
  trend?: InsightTrend;
  firstAverage: number | null;
  secondAverage: number | null;
} {
  const datedScores = values
    .filter((point): point is { date: number; score: number } => point.score !== null)
    .sort((a, b) => a.date - b.date);

  if (datedScores.length < 2) {
    return {
      firstAverage: datedScores[0]?.score ?? null,
      secondAverage: null,
    };
  }

  const midpoint = Math.ceil(datedScores.length / 2);
  const firstAverage = average(datedScores.slice(0, midpoint).map((point) => point.score));
  const secondAverage = average(datedScores.slice(midpoint).map((point) => point.score));

  if (
    firstAverage === null ||
    secondAverage === null ||
    Math.abs(secondAverage - firstAverage) < 0.35
  ) {
    return { trend: "flat", firstAverage, secondAverage };
  }

  return {
    trend: secondAverage > firstAverage ? "up" : "down",
    firstAverage,
    secondAverage,
  };
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeMatchLabel(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[.,;:!?()[\]{}"'`]/g, " ")
    .replace(/[-/\\_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const mean = average(values);
  if (mean === null) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}

function daysBetween(first: Date, second: Date) {
  return Math.round((second.getTime() - first.getTime()) / 86_400_000);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function latestSessionDate(sessions: InsightSession[]) {
  if (sessions.length === 0) return null;
  return new Date(Math.max(...sessions.map((session) => session.date.getTime())));
}

function providerNameFromSession(session: InsightSession) {
  return `${session.provider.firstName} ${session.provider.lastName}`;
}

function providerRoleFromSession(session: InsightSession) {
  return session.provider.role;
}

function domainName(domain: AssessmentDomain | null): InsightDomainName {
  return domain ?? "Unspecified";
}

function relationshipDomainFor(
  domain: AssessmentDomain | null,
  providerRole?: string
): InsightRelationshipDomain {
  if (providerRole === Role.SpeechPathologist) return "Speech";
  if (providerRole === Role.OccupationalTherapist) return "Occupational";
  if (providerRole === Role.Educator) return "Education";
  if (providerRole === Role.Caregiver) return "Caregiver";
  return domainName(domain);
}

function clinicalPictureKeyFor(
  domain: AssessmentDomain | null,
  providerRole?: string
): InsightClinicalPictureKey {
  if (domain === AssessmentDomain.Behavior) return "behavior";
  if (domain === AssessmentDomain.Communication || providerRole === Role.SpeechPathologist) {
    return "communication";
  }
  if (
    domain === AssessmentDomain.Adaptive ||
    domain === AssessmentDomain.Regulation ||
    providerRole === Role.OccupationalTherapist
  ) {
    return "occupational";
  }
  if (domain === AssessmentDomain.SkillAcquisition || providerRole === Role.Educator) {
    return "education";
  }
  if (providerRole === Role.Caregiver) return "caregiver";
  return "behavior";
}

function emptyClinicalPictureSection(): InsightContext["clinicalPicture"][InsightClinicalPictureKey] {
  return {
    activeTargets: [],
    recentlyMeasuredGoals: [],
    improvingGoals: [],
    decliningGoals: [],
    stableGoals: [],
    newlyIntroducedGoals: [],
    inactiveGoals: [],
    lowDataGoals: [],
  };
}

function sortGoalReferences(goals: InsightGoalReference[]) {
  return [...goals].sort((a, b) => `${a.target}|${a.goal}`.localeCompare(`${b.target}|${b.goal}`));
}

function uniqueGoalReferences(goals: InsightGoalReference[]) {
  const seen = new Set<string>();
  return goals.filter((goal) => {
    const key = `${goal.goalId ?? ""}|${normalizeMatchLabel(goal.target)}|${normalizeMatchLabel(goal.goal)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueLabelsByNormalizedKey(labels: string[]) {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = normalizeMatchLabel(label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function goalReferenceFromRelationship(goal: InsightGoalRelationship): InsightGoalReference {
  return {
    goalKey: goal.goalKey,
    goalId: goal.goalId,
    target: goal.target,
    goal: goal.goal,
    domain: goal.domains[0] ?? "Unspecified",
    metricType: goal.metricType,
    providers: goal.providers,
    sessionCount: goal.sessions.length,
    lastMeasuredAt: goal.sessions.at(-1)?.date ?? null,
    trend: goal.trend,
    averagePerformance: goal.averagePerformance,
  };
}

function goalReferenceFromActiveGoal(goal: InsightActiveGoal): InsightGoalReference {
  return {
    goalKey: goal.goalId,
    goalId: goal.goalId,
    target: goal.target,
    goal: goal.goal,
    domain: domainName(goal.domain),
    metricType: goal.metricType,
    providers: [
      {
        providerId: goal.providerId,
        providerName: goal.providerName,
        role: "",
      },
    ],
    sessionCount: 0,
    lastMeasuredAt: null,
    averagePerformance: null,
  };
}

function goalKey(item: InsightAssessmentItem) {
  return item.goalId ?? `${normalizeMatchLabel(item.target)}|${normalizeMatchLabel(item.goal)}`;
}

function goalMatchKeys(goal: {
  goalId: string | null;
  target: string;
  goal: string;
  domains: InsightDomainName[];
}) {
  return {
    goalId: goal.goalId,
    targetGoal: `${normalizeMatchLabel(goal.target)}|${normalizeMatchLabel(goal.goal)}`,
    target: normalizeMatchLabel(goal.target),
    domains: goal.domains.map((domain) => normalizeMatchLabel(domain)),
  };
}

function matchConfidence(matchType: InsightMatchType): InsightMatchConfidence {
  if (matchType === "goalId" || matchType === "targetGoal") return "high";
  if (matchType === "targetOnly") return "medium";
  return "low";
}

function buildGoalMatch(
  first: InsightGoalRelationship,
  second: InsightGoalRelationship,
  matchType: InsightMatchType
): InsightRelationshipMatch {
  return {
    matchType,
    confidence: matchConfidence(matchType),
    providerA: goalReferenceFromRelationship(first),
    providerB: goalReferenceFromRelationship(second),
  };
}

function bestGoalMatchType(
  first: InsightGoalRelationship,
  second: InsightGoalRelationship
): InsightMatchType | null {
  const firstKeys = goalMatchKeys(first);
  const secondKeys = goalMatchKeys(second);

  if (firstKeys.goalId && secondKeys.goalId && firstKeys.goalId === secondKeys.goalId) {
    return "goalId";
  }

  if (firstKeys.targetGoal && firstKeys.targetGoal === secondKeys.targetGoal) {
    return "targetGoal";
  }

  if (firstKeys.target && firstKeys.target === secondKeys.target) {
    return "targetOnly";
  }

  if (firstKeys.domains.some((domain) => secondKeys.domains.includes(domain))) {
    return "domainOnly";
  }

  return null;
}

function providerGoalMatches(
  firstGoals: InsightGoalRelationship[],
  secondGoals: InsightGoalRelationship[]
) {
  const matches: InsightRelationshipMatch[] = [];

  for (const firstGoal of firstGoals) {
    for (const secondGoal of secondGoals) {
      const matchType = bestGoalMatchType(firstGoal, secondGoal);
      if (matchType) {
        matches.push(buildGoalMatch(firstGoal, secondGoal, matchType));
      }
    }
  }

  return matches;
}

function buildProviderGoalSeries(sessions: InsightSession[]): InsightContext["providerGoalSeries"] {
  const seriesMap = new Map<string, InsightContext["providerGoalSeries"][number]>();

  for (const session of sessions) {
    const providerName = `${session.provider.firstName} ${session.provider.lastName}`;
    for (const item of session.items) {
      const key = `${session.providerId}|${goalKey(item)}`;
      const existing =
        seriesMap.get(key) ??
        {
          providerId: session.providerId,
          providerName,
          goalKey: goalKey(item),
          goalId: item.goalId,
          target: item.target,
          goal: item.goal,
          domain: item.domain,
          metricType: item.metricType,
          sessions: [],
        };

      existing.sessions.push({
        sessionId: session.id,
        date: session.date.toISOString(),
        rawValue: item.rawValue,
        score: item.score,
        normalizedScore: item.normalizedScore,
        changeFromBaseline: item.changeFromBaseline,
        changeFromPrevious: item.changeFromPrevious,
        trendDirection: item.trendDirection,
        lowData: item.lowData,
        clinicallySmallButPositiveChange: item.clinicallySmallButPositiveChange,
      });
      seriesMap.set(key, existing);
    }
  }

  return Array.from(seriesMap.values()).map((series) => ({
    ...series,
    trend: trendFromValues(
      series.sessions.map((session) => ({
        date: new Date(session.date).getTime(),
        score: session.normalizedScore,
      }))
    ).trend,
  }));
}

function buildProviderDomainSeries(
  sessions: InsightSession[]
): InsightContext["providerDomainSeries"] {
  const seriesMap = new Map<string, InsightContext["providerDomainSeries"][number]>();

  for (const session of sessions) {
    const providerName = `${session.provider.firstName} ${session.provider.lastName}`;
    const domainGroups = new Map<AssessmentDomain | "Unspecified", number[]>();

    for (const item of session.items) {
      const domain = item.domain ?? "Unspecified";
      const scores = domainGroups.get(domain) ?? [];
      if (item.normalizedScore !== null) {
        scores.push(item.normalizedScore);
      }
      domainGroups.set(domain, scores);
    }

    for (const [domain, scores] of domainGroups.entries()) {
      const key = `${session.providerId}|${domain}`;
      const existing =
        seriesMap.get(key) ??
        {
          providerId: session.providerId,
          providerName,
          domain,
          sessions: [],
        };

      existing.sessions.push({
        sessionId: session.id,
        date: session.date.toISOString(),
        averageScore: average(scores),
        itemCount: scores.length,
      });
      seriesMap.set(key, existing);
    }
  }

  return Array.from(seriesMap.values()).map((series) => ({
    ...series,
    trend: trendFromValues(
      series.sessions.map((session) => ({
        date: new Date(session.date).getTime(),
        score: session.averageScore,
      }))
    ).trend,
  }));
}

function buildPerformanceTrends(sessions: InsightSession[]): InsightContext["performanceTrends"] {
  const sessionsByProvider = new Map<string, InsightSession[]>();

  for (const session of sessions) {
    const existing = sessionsByProvider.get(session.providerId) ?? [];
    existing.push(session);
    sessionsByProvider.set(session.providerId, existing);
  }

  return Array.from(sessionsByProvider.entries()).map(([providerId, providerSessions]) => {
    const provider = providerSessions[0].provider;
    const trend = trendFromValues(
      providerSessions.map((session) => ({
        date: session.createdAt.getTime(),
        score: average(
          session.items
            .map((item) => item.normalizedScore)
            .filter((score): score is number => score !== null)
        ),
      }))
    );

    return {
      providerId,
      providerName: `${provider.firstName} ${provider.lastName}`,
      trend: trend.trend,
      sessions: providerSessions.length,
      firstAverage: trend.firstAverage,
      secondAverage: trend.secondAverage,
    };
  });
}

function buildGoalRelationships(
  sessions: InsightSession[],
  activeGoals: InsightActiveGoal[]
): InsightContext["goalRelationships"] {
  const activeById = new Map(activeGoals.map((goal) => [goal.goalId, goal]));
  const activeByText = new Map(
    activeGoals.map((goal) => [
      `${normalizeMatchLabel(goal.target)}|${normalizeMatchLabel(goal.goal)}`,
      goal,
    ])
  );
  const goalMap = new Map<
    string,
    {
      goalKey: string;
      goalId: string | null;
      target: string;
      goal: string;
      metricType: MetricType;
      domains: Set<InsightDomainName>;
      providers: Map<string, { providerId: string; providerName: string; role: string }>;
      sessions: InsightGoalRelationship["sessions"];
    }
  >();

  for (const session of sessions) {
    for (const item of session.items) {
      const key = goalKey(item);
      const existing =
        goalMap.get(key) ??
        {
          goalKey: key,
          goalId: item.goalId,
          target: item.target,
          goal: item.goal,
          metricType: item.metricType,
          domains: new Set<InsightDomainName>(),
          providers: new Map<string, { providerId: string; providerName: string; role: string }>(),
          sessions: [],
        };

      existing.domains.add(domainName(item.domain));
      existing.providers.set(session.providerId, {
        providerId: session.providerId,
        providerName: providerNameFromSession(session),
        role: providerRoleFromSession(session),
      });
      existing.sessions.push({
        sessionId: session.id,
        providerId: session.providerId,
        providerName: providerNameFromSession(session),
        date: session.date.toISOString(),
        normalizedScore: item.normalizedScore,
        rawValue: item.rawValue,
        score: item.score,
      });
      goalMap.set(key, existing);
    }
  }

  for (const activeGoal of activeGoals) {
    const key = activeGoal.goalId;
    if (!goalMap.has(key)) {
      goalMap.set(key, {
        goalKey: key,
        goalId: activeGoal.goalId,
        target: activeGoal.target,
        goal: activeGoal.goal,
        metricType: activeGoal.metricType,
        domains: new Set<InsightDomainName>([domainName(activeGoal.domain)]),
        providers: new Map([
          [
            activeGoal.providerId,
            {
              providerId: activeGoal.providerId,
              providerName: activeGoal.providerName,
              role: "",
            },
          ],
        ]),
        sessions: [],
      });
    }
  }

  return Array.from(goalMap.values()).map((entry) => {
    const sortedSessions = [...entry.sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const scores = sortedSessions
      .map((session) => session.normalizedScore)
      .filter((score): score is number => score !== null);
    const activeGoal =
      (entry.goalId ? activeById.get(entry.goalId) : undefined) ??
      activeByText.get(`${normalizeMatchLabel(entry.target)}|${normalizeMatchLabel(entry.goal)}`);
    const trend = trendFromValues(
      sortedSessions.map((session) => ({
        date: new Date(session.date).getTime(),
        score: session.normalizedScore,
      }))
    ).trend;

    return {
      goalKey: entry.goalKey,
      goalId: entry.goalId,
      target: entry.target,
      goal: entry.goal,
      metricType: entry.metricType,
      domains: Array.from(entry.domains),
      providers: Array.from(entry.providers.values()),
      sessions: sortedSessions,
      averagePerformance: scores.length ? round(average(scores) ?? 0) : null,
      trend,
      currentStatus: activeGoal
        ? activeGoal.isMastered
          ? "mastered"
          : "active"
        : entry.goalId
          ? "inactive"
          : "unlinked",
    };
  });
}

function buildProviderRelationships(
  careTeam: InsightCareTeamMember[],
  activeGoals: InsightActiveGoal[],
  sessions: InsightSession[],
  providerDomainSeries: InsightProviderDomainSeries[],
  performanceTrends: InsightPerformanceTrend[]
): InsightContext["providerRelationships"] {
  return careTeam.map((provider) => {
    const providerSessions = sessions.filter((session) => session.providerId === provider.providerId);
    const activeProviderGoals = activeGoals
      .filter((goal) => goal.providerId === provider.providerId)
      .map(goalReferenceFromActiveGoal);
    const scores = providerSessions.flatMap((session) =>
      session.items
        .map((item) => item.normalizedScore)
        .filter((score): score is number => score !== null)
    );
    const domainAverages = providerDomainSeries
      .filter((series) => series.providerId === provider.providerId)
      .map((series) => ({
        domain: series.domain,
        average: average(
          series.sessions
            .map((session) => session.averageScore)
            .filter((score): score is number => score !== null)
        ),
      }))
      .filter((series): series is { domain: InsightDomainName; average: number } => series.average !== null);
    const strongestAverage = domainAverages.length
      ? Math.max(...domainAverages.map((series) => series.average))
      : null;
    const weakestAverage = domainAverages.length
      ? Math.min(...domainAverages.map((series) => series.average))
      : null;
    const sortedDates = providerSessions.map((session) => session.date).sort((a, b) => a.getTime() - b.getTime());
    const latest = latestSessionDate(sessions);
    const lastSessionDate = sortedDates.at(-1) ?? null;
    const trend = performanceTrends.find((item) => item.providerId === provider.providerId)?.trend;
    const domainsCovered = uniqueValues(
      providerSessions.flatMap((session) => session.items.map((item) => domainName(item.domain)))
    );
    const goalsCovered = uniqueValues(
      providerSessions.flatMap((session) => session.items.map((item) => item.goal))
    );

    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      accountRole: provider.accountRole,
      assignmentRole: provider.assignmentRole,
      totalSessions: providerSessions.length,
      activeGoals: activeProviderGoals,
      domainsWorked: domainsCovered,
      averageNormalizedPerformance: scores.length ? round(average(scores) ?? 0) : null,
      strongestDomains:
        strongestAverage === null
          ? []
          : domainAverages
              .filter((series) => series.average === strongestAverage)
              .map((series) => series.domain),
      weakestDomains:
        weakestAverage === null
          ? []
          : domainAverages
              .filter((series) => series.average === weakestAverage)
              .map((series) => series.domain),
      consistency: scores.length ? round(Math.max(0, 10 - (standardDeviation(scores) ?? 0))) : null,
      trend,
      coverage: {
        goalCount: activeProviderGoals.length,
        domainCount: domainsCovered.length,
        sessionCount: providerSessions.length,
        recentSessionCount: latest
          ? providerSessions.filter((session) => daysBetween(session.date, latest) <= 30).length
          : 0,
        firstSessionAt: sortedDates[0]?.toISOString() ?? null,
        lastSessionAt: lastSessionDate?.toISOString() ?? null,
        hasSessions: providerSessions.length > 0,
        hasActiveGoals: activeProviderGoals.length > 0,
        daysSinceLastSession: latest && lastSessionDate ? daysBetween(lastSessionDate, latest) : null,
        domainsCovered,
        goalsCovered,
      },
    };
  });
}

function buildProviderOverlap(
  careTeam: InsightCareTeamMember[],
  goalRelationships: InsightGoalRelationship[],
  sessions: InsightSession[]
): InsightContext["providerOverlap"] {
  const results: InsightContext["providerOverlap"] = [];

  for (let firstIndex = 0; firstIndex < careTeam.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < careTeam.length; secondIndex += 1) {
      const first = careTeam[firstIndex];
      const second = careTeam[secondIndex];
      const firstGoals = goalRelationships.filter((goal) =>
        goal.providers.some((provider) => provider.providerId === first.providerId)
      );
      const secondGoals = goalRelationships.filter((goal) =>
        goal.providers.some((provider) => provider.providerId === second.providerId)
      );
      const firstGoalKeys = new Set(firstGoals.map((goal) => goal.goalKey));
      const secondGoalKeys = new Set(secondGoals.map((goal) => goal.goalKey));
      const firstDomains = uniqueValues(firstGoals.flatMap((goal) => goal.domains));
      const secondDomains = uniqueValues(secondGoals.flatMap((goal) => goal.domains));
      const relationshipMatches = providerGoalMatches(firstGoals, secondGoals);
      const exactSharedGoals = relationshipMatches.filter((match) => match.matchType === "goalId");
      const relatedTargets = relationshipMatches.filter(
        (match) => match.matchType === "targetGoal" || match.matchType === "targetOnly"
      );
      const relatedDomains = relationshipMatches.filter((match) => match.matchType === "domainOnly");
      const firstSessionsByDate = sessions
        .filter((session) => session.providerId === first.providerId)
        .reduce((map, session) => {
          const key = dateKey(session.date);
          map.set(key, [...(map.get(key) ?? []), session]);
          return map;
        }, new Map<string, InsightSession[]>());
      const secondSessions = sessions.filter((session) => session.providerId === second.providerId);
      const overlappingSessions = secondSessions.flatMap((session) =>
        (firstSessionsByDate.get(dateKey(session.date)) ?? []).map((firstSession) => ({
          providerASessionId: firstSession.id,
          providerBSessionId: session.id,
          date: dateKey(session.date),
        }))
      );

      results.push({
        providerAId: first.providerId,
        providerAName: first.providerName,
        providerBId: second.providerId,
        providerBName: second.providerName,
        sharedGoals: uniqueGoalReferences(
          relationshipMatches
            .filter((match) => match.matchType === "goalId" || match.matchType === "targetGoal")
            .map((match) => match.providerA)
        ),
        sharedTargets: uniqueLabelsByNormalizedKey(relatedTargets.map((match) => match.providerA.target)),
        sharedDomains: firstDomains.filter((domain) =>
          secondDomains.some((secondDomain) => normalizeMatchLabel(secondDomain) === normalizeMatchLabel(domain))
        ),
        exactSharedGoals,
        relatedTargets,
        relatedDomains,
        relationshipMatches,
        overlappingSessions,
        uniqueGoals: {
          providerA: firstGoals
            .filter((goal) => !secondGoalKeys.has(goal.goalKey))
            .map(goalReferenceFromRelationship),
          providerB: secondGoals
            .filter((goal) => !firstGoalKeys.has(goal.goalKey))
            .map(goalReferenceFromRelationship),
        },
        uniqueDomains: {
          providerA: firstDomains.filter((domain) => !secondDomains.includes(domain)),
          providerB: secondDomains.filter((domain) => !firstDomains.includes(domain)),
        },
      });
    }
  }

  return results;
}

function buildDomainRelationships(
  careTeam: InsightCareTeamMember[],
  activeGoals: InsightActiveGoal[],
  sessions: InsightSession[],
  goalRelationships: InsightGoalRelationship[]
): InsightContext["domainRelationships"] {
  const domainMap = new Map<
    InsightRelationshipDomain,
    {
      domain: InsightRelationshipDomain;
      providers: Map<string, { providerId: string; providerName: string; role: string }>;
      activeGoals: InsightGoalReference[];
      sessions: Set<string>;
      recentSessions: Set<string>;
      recentGoals: Set<string>;
      lastMeasuredAt: string | null;
      trends: InsightTrend[];
    }
  >();
  const latest = latestSessionDate(sessions);
  const careTeamById = new Map(careTeam.map((provider) => [provider.providerId, provider]));
  const ensureDomain = (domain: InsightRelationshipDomain) => {
    const existing =
      domainMap.get(domain) ??
      {
        domain,
        providers: new Map<string, { providerId: string; providerName: string; role: string }>(),
        activeGoals: [],
        sessions: new Set<string>(),
        recentSessions: new Set<string>(),
        recentGoals: new Set<string>(),
        lastMeasuredAt: null,
        trends: [],
      };
    domainMap.set(domain, existing);
    return existing;
  };

  for (const domain of [
    "Behavior",
    "Communication",
    "Speech",
    "Occupational",
    "Education",
    "Caregiver",
  ] satisfies InsightRelationshipDomain[]) {
    ensureDomain(domain);
  }

  for (const goal of activeGoals) {
    const provider = careTeamById.get(goal.providerId);
    const domain = relationshipDomainFor(goal.domain, provider?.accountRole);
    ensureDomain(domain).activeGoals.push(goalReferenceFromActiveGoal(goal));
  }

  for (const session of sessions) {
    for (const item of session.items) {
      const domain = relationshipDomainFor(item.domain, providerRoleFromSession(session));
      const entry = ensureDomain(domain);
      entry.providers.set(session.providerId, {
        providerId: session.providerId,
        providerName: providerNameFromSession(session),
        role: providerRoleFromSession(session),
      });
      entry.sessions.add(session.id);
      if (latest && daysBetween(session.date, latest) <= 30) {
        entry.recentSessions.add(session.id);
        entry.recentGoals.add(goalKey(item));
      }
      if (!entry.lastMeasuredAt || session.date.getTime() > new Date(entry.lastMeasuredAt).getTime()) {
        entry.lastMeasuredAt = session.date.toISOString();
      }
    }
  }

  for (const goal of goalRelationships) {
    for (const domain of goal.domains) {
      const relationshipDomain = relationshipDomainFor(domain === "Unspecified" ? null : domain);
      const entry = ensureDomain(relationshipDomain);
      if (goal.trend) entry.trends.push(goal.trend);
    }
  }

  return Array.from(domainMap.values()).map((entry) => ({
    domain: entry.domain,
    providersInvolved: Array.from(entry.providers.values()),
    activeGoals: sortGoalReferences(entry.activeGoals),
    averageTrend: averageTrend(entry.trends),
    recentActivity: {
      lastMeasuredAt: entry.lastMeasuredAt,
      recentSessionCount: entry.recentSessions.size,
      recentGoalCount: entry.recentGoals.size,
    },
    sessionCount: entry.sessions.size,
  }));
}

function buildBehaviorRelationships(
  sessions: InsightSession[],
  abcEvents: InsightAbcEvent[]
): InsightContext["behaviorRelationships"] {
  const behaviorMap = new Map<
    string,
    {
      target: string;
      sessions: Set<string>;
      providers: Map<string, { providerId: string; providerName: string; role: string }>;
      points: Array<{ date: number; score: number | null; rawValue: number | null }>;
    }
  >();

  for (const session of sessions) {
    for (const item of session.items) {
      if (item.domain !== AssessmentDomain.Behavior) continue;
      const existing =
        behaviorMap.get(item.target) ??
        {
          target: item.target,
          sessions: new Set<string>(),
          providers: new Map<string, { providerId: string; providerName: string; role: string }>(),
          points: [],
        };
      existing.sessions.add(session.id);
      existing.providers.set(session.providerId, {
        providerId: session.providerId,
        providerName: providerNameFromSession(session),
        role: providerRoleFromSession(session),
      });
      existing.points.push({
        date: session.date.getTime(),
        score: item.normalizedScore,
        rawValue: item.metricType === MetricType.Frequency ? item.rawValue : null,
      });
      behaviorMap.set(item.target, existing);
    }
  }

  return Array.from(behaviorMap.values()).map((entry) => ({
    target: entry.target,
    sessionsObserved: entry.sessions.size,
    providersObserving: Array.from(entry.providers.values()),
    averageFrequency: average(
      entry.points
        .map((point) => point.rawValue)
        .filter((value): value is number => value !== null)
    ),
    trend: trendFromValues(entry.points.map((point) => ({ date: point.date, score: point.score }))).trend,
    associatedABCEvents: abcEvents.filter((event) => event.behavior === entry.target),
  }));
}

function buildCollaborationMetrics(
  careTeam: InsightCareTeamMember[],
  activeGoals: InsightActiveGoal[],
  goalRelationships: InsightGoalRelationship[],
  sessions: InsightSession[]
): InsightContext["collaborationMetrics"] {
  const latest = latestSessionDate(sessions);
  const sessionProviderIds = new Set(sessions.map((session) => session.providerId));
  const activeGoalProviderIds = new Set(activeGoals.map((goal) => goal.providerId));
  const goalsWithMultipleProviders = goalRelationships.filter((goal) => goal.providers.length > 1);
  const goalsWithOneProvider = goalRelationships.filter((goal) => goal.providers.length === 1);
  const relationshipMatches = careTeam.flatMap((first, firstIndex) =>
    careTeam.slice(firstIndex + 1).flatMap((second) => {
      const firstGoals = goalRelationships.filter((goal) =>
        goal.providers.some((provider) => provider.providerId === first.providerId)
      );
      const secondGoals = goalRelationships.filter((goal) =>
        goal.providers.some((provider) => provider.providerId === second.providerId)
      );
      return providerGoalMatches(firstGoals, secondGoals);
    })
  );
  const exactSharedGoals = relationshipMatches.filter((match) => match.matchType === "goalId");
  const relatedTargets = relationshipMatches.filter(
    (match) => match.matchType === "targetGoal" || match.matchType === "targetOnly"
  );
  const relatedDomains = relationshipMatches.filter((match) => match.matchType === "domainOnly");

  return {
    providersWorkingOnCommonGoals: goalsWithMultipleProviders.map((goal) => ({
      goalKey: goal.goalKey,
      goalId: goal.goalId,
      target: goal.target,
      goal: goal.goal,
      providers: goal.providers,
      matchType: goal.goalId ? "goalId" : "targetGoal",
      confidence: "high",
    })),
    providersWorkingIndependently: careTeam.map((provider) => {
      const independentGoals = goalsWithOneProvider
        .filter((goal) => goal.providers[0]?.providerId === provider.providerId)
        .map(goalReferenceFromRelationship);
      return {
        providerId: provider.providerId,
        providerName: provider.providerName,
        independentGoals,
        independentDomains: uniqueValues(independentGoals.map((goal) => goal.domain)),
      };
    }),
    goalsSpanningMultipleProfessions: goalsWithMultipleProviders
      .filter((goal) => uniqueValues(goal.providers.map((provider) => provider.role)).length > 1)
      .map(goalReferenceFromRelationship),
    goalsIsolatedToOneProvider: goalsWithOneProvider.map(goalReferenceFromRelationship),
    exactSharedGoals,
    relatedTargets,
    relatedDomains,
    careTeamCoverage: careTeam.map((provider) => {
      const providerSessions = sessions.filter((session) => session.providerId === provider.providerId);
      const sortedSessions = [...providerSessions].sort((a, b) => a.date.getTime() - b.date.getTime());
      const lastSession = sortedSessions.at(-1) ?? null;
      const domainsCovered = uniqueValues(
        providerSessions.flatMap((session) => session.items.map((item) => domainName(item.domain)))
      );
      const goalsCovered = uniqueLabelsByNormalizedKey(
        providerSessions.flatMap((session) => session.items.map((item) => item.goal))
      );
      return {
        providerId: provider.providerId,
        providerName: provider.providerName,
        assigned: true,
        hasSessions: providerSessions.length > 0,
        hasActiveGoals: activeGoalProviderIds.has(provider.providerId),
        daysSinceLastSession: latest && lastSession ? daysBetween(lastSession.date, latest) : null,
        domains: domainsCovered,
        domainsCovered,
        goalsCovered,
        sessionCount: providerSessions.length,
      };
    }),
    missingProviderParticipation: careTeam.flatMap(
      (provider): InsightCollaborationMetrics["missingProviderParticipation"] => {
        const providerSessions = sessions.filter(
          (session) => session.providerId === provider.providerId
        );
        if (!sessionProviderIds.has(provider.providerId)) {
          return [
            {
              providerId: provider.providerId,
              providerName: provider.providerName,
              reason: "no_sessions" as const,
            },
          ];
        }
        if (!activeGoalProviderIds.has(provider.providerId)) {
          return [
            {
              providerId: provider.providerId,
              providerName: provider.providerName,
              reason: "no_active_goals" as const,
            },
          ];
        }
        const lastSession = providerSessions
          .map((session) => session.date)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        if (latest && lastSession && daysBetween(lastSession, latest) > 30) {
          return [
            {
              providerId: provider.providerId,
              providerName: provider.providerName,
              reason: "no_recent_sessions" as const,
            },
          ];
        }
        return [];
      }
    ),
  };
}

function buildContinuityMetrics(
  goalRelationships: InsightGoalRelationship[],
  sessions: InsightSession[]
): InsightContext["continuityMetrics"] {
  const sortedSessions = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const latest = latestSessionDate(sessions);
  const sessionsByProvider = new Map<string, InsightSession[]>();
  const providerTransitions: InsightContext["continuityMetrics"]["providerTransitions"] = [];

  for (const session of sortedSessions) {
    sessionsByProvider.set(session.providerId, [...(sessionsByProvider.get(session.providerId) ?? []), session]);
  }

  for (let index = 1; index < sortedSessions.length; index += 1) {
    const previous = sortedSessions[index - 1];
    const current = sortedSessions[index];
    if (previous.providerId !== current.providerId) {
      providerTransitions.push({
        fromProviderId: previous.providerId,
        fromProviderName: providerNameFromSession(previous),
        toProviderId: current.providerId,
        toProviderName: providerNameFromSession(current),
        fromSessionId: previous.id,
        toSessionId: current.id,
        daysBetween: daysBetween(previous.date, current.date),
      });
    }
  }

  const goalContinuity = goalRelationships.map((goal) => {
    const sortedMeasurements = goal.sessions
      .map((session) => ({ ...session, dateObject: new Date(session.date) }))
      .sort((a, b) => a.dateObject.getTime() - b.dateObject.getTime());
    const gaps = sortedMeasurements.slice(1).map((session, index) =>
      daysBetween(sortedMeasurements[index].dateObject, session.dateObject)
    );
    const lastMeasurement = sortedMeasurements.at(-1)?.dateObject ?? null;

    return {
      goalKey: goal.goalKey,
      goalId: goal.goalId,
      target: goal.target,
      goal: goal.goal,
      sessionCount: sortedMeasurements.length,
      maxDaysBetweenMeasurements: gaps.length ? Math.max(...gaps) : null,
      daysSinceLastMeasurement: latest && lastMeasurement ? daysBetween(lastMeasurement, latest) : null,
      providers: goal.providers.map((provider) => provider.providerId),
    };
  });

  return {
    daysBetweenSessions: sortedSessions.slice(1).map((session, index) => {
      const previous = sortedSessions[index];
      return {
        providerId: previous.providerId === session.providerId ? session.providerId : null,
        providerName: previous.providerId === session.providerId ? providerNameFromSession(session) : null,
        fromSessionId: previous.id,
        toSessionId: session.id,
        days: daysBetween(previous.date, session.date),
      };
    }),
    providerGaps: Array.from(sessionsByProvider.entries()).map(([providerId, providerSessions]) => {
      const sortedProviderSessions = [...providerSessions].sort((a, b) => a.date.getTime() - b.date.getTime());
      const gaps = sortedProviderSessions.slice(1).map((session, index) =>
        daysBetween(sortedProviderSessions[index].date, session.date)
      );
      const lastSession = sortedProviderSessions.at(-1);
      return {
        providerId,
        providerName: lastSession ? providerNameFromSession(lastSession) : "",
        maxDaysBetweenSessions: gaps.length ? Math.max(...gaps) : null,
        daysSinceLastSession: latest && lastSession ? daysBetween(lastSession.date, latest) : null,
      };
    }),
    goalContinuity,
    providerTransitions,
    missingFollowUp: goalContinuity
      .filter(
        (goal) =>
          goal.sessionCount === 0 ||
          goal.daysSinceLastMeasurement === null ||
          goal.daysSinceLastMeasurement > 30
      )
      .map((goal) => ({
        goalKey: goal.goalKey,
        goalId: goal.goalId,
        target: goal.target,
        goal: goal.goal,
        daysSinceLastMeasurement: goal.daysSinceLastMeasurement,
      })),
  };
}

function buildClinicalPicture(
  careTeam: InsightCareTeamMember[],
  activeGoals: InsightActiveGoal[],
  goalRelationships: InsightGoalRelationship[],
  sessions: InsightSession[]
): InsightContext["clinicalPicture"] {
  const picture: InsightContext["clinicalPicture"] = {
    behavior: emptyClinicalPictureSection(),
    communication: emptyClinicalPictureSection(),
    occupational: emptyClinicalPictureSection(),
    education: emptyClinicalPictureSection(),
    caregiver: emptyClinicalPictureSection(),
  };
  const latest = latestSessionDate(sessions);
  const providerRoles = new Map(careTeam.map((provider) => [provider.providerId, provider.accountRole]));

  for (const goal of activeGoals) {
    const section = picture[clinicalPictureKeyFor(goal.domain, providerRoles.get(goal.providerId))];
    section.activeTargets.push(goal.target);
  }

  for (const goal of goalRelationships) {
    const reference = goalReferenceFromRelationship(goal);
    const providerRole = goal.providers[0]?.role;
    const section = picture[clinicalPictureKeyFor(goal.domains[0] === "Unspecified" ? null : goal.domains[0], providerRole)];
    const lastMeasured = reference.lastMeasuredAt ? new Date(reference.lastMeasuredAt) : null;
    const firstMeasured = goal.sessions[0]?.date ? new Date(goal.sessions[0].date) : null;
    const recentlyMeasured = latest && lastMeasured ? daysBetween(lastMeasured, latest) <= 30 : false;
    const newlyIntroduced = latest && firstMeasured ? daysBetween(firstMeasured, latest) <= 14 : false;

    if (recentlyMeasured) section.recentlyMeasuredGoals.push(reference);
    if (goal.trend === "up") section.improvingGoals.push(reference);
    if (goal.trend === "down") section.decliningGoals.push(reference);
    if (goal.trend === "flat") section.stableGoals.push(reference);
    if (newlyIntroduced) section.newlyIntroducedGoals.push(reference);
    if (goal.sessions.length < 3) {
      section.lowDataGoals.push(reference);
    }
    if (goal.currentStatus === "inactive" || (goal.currentStatus === "active" && (!lastMeasured || !recentlyMeasured))) {
      section.inactiveGoals.push(reference);
    }
  }

  for (const section of Object.values(picture)) {
    section.activeTargets = uniqueValues(section.activeTargets).sort();
    section.recentlyMeasuredGoals = sortGoalReferences(section.recentlyMeasuredGoals);
    section.improvingGoals = sortGoalReferences(section.improvingGoals);
    section.decliningGoals = sortGoalReferences(section.decliningGoals);
    section.stableGoals = sortGoalReferences(section.stableGoals);
    section.newlyIntroducedGoals = sortGoalReferences(section.newlyIntroducedGoals);
    section.inactiveGoals = sortGoalReferences(section.inactiveGoals);
    section.lowDataGoals = sortGoalReferences(section.lowDataGoals);
  }

  return picture;
}

function averageTrend(trends: InsightTrend[]): InsightTrend | undefined {
  if (trends.length === 0) return undefined;
  const score = trends.reduce((sum, trend) => {
    if (trend === "up") return sum + 1;
    if (trend === "down") return sum - 1;
    return sum;
  }, 0);
  if (score > 0) return "up";
  if (score < 0) return "down";
  return "flat";
}

function buildRelationshipSummary(
  careTeam: InsightCareTeamMember[],
  goalRelationships: InsightGoalRelationship[],
  domainRelationships: InsightDomainRelationship[],
  behaviorRelationships: InsightBehaviorRelationship[],
  providerRelationships: InsightProviderRelationship[],
  collaborationMetrics: InsightCollaborationMetrics,
  continuityMetrics: InsightContinuityMetrics
): InsightContext["relationshipSummary"] {
  const totalGoals = goalRelationships.length;
  const missingFollowUp = continuityMetrics.missingFollowUp.length;

  return {
    totalProviders: careTeam.length,
    exactSharedGoals: collaborationMetrics.exactSharedGoals.length,
    relatedTargets: collaborationMetrics.relatedTargets.length,
    relatedDomains: collaborationMetrics.relatedDomains.length,
    isolatedGoals: collaborationMetrics.goalsIsolatedToOneProvider.length,
    collaborativeGoals: collaborationMetrics.goalsSpanningMultipleProfessions.length,
    activeDomains: uniqueValues(
      domainRelationships
        .filter((domain) => domain.activeGoals.length > 0 || domain.sessionCount > 0)
        .map((domain) => {
          if (domain.domain === "Speech") return "Communication";
          if (domain.domain === "Occupational") return "Regulation";
          if (domain.domain === "Education") return "SkillAcquisition";
          if (domain.domain === "Caregiver") return "Other";
          return domain.domain;
        })
        .filter((domain): domain is InsightDomainName =>
          [
            "Behavior",
            "Communication",
            "Adaptive",
            "Regulation",
            "SkillAcquisition",
            "Other",
            "Unspecified",
          ].includes(domain)
        )
      ),
    recentBehaviorTargets: behaviorRelationships
      .filter((behavior) => behavior.sessionsObserved > 0)
      .map((behavior) => behavior.target),
    providerCoverage: providerRelationships.map((provider) => ({
      providerId: provider.providerId,
      providerName: provider.providerName,
      sessionCount: provider.totalSessions,
      domainCount: provider.domainsWorked.length,
      activeGoalCount: provider.activeGoals.length,
    })),
    continuityScore: totalGoals ? round(((totalGoals - missingFollowUp) / totalGoals) * 100) : null,
  };
}

function buildClientSignalScore(sessions: InsightSession[]): InsightContext["clientSignalScore"] {
  const buckets = new Map<
    string,
    {
      providerId: string;
      providerName: string;
      domain: InsightDomainName;
      weightedScore: number;
      totalWeight: number;
      scores: number[];
      latestDate: Date;
      lowData: boolean;
    }
  >();

  for (const session of sessions) {
    for (const item of session.items) {
      if (item.normalizedScore === null) continue;

      const domain = domainName(item.domain);
      const key = `${session.providerId}|${domain}`;
      const weight =
        item.goalDefinition && Number.isFinite(item.goalDefinition.weight)
          ? item.goalDefinition.weight
          : 1;
      const existing =
        buckets.get(key) ??
        {
          providerId: session.providerId,
          providerName: providerNameFromSession(session),
          domain,
          weightedScore: 0,
          totalWeight: 0,
          scores: [],
          latestDate: session.date,
          lowData: false,
        };

      existing.weightedScore += item.normalizedScore * weight;
      existing.totalWeight += weight;
      existing.scores.push(item.normalizedScore);
      existing.lowData = existing.lowData || item.lowData;
      if (session.date.getTime() > existing.latestDate.getTime()) {
        existing.latestDate = session.date;
      }
      buckets.set(key, existing);
    }
  }

  const bucketValues = Array.from(buckets.values());
  const bucketScores = bucketValues
    .map((bucket) => (bucket.totalWeight > 0 ? bucket.weightedScore / bucket.totalWeight : null))
    .filter((score): score is number => score !== null);

  if (bucketScores.length === 0) {
    return {
      normalizedTotalScore: null,
      trendDirection: "insufficientData",
      confidence: "low",
      contributingDomains: [],
      contributingProviders: [],
      lowDataWarning: true,
      lastUpdatedAt: null,
    };
  }

  const allScores = sessions.flatMap((session) =>
    session.items
      .map((item) => item.normalizedScore)
      .filter((score): score is number => score !== null)
  );
  const trend = trendFromValues(
    sessions.flatMap((session) =>
      session.items.map((item) => ({
        date: session.date.getTime(),
        score: item.normalizedScore,
      }))
    )
  ).trend;
  const providerMap = new Map(
    bucketValues.map((bucket) => [
      bucket.providerId,
      { providerId: bucket.providerId, providerName: bucket.providerName },
    ])
  );
  const lastUpdatedAt = new Date(
    Math.max(...bucketValues.map((bucket) => bucket.latestDate.getTime()))
  ).toISOString();

  return {
    normalizedTotalScore: round((average(bucketScores) ?? 0) * 10),
    trendDirection: trend ?? (allScores.length < 2 ? "insufficientData" : "flat"),
    confidence: allScores.length >= 10 ? "high" : allScores.length >= 3 ? "medium" : "low",
    contributingDomains: uniqueValues(bucketValues.map((bucket) => bucket.domain)),
    contributingProviders: Array.from(providerMap.values()),
    lowDataWarning: bucketValues.some((bucket) => bucket.lowData) || allScores.length < 3,
    lastUpdatedAt,
  };
}

function buildDomainContributions(sessions: InsightSession[]): InsightContext["domainContributions"] {
  const contributionMap = new Map<
    string,
    {
      providerId: string;
      providerName: string;
      providerRole: string;
      domain: InsightDomainName;
      assessmentCount: number;
      sessions: Set<string>;
      scores: number[];
      goalsCovered: Set<string>;
      targetsCovered: Set<string>;
      lastContributionDate: Date | null;
    }
  >();

  for (const session of sessions) {
    for (const item of session.items) {
      const domain = domainName(item.domain);
      const key = `${session.providerId}|${domain}`;
      const existing =
        contributionMap.get(key) ??
        {
          providerId: session.providerId,
          providerName: providerNameFromSession(session),
          providerRole: providerRoleFromSession(session),
          domain,
          assessmentCount: 0,
          sessions: new Set<string>(),
          scores: [],
          goalsCovered: new Set<string>(),
          targetsCovered: new Set<string>(),
          lastContributionDate: null,
        };

      existing.assessmentCount += 1;
      existing.sessions.add(session.id);
      if (item.normalizedScore !== null) {
        existing.scores.push(item.normalizedScore);
      }
      existing.goalsCovered.add(item.goal);
      existing.targetsCovered.add(item.target);
      if (!existing.lastContributionDate || session.date.getTime() > existing.lastContributionDate.getTime()) {
        existing.lastContributionDate = session.date;
      }
      contributionMap.set(key, existing);
    }
  }

  return Array.from(contributionMap.values())
    .map((contribution) => ({
      providerId: contribution.providerId,
      providerName: contribution.providerName,
      providerRole: contribution.providerRole,
      domain: contribution.domain,
      assessmentCount: contribution.assessmentCount,
      sessionCount: contribution.sessions.size,
      normalizedAverage:
        contribution.scores.length > 0 ? round(average(contribution.scores) ?? 0) : null,
      goalsCovered: uniqueLabelsByNormalizedKey(Array.from(contribution.goalsCovered)),
      targetsCovered: uniqueLabelsByNormalizedKey(Array.from(contribution.targetsCovered)),
      lastContributionDate: contribution.lastContributionDate?.toISOString() ?? null,
    }))
    .sort((first, second) => {
      if (second.assessmentCount !== first.assessmentCount) {
        return second.assessmentCount - first.assessmentCount;
      }
      return (second.normalizedAverage ?? 0) - (first.normalizedAverage ?? 0);
    });
}

function contributionDomainMatchesQuestion(
  contribution: InsightDomainContribution,
  parsed: ParsedInsightQuestion
) {
  if (!parsed.domainFocus?.length) {
    return true;
  }

  return parsed.domainFocus.some((domain) => domain === contribution.domain);
}

function buildQuestionContributors(
  domainContributions: InsightDomainContribution[],
  parsed: ParsedInsightQuestion,
  sessions: InsightSession[]
): InsightContext["questionContributors"] {
  const latest = latestSessionDate(sessions);
  const relevantContributions = domainContributions.filter((contribution) =>
    contributionDomainMatchesQuestion(contribution, parsed)
  );
  const matchedDomainCountByProvider = new Map<string, number>();

  for (const contribution of relevantContributions) {
    matchedDomainCountByProvider.set(
      contribution.providerId,
      (matchedDomainCountByProvider.get(contribution.providerId) ?? 0) + 1
    );
  }

  return relevantContributions
    .map((contribution) => {
      const daysSinceContribution =
        latest && contribution.lastContributionDate
          ? daysBetween(new Date(contribution.lastContributionDate), latest)
          : null;
      const recencyScore =
        daysSinceContribution === null ? 0 : Math.max(0, 10 - Math.min(10, daysSinceContribution / 7));
      const domainCoverage = matchedDomainCountByProvider.get(contribution.providerId) ?? 1;
      const assessmentWeight = Math.min(20, contribution.assessmentCount * 2);
      const sessionWeight = Math.min(15, contribution.sessionCount * 3);
      const coverageWeight = Math.min(10, domainCoverage * 2);
      const scoreWeight = contribution.normalizedAverage ?? 0;
      const relevanceScore = round(assessmentWeight + sessionWeight + recencyScore + coverageWeight + scoreWeight);

      return {
        ...contribution,
        relevanceScore,
        matchedDomains: parsed.domainFocus?.length ? [contribution.domain] : [contribution.domain],
        evidenceWeight: {
          assessmentCount: contribution.assessmentCount,
          sessionCount: contribution.sessionCount,
          recencyScore: round(recencyScore),
          domainCoverage,
        },
      };
    })
    .sort((first, second) => {
      if (second.relevanceScore !== first.relevanceScore) {
        return second.relevanceScore - first.relevanceScore;
      }
      return second.assessmentCount - first.assessmentCount;
    });
}

function buildRelationshipMetrics(sessions: InsightSession[]): InsightContext["relationshipMetrics"] {
  const coverageByProvider = new Map<
    string,
    {
      providerId: string;
      providerName: string;
      sessions: Set<string>;
      domains: Set<AssessmentDomain | "Unspecified">;
      goals: Set<string>;
      targets: Set<string>;
    }
  >();

  for (const session of sessions) {
    const existing =
      coverageByProvider.get(session.providerId) ??
      {
        providerId: session.providerId,
        providerName: `${session.provider.firstName} ${session.provider.lastName}`,
        sessions: new Set<string>(),
        domains: new Set<AssessmentDomain | "Unspecified">(),
        goals: new Set<string>(),
        targets: new Set<string>(),
      };

    existing.sessions.add(session.id);
    for (const item of session.items) {
      existing.domains.add(item.domain ?? "Unspecified");
      existing.goals.add(item.goal);
      existing.targets.add(item.target);
    }
    coverageByProvider.set(session.providerId, existing);
  }

  const coverage = Array.from(coverageByProvider.values());
  const providerPairs: InsightContext["relationshipMetrics"]["providerPairs"] = [];

  for (let firstIndex = 0; firstIndex < coverage.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < coverage.length; secondIndex += 1) {
      const first = coverage[firstIndex];
      const second = coverage[secondIndex];
      providerPairs.push({
        providerAId: first.providerId,
        providerBId: second.providerId,
        sharedTargets: Array.from(first.targets).filter((target) => second.targets.has(target)),
        sharedGoals: Array.from(first.goals).filter((goal) => second.goals.has(goal)),
      });
    }
  }

  return {
    providerPairs,
    providerCoverage: coverage.map((provider) => ({
      providerId: provider.providerId,
      providerName: provider.providerName,
      sessions: provider.sessions.size,
      domains: Array.from(provider.domains),
      goals: Array.from(provider.goals),
    })),
  };
}
