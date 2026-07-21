import { ComparisonType, MetricType } from "@prisma/client";

type GoalDefinitionLike = {
  metricType: MetricType;
  targetValue: number | null;
  comparison: ComparisonType | null;
  weight: number;
  target?: string | null;
  goal?: string | null;
};

type AssessmentItemLike = {
  metricType: MetricType;
  score: number | null;
  rawValue: number | null;
  target?: string | null;
  goal?: string | null;
  goalDefinition?: GoalDefinitionLike | null;
};

function clampSuccess(value: number) {
  return Math.max(0, Math.min(1, value));
}

type Direction = "higher" | "lower" | "target";

function normalizedText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function directionFromComparison(comparison: ComparisonType | null | undefined): Direction | null {
  if (comparison === ComparisonType.LessThan) return "lower";
  if (comparison === ComparisonType.GreaterThan) return "higher";
  if (comparison === ComparisonType.Equal) return "target";
  return null;
}

function inferDirection(item: AssessmentItemLike, goalDefinition: GoalDefinitionLike | null): Direction {
  const comparisonDirection = directionFromComparison(goalDefinition?.comparison);
  if (comparisonDirection) {
    return comparisonDirection;
  }

  const text = normalizedText(item.target, item.goal, goalDefinition?.target, goalDefinition?.goal);
  if (
    /\b(aggression|elopement|self injury|self-injury|property destruction|tantrum|meltdown|screaming|hitting|biting|kicking|disfluenc|error|latency|prompt|cue|assistance|support|intensity|dependent)\b/.test(
      text
    )
  ) {
    return "lower";
  }

  if (
    /\b(manding|request|communication|accuracy|completion|fidelity|independence|independent|attention|engagement|tolerance|participation|repetition|opportunit|intelligibility|maintenance|generalization)\b/.test(
      text
    )
  ) {
    return "higher";
  }

  return "higher";
}

function ordinalRange(item: AssessmentItemLike, goalDefinition: GoalDefinitionLike | null) {
  const text = normalizedText(item.target, item.goal, goalDefinition?.target, goalDefinition?.goal);
  if (/\b(prompt|cue|assistance|support|dependent)\b/.test(text)) {
    return { min: 0, max: 5 };
  }

  if (/\b(participation|tolerance|intensity)\b/.test(text)) {
    return { min: 1, max: 5 };
  }

  return { min: 0, max: 10 };
}

function normalizeByDirection(value: number, direction: Direction, min: number, max: number) {
  if (max <= min) return null;
  const progress = (value - min) / (max - min);

  if (direction === "lower") {
    return clampSuccess(1 - progress);
  }

  if (direction === "target") {
    const midpoint = min + (max - min) / 2;
    const distance = Math.abs(value - midpoint);
    return clampSuccess(1 - distance / ((max - min) / 2));
  }

  return clampSuccess(progress);
}

export function normalizeItem(
  item: AssessmentItemLike,
  goalDefinition: GoalDefinitionLike | null = item.goalDefinition ?? null
) {
  const direction = inferDirection(item, goalDefinition);

  if (item.metricType === MetricType.Percentage && typeof item.rawValue === "number") {
    return normalizeByDirection(item.rawValue, direction, 0, 100);
  }

  if (item.metricType === MetricType.Subjective && typeof item.score === "number") {
    const range = ordinalRange(item, goalDefinition);
    return normalizeByDirection(item.score, direction, range.min, range.max);
  }

  if (item.metricType === MetricType.Percentage && typeof item.score === "number") {
    return normalizeByDirection(item.score, direction, 0, 10);
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

  if (
    (item.metricType === MetricType.Duration || item.metricType === MetricType.Frequency) &&
    typeof item.rawValue === "number"
  ) {
    if (direction === "lower") {
      return clampSuccess(1 - item.rawValue / 10);
    }

    if (direction === "higher") {
      return clampSuccess(item.rawValue / 10);
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
