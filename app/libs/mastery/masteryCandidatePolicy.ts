import { evaluateNativeCriterion } from "./nativeCriterion";

export type MasteryCandidateMetricType =
  | "Percentage"
  | "Duration"
  | "Frequency"
  | "Subjective";

export type MasteryCandidateComparison =
  | "AtLeast"
  | "LessThan"
  | "GreaterThan"
  | "Equal";

export type MasteryCandidateReason =
  | "percentageAtLeast85"
  | "configuredNativeCriterion"
  | "insufficientSessions"
  | "latestSessionDidNotQualify"
  | "missingConfiguration"
  | "inconsistentConfiguration"
  | "unsupportedSubjectiveScale"
  | "unknownSessionMeasurement";

export type MasteryCandidateResult = {
  status: "candidate" | "notCandidate" | "unknown";
  ruleStatus: "configured" | "missing" | "inconsistent";
  metricType: MasteryCandidateMetricType;
  threshold?: number;
  comparison?: MasteryCandidateComparison;
  requiredConsecutiveSessions: number;
  consecutiveQualifyingSessions: number;
  evidenceEntryIds: string[];
  reason: MasteryCandidateReason;
};

export type MasteryCandidateSession = {
  entryId: string;
  occurredAt: string;
  completedAt: string | null;
  status: string;
  providerId: string;
  goalId: string;
  metricType: MasteryCandidateMetricType;
  rawValue: number | null;
  score: number | null;
  normalizedScore?: number | null;
  configuration?: {
    percentageMasteryThreshold?: number | null;
    targetValue: number | null;
    comparison: "LessThan" | "GreaterThan" | "Equal" | null;
    configuredMetricType?: MasteryCandidateMetricType | null;
    metadataConsistent?: boolean;
  };
};

export type MasteryCandidatePolicyInput = {
  providerId: string;
  goalId: string;
  metricType: MasteryCandidateMetricType;
  percentageMasteryThreshold?: number | null;
  targetValue: number | null;
  comparison: "LessThan" | "GreaterThan" | "Equal" | null;
  requiredConsecutiveSessions?: number;
  metadataConsistent?: boolean;
  sessions: MasteryCandidateSession[];
};

const DEFAULT_REQUIRED_CONSECUTIVE_SESSIONS = 3;
const MAX_REQUIRED_CONSECUTIVE_SESSIONS = 20;
const DEFAULT_PERCENTAGE_MASTERY_THRESHOLD = 85;

type Qualification = "qualifies" | "doesNotQualify" | "unknown";

type ConfiguredRule = {
  ruleStatus: MasteryCandidateResult["ruleStatus"];
  threshold?: number;
  comparison?: MasteryCandidateComparison;
  qualificationReason:
    | "percentageAtLeast85"
    | "configuredNativeCriterion";
  errorReason?:
    | "missingConfiguration"
    | "inconsistentConfiguration"
    | "unsupportedSubjectiveScale";
};

/**
 * Pure Stage 5A policy. This establishes candidacy evidence only; it does not
 * confirm mastery, maintenance, or generalization and performs no writes.
 */
