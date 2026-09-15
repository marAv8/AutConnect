export type NativeMetricType =
  | "Percentage"
  | "Duration"
  | "Frequency"
  | "Subjective";

export type NativeComparison = "LessThan" | "GreaterThan" | "Equal";

export type NativeCriterionStatus = "met" | "notMet" | "unknown";

export type NativeCriterionInput = {
  metricType: string;
  rawValue: number | null;
  score: number | null;
  targetValue: number | null;
  comparison: string | null;
  configuredMetricType?: string | null;
  metadataConsistent?: boolean;
};

export type CriterionSessionInput = NativeCriterionInput & {
  entryId: string;
  occurredAt: string;
  status: string;
  completedAt: string | null;
  providerId: string;
  goalKey: string;
  configurationKey: string;
};

export type CriterionStreak = {
  consecutiveCriterionSessions: number;
  criterionSourceRecordIds: string[];
};

const SUPPORTED_METRICS = new Set<NativeMetricType>([
  "Percentage",
  "Duration",
  "Frequency",
  "Subjective",
]);

const SUPPORTED_COMPARISONS = new Set<NativeComparison>([
  "LessThan",
  "GreaterThan",
  "Equal",
]);

/**
 * Evaluates only the configured native measurement value. It deliberately has
 * no normalized-score or text-inference fallback.
 */
export function evaluateNativeCriterion(
  input: NativeCriterionInput
): NativeCriterionStatus {
  if (
    input.metadataConsistent === false ||
    !SUPPORTED_METRICS.has(input.metricType as NativeMetricType) ||
    (input.configuredMetricType !== undefined &&
      input.configuredMetricType !== null &&
      input.configuredMetricType !== input.metricType) ||
    typeof input.targetValue !== "number" ||
    !Number.isFinite(input.targetValue) ||
    !SUPPORTED_COMPARISONS.has(input.comparison as NativeComparison)
  ) {
    return "unknown";
  }

  const value =
    input.metricType === "Subjective" ? input.score : input.rawValue;
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  if (
    (input.metricType === "Percentage" &&
      (input.targetValue < 0 ||
        input.targetValue > 100 ||
        value < 0 ||
        value > 100)) ||
    ((input.metricType === "Duration" || input.metricType === "Frequency") &&
      (input.targetValue < 0 || value < 0)) ||
    (input.metricType === "Subjective" && value < 0)
  ) {
    return "unknown";
  }

  if (input.comparison === "LessThan") {
    return value < input.targetValue ? "met" : "notMet";
  }
  if (input.comparison === "GreaterThan") {
    return value > input.targetValue ? "met" : "notMet";
  }
  return value === input.targetValue ? "met" : "notMet";
}

/** Counts a trailing streak of distinct completed Entry records in one series. */
export function calculateCriterionStreak(
  sessions: CriterionSessionInput[]
): CriterionStreak {
  const eligible = sessions
    .filter(
      (session) =>
        session.status === "COMPLETED" &&
        session.entryId.trim().length > 0
    )
    .sort((left, right) => {
      const timeDifference =
        Date.parse(right.completedAt ?? right.occurredAt) -
        Date.parse(left.completedAt ?? left.occurredAt);
      return timeDifference || right.entryId.localeCompare(left.entryId);
    });

  const newest = eligible[0];
  if (!newest) {
    return { consecutiveCriterionSessions: 0, criterionSourceRecordIds: [] };
  }

  const seenEntries = new Set<string>();
  const sourceRecordIds: string[] = [];
  for (const session of eligible) {
    if (seenEntries.has(session.entryId)) continue;
    seenEntries.add(session.entryId);

    if (
      session.providerId !== newest.providerId ||
      session.goalKey !== newest.goalKey ||
      session.configurationKey !== newest.configurationKey
    ) {
      break;
    }

    if (evaluateNativeCriterion(session) !== "met") break;
    sourceRecordIds.push(session.entryId);
  }

  return {
    consecutiveCriterionSessions: sourceRecordIds.length,
    criterionSourceRecordIds: sourceRecordIds.reverse(),
  };
}
