/**
 * Shared contract for the supervisor Insights read model.
 * The API builder, deterministic analysis helpers, and Insights engine all use
 * this shape so the UI receives one stable longitudinal client context.
 */
import type { AssessmentDomain, ComparisonType, MetricType } from "@prisma/client";
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

export type InsightGoalReference = {
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

export type InsightRelationshipMatch = {
  matchType: InsightMatchType;
  confidence: InsightMatchConfidence;
  providerA: InsightGoalReference;
  providerB: InsightGoalReference;
};

export type InsightDomainContribution = {
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

export type InsightQuestionContributor = InsightDomainContribution & {
  relevanceScore: number;
  matchedDomains: InsightDomainName[];
  evidenceWeight: {
    assessmentCount: number;
    sessionCount: number;
    recencyScore: number;
    domainCoverage: number;
  };
};

export type InsightAbcEvent = {
  id: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  providerId: string;
  providerName: string;
  date: string;
  linkedSessionId: string | null;
};

export type InsightClinicalEvent = {
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