export function evaluateMasteryCandidate(
  input: MasteryCandidatePolicyInput
): MasteryCandidateResult {
  const requiredConsecutiveSessions =
    input.requiredConsecutiveSessions ?? DEFAULT_REQUIRED_CONSECUTIVE_SESSIONS;
  if (
    !Number.isInteger(requiredConsecutiveSessions) ||
    requiredConsecutiveSessions < 1 ||
    requiredConsecutiveSessions > MAX_REQUIRED_CONSECUTIVE_SESSIONS
  ) {
    return result(input.metricType, {
      status: "unknown",
      ruleStatus: "inconsistent",
      reason: "inconsistentConfiguration",
    });
  }
  const rule = configuredRule(input);
  if (rule.errorReason) {
    return result(input.metricType, {
      status: "unknown",
      ruleStatus: rule.ruleStatus,
      reason: rule.errorReason,
      ...(rule.threshold !== undefined ? { threshold: rule.threshold } : {}),
      ...(rule.comparison ? { comparison: rule.comparison } : {}),
    }, requiredConsecutiveSessions);
  }

  const entries = completedEntries(input.sessions);
  let stoppedByUnknownLatest = false;
  const evidenceEntryIds: string[] = [];

  for (const entry of entries) {
    const qualification = entryQualification(input, entry, rule);
    if (qualification === "unknown") {
      stoppedByUnknownLatest = evidenceEntryIds.length === 0;
      break;
    }
    if (qualification === "doesNotQualify") {
      if (evidenceEntryIds.length === 0) {
        return result(input.metricType, {
          status: "notCandidate",
          ruleStatus: "configured",
          reason: "latestSessionDidNotQualify",
          threshold: rule.threshold,
          comparison: rule.comparison,
        }, requiredConsecutiveSessions);
      }
      break;
    }
    evidenceEntryIds.push(entry[0].entryId);
  }

  if (stoppedByUnknownLatest) {
    const inconsistentLatest = entries[0]?.some(
      (session) => !sessionMatchesSeries(input, session)
    );
    return result(input.metricType, {
      status: "unknown",
      ruleStatus: inconsistentLatest ? "inconsistent" : "configured",
      reason: inconsistentLatest
        ? "inconsistentConfiguration"
        : "unknownSessionMeasurement",
      threshold: rule.threshold,
      comparison: rule.comparison,
    }, requiredConsecutiveSessions);
  }

  const chronologicalEvidence = evidenceEntryIds.reverse();
  const candidate =
    chronologicalEvidence.length >= requiredConsecutiveSessions;
  return result(input.metricType, {
    status: candidate ? "candidate" : "notCandidate",
    ruleStatus: "configured",
    reason: candidate ? rule.qualificationReason : "insufficientSessions",
    threshold: rule.threshold,
    comparison: rule.comparison,
    consecutiveQualifyingSessions: chronologicalEvidence.length,
    evidenceEntryIds: chronologicalEvidence,
  }, requiredConsecutiveSessions);
}

function configuredRule(input: MasteryCandidatePolicyInput): ConfiguredRule {
  if (input.metricType === "Subjective") {
    return {
      ruleStatus: "missing",
      qualificationReason: "configuredNativeCriterion",
      errorReason: "unsupportedSubjectiveScale",
    };
  }

  if (input.metadataConsistent === false) {
    return {
      ruleStatus: "inconsistent",
      qualificationReason:
        input.metricType === "Percentage"
          ? "percentageAtLeast85"
          : "configuredNativeCriterion",
      errorReason: "inconsistentConfiguration",
    };
  }

  if (input.metricType === "Percentage") {
    const configuredThreshold = input.percentageMasteryThreshold;
    if (
      configuredThreshold !== undefined &&
      configuredThreshold !== null &&
      (typeof configuredThreshold !== "number" ||
        !Number.isFinite(configuredThreshold) ||
        configuredThreshold < 0 ||
        configuredThreshold > 100)
    ) {
      return {
        ruleStatus: "inconsistent",
        qualificationReason: "percentageAtLeast85",
        errorReason: "inconsistentConfiguration",
      };
    }
    return {
      ruleStatus: "configured",
      threshold: Math.max(
        DEFAULT_PERCENTAGE_MASTERY_THRESHOLD,
        configuredThreshold ?? DEFAULT_PERCENTAGE_MASTERY_THRESHOLD
      ),
      comparison: "AtLeast",
      qualificationReason: "percentageAtLeast85",
    };
  }

  if (input.targetValue === null || input.comparison === null) {
    return {
      ruleStatus: "missing",
      qualificationReason: "configuredNativeCriterion",
      errorReason: "missingConfiguration",
    };
  }
  if (
    typeof input.targetValue !== "number" ||
    !Number.isFinite(input.targetValue) ||
    input.targetValue < 0 ||
    !isNativeComparison(input.comparison)
  ) {
    return {
      ruleStatus: "inconsistent",
      qualificationReason: "configuredNativeCriterion",
      errorReason: "inconsistentConfiguration",
    };
  }

  return {
    ruleStatus: "configured",
    threshold: input.targetValue,
    comparison: input.comparison,
    qualificationReason: "configuredNativeCriterion",
  };
}

