import { ComparisonType, MetricType } from "@prisma/client";

type GoalDefinitionLike = {
  metricType: MetricType;
  targetValue: number | null;
  comparison: ComparisonType | null;
  weight: number;
};

type AssessmentItemLike = {
  metricType: MetricType;
  score: number | null;
  rawValue: number | null;
  goalDefinition?: GoalDefinitionLike | null;
};

function clampSuccess(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function normalizeItem(
  item: AssessmentItemLike,
  goalDefinition: GoalDefinitionLike | null = item.goalDefinition ?? null
) {
  if (item.metricType === MetricType.Percentage && typeof item.rawValue === "number") {
    return clampSuccess(item.rawValue / 100);
  }

  if (item.metricType === MetricType.Subjective && typeof item.score === "number") {
    return clampSuccess(item.score / 10);
  }

  if (item.metricType === MetricType.Percentage && typeof item.score === "number") {
    return clampSuccess(item.score / 10);
  }

  if (
    (item.metricType === MetricType.Duration || item.metricType === MetricType.Frequency) &&
    goalDefinition &&
    typeof goalDefinition.targetValue === "number" &&
    goalDefinition.targetValue > 0 &&
    typeof item.rawValue === "number" &&
    item.rawValue > 0
  ) {
    switch (goalDefinition.comparison) {
      case ComparisonType.LessThan:
        return clampSuccess(goalDefinition.targetValue / item.rawValue);
      case ComparisonType.GreaterThan:
        return clampSuccess(item.rawValue / goalDefinition.targetValue);
      case ComparisonType.Equal:
        return clampSuccess(
          1 - Math.abs(item.rawValue - goalDefinition.targetValue) / goalDefinition.targetValue
        );
      default:
        return null;
    }
  }

  return null;
}

export function calculateSessionScore(items: AssessmentItemLike[]) {
  let weightedSuccess = 0;
  let totalWeight = 0;

  for (const item of items) {
    const success = normalizeItem(item, item.goalDefinition ?? null);
    if (success === null) {
      continue;
    }

    const weight =
      item.goalDefinition && Number.isFinite(item.goalDefinition.weight)
        ? item.goalDefinition.weight
        : 1;

    weightedSuccess += success * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return {
      finalSuccess: null,
      finalScore: null,
    };
  }

  const finalSuccess = weightedSuccess / totalWeight;
  const finalScore = Math.max(1, Math.min(10, Math.round(finalSuccess * 10)));

  return {
    finalSuccess,
    finalScore,
  };
}