function completedEntries(sessions: MasteryCandidateSession[]) {
  const groups = new Map<string, MasteryCandidateSession[]>();
  for (const session of sessions) {
    if (session.status !== "COMPLETED" || !session.entryId.trim()) continue;
    const records = groups.get(session.entryId) ?? [];
    records.push(session);
    groups.set(session.entryId, records);
  }
  return [...groups.values()].sort((left, right) => {
    const timeDifference = entryTime(right) - entryTime(left);
    return timeDifference || right[0].entryId.localeCompare(left[0].entryId);
  });
}

function entryTime(records: MasteryCandidateSession[]) {
  return Math.max(
    ...records.map((record) =>
      Date.parse(record.completedAt ?? record.occurredAt)
    )
  );
}

function entryQualification(
  input: MasteryCandidatePolicyInput,
  records: MasteryCandidateSession[],
  rule: ConfiguredRule
): Qualification {
  const qualifications = records.map((record) =>
    sessionQualification(input, record, rule)
  );
  const distinct = new Set(qualifications);
  return distinct.size === 1 ? qualifications[0] : "unknown";
}

function sessionQualification(
  input: MasteryCandidatePolicyInput,
  session: MasteryCandidateSession,
  rule: ConfiguredRule
): Qualification {
  if (!sessionMatchesSeries(input, session)) {
    return "unknown";
  }

  if (input.metricType === "Percentage") {
    if (
      typeof session.rawValue !== "number" ||
      !Number.isFinite(session.rawValue) ||
      session.rawValue < 0 ||
      session.rawValue > 100 ||
      rule.threshold === undefined
    ) {
      return "unknown";
    }
    return session.rawValue >= rule.threshold
      ? "qualifies"
      : "doesNotQualify";
  }

  const nativeStatus = evaluateNativeCriterion({
    metricType: input.metricType,
    rawValue: session.rawValue,
    score: session.score,
    targetValue: input.targetValue,
    comparison: input.comparison,
    configuredMetricType: session.configuration?.configuredMetricType,
    metadataConsistent:
      input.metadataConsistent !== false &&
      session.configuration?.metadataConsistent !== false,
  });
  if (nativeStatus === "met") return "qualifies";
  if (nativeStatus === "notMet") return "doesNotQualify";
  return "unknown";
}

function sessionMatchesSeries(
  input: MasteryCandidatePolicyInput,
  session: MasteryCandidateSession
) {
  return (
    session.providerId === input.providerId &&
    session.goalId === input.goalId &&
    session.metricType === input.metricType &&
    configurationMatches(input, session)
  );
}

function configurationMatches(
  input: MasteryCandidatePolicyInput,
  session: MasteryCandidateSession
) {
  const configuration = session.configuration;
  if (!configuration) return true;
  return (
    configuration.metadataConsistent !== false &&
    (configuration.configuredMetricType === undefined ||
      configuration.configuredMetricType === null ||
      configuration.configuredMetricType === input.metricType) &&
    (input.metricType !== "Percentage" ||
      (configuration.percentageMasteryThreshold ?? null) ===
        (input.percentageMasteryThreshold ?? null)) &&
    (input.metricType === "Percentage" ||
      (configuration.targetValue === input.targetValue &&
        configuration.comparison === input.comparison))
  );
}

function isNativeComparison(
  value: MasteryCandidatePolicyInput["comparison"]
): value is "LessThan" | "GreaterThan" | "Equal" {
  return value === "LessThan" || value === "GreaterThan" || value === "Equal";
}

function result(
  metricType: MasteryCandidateMetricType,
  values: Omit<
    MasteryCandidateResult,
    | "metricType"
    | "requiredConsecutiveSessions"
    | "consecutiveQualifyingSessions"
    | "evidenceEntryIds"
  > & {
    consecutiveQualifyingSessions?: number;
    evidenceEntryIds?: string[];
  },
  requiredConsecutiveSessions = DEFAULT_REQUIRED_CONSECUTIVE_SESSIONS
): MasteryCandidateResult {
  return {
    metricType,
    requiredConsecutiveSessions,
    consecutiveQualifyingSessions: values.consecutiveQualifyingSessions ?? 0,
    evidenceEntryIds: values.evidenceEntryIds ?? [],
    ...values,
  };
}
