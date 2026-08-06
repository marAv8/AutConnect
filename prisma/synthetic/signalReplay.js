/**
 * Transparent first-pass signal evaluator for chronological fixture replay.
 *
 * It reads source records only. Expected labels are deliberately supplied to a
 * separate comparison function so the evaluator cannot use them as features.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function day(value) {
  return value.slice(0, 10);
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizedValue(item) {
  if (item.metricType === "Frequency" && typeof item.rawValue === "number") {
    return Math.max(0, 1 - Math.min(item.rawValue, 4) / 4);
  }
  if (item.metricType === "Duration" && typeof item.rawValue === "number") {
    return Math.max(0, 1 - Math.min(item.rawValue, 60) / 60);
  }
  if (typeof item.score === "number") return Math.max(0, Math.min(1, item.score / 4));
  return null;
}

function recordsByDay(sourceRecords) {
  const grouped = new Map();
  for (const record of sourceRecords) {
    const recordDay = day(record.date);
    const list = grouped.get(recordDay) ?? [];
    list.push(record);
    grouped.set(recordDay, list);
  }
  return grouped;
}

function addHistory(history, goalKey, value) {
  const values = history.get(goalKey) ?? [];
  values.push(value);
  if (values.length > 5) values.shift();
  history.set(goalKey, values);
}

function extractDailyFeatures(records, history) {
  const entries = records.filter((record) => record.recordType === "entry");
  const values = [];
  const deltas = [];
  const frequencyValues = [];
  const providerRoles = new Set();
  let hasStableHomeContext = false;
  let hasHighIntensityAbc = false;
  let hasCriticalSafetyEvent = false;
  let hasCoordinationStrain = false;
  let hasIndependenceMilestone = false;
  const transitionLatencies = [];
  const refusalFrequencies = [];

  for (const entry of entries) {
    providerRoles.add(entry.role);
    const text = [
      entry.note,
      ...entry.abcObservations.flatMap((abc) => [abc.antecedent, abc.behavior, abc.consequence]),
    ]
      .filter(Boolean)
      .join(" ");

    if (
      entry.role === "Caregiver" &&
      /\b(good|ate well|smooth|calm|completed homework|family interaction remained stable)\b/i.test(text)
    ) {
      hasStableHomeContext = true;
    }
    if (/\b(cried and screamed|administrator checked|additional support|property destruction|hit|bite|kick)\b/i.test(text)) {
      hasHighIntensityAbc = true;
    }
    if (
      /\b(entered the parking area|entered traffic|lost direct supervision|eloped beyond the secured area|emergency services|injury requiring medical|unsafe physical hold)\b/i.test(
        text
      )
    ) {
      hasCriticalSafetyEvent = true;
    }
    if (
      /\b(scheduled BT support was interrupted|provider roles.*unclear|assigned BT coverage|responsibility remained unclear|supervisor response was requested)\b/i.test(
        text
      )
    ) {
      hasCoordinationStrain = true;
    }

    for (const item of entry.items) {
      if (
        item.metricType === "Duration" &&
        typeof item.rawValue === "number" &&
        /transition/i.test(item.target)
      ) {
        transitionLatencies.push(item.rawValue);
      }
      if (
        item.metricType === "Frequency" &&
        typeof item.rawValue === "number" &&
        /refusal|collapse|transition/i.test(item.target)
      ) {
        refusalFrequencies.push(item.rawValue);
      }
      const value = normalizedValue(item);
      if (value === null) continue;
      values.push(value);
      if (item.metricType === "Frequency" && typeof item.rawValue === "number") {
        frequencyValues.push(item.rawValue);
      }
      const prior = history.get(item.goalKey) ?? [];
      if (
        calibrationIndependentScore(item, value) &&
        prior.length >= 2 &&
        prior.every((priorValue) => priorValue < 0.99)
      ) {
        hasIndependenceMilestone = true;
      }
      if (prior.length >= 2) deltas.push(value - average(prior));
    }
  }

  return {
    entries,
    normalizedPerformance: average(values),
    trendDelta: average(deltas),
    maximumFrequency: frequencyValues.length > 0 ? Math.max(...frequencyValues) : null,
    providerRoles: Array.from(providerRoles).sort(),
    hasStableHomeContext,
    hasHighIntensityAbc,
    hasCriticalSafetyEvent,
    hasCoordinationStrain,
    hasIndependenceMilestone,
    maximumTransitionLatency:
      transitionLatencies.length > 0 ? Math.max(...transitionLatencies) : null,
    maximumRefusalFrequency:
      refusalFrequencies.length > 0 ? Math.max(...refusalFrequencies) : null,
  };
}

function calibrationIndependentScore(item, value) {
  return (
    value >= 0.99 &&
    item.metricType !== "Frequency" &&
    item.metricType !== "Duration" &&
    /communication|request|point|aac|picture|gesture/i.test(`${item.target} ${item.goal}`)
  );
}

function updateHistory(records, history) {
  for (const entry of records.filter((record) => record.recordType === "entry")) {
    for (const item of entry.items) {
      const value = normalizedValue(item);
      if (value !== null) addHistory(history, item.goalKey, value);
    }
  }
}

function datedRecord(sourceRecords, recordType, predicate = () => true) {
  return sourceRecords
    .filter((record) => record.recordType === recordType && predicate(record))
    .sort((first, second) => first.date.localeCompare(second.date))[0] ?? null;
}

function evaluateSignal({ date, features, caseRequestDate, planDate, calibration = {} }) {
  if (features.hasCriticalSafetyEvent) {
    return {
      signal: "red",
      reason: "critical_safety_event",
      confidence: "high",
      explanation:
        "Documentation identifies a predefined critical safety event beyond the client's ordinary support baseline.",
    };
  }

  if (caseRequestDate && date >= caseRequestDate && (!planDate || date < planDate)) {
    return {
      signal: calibration.activeCaseSignal ?? "red",
      reason:
        calibration.activeCaseSignal === "amber"
          ? "active_support_review"
          : "care_coordination_breakdown",
      confidence: "high",
      explanation:
        "A formal support request is active and no coordinated implementation plan is documented yet.",
    };
  }

  if (planDate && date >= planDate) {
    const elapsedDays = Math.floor(
      (new Date(`${date}T12:00:00.000Z`).getTime() -
        new Date(`${planDate}T12:00:00.000Z`).getTime()) /
        DAY_MS
    );
    if (elapsedDays <= 7) {
      return {
        signal: "amber",
        reason: "implementation_monitoring",
        confidence: "high",
        explanation:
          "A coordinated plan is documented, but the implementation has not been stable long enough to clear monitoring.",
      };
    }
  }

  if (features.hasCoordinationStrain) {
    return {
      signal: "amber",
      reason: "emerging_coordination_strain",
      confidence: "high",
      explanation:
        "Provider documentation shows an emerging support-coverage or responsibility problem requiring review.",
    };
  }

  if (features.hasHighIntensityAbc) {
    return {
      signal: "amber",
      reason: "bounded_high_intensity_event",
      confidence: "high",
      explanation:
        "A significant event exceeded the client's routine baseline but remained bounded to the documented setting.",
    };
  }

  if (
    (typeof calibration.amberTransitionLatencyMinutes === "number" &&
      typeof features.maximumTransitionLatency === "number" &&
      features.maximumTransitionLatency >= calibration.amberTransitionLatencyMinutes) ||
    (typeof calibration.amberRefusalFrequency === "number" &&
      typeof features.maximumRefusalFrequency === "number" &&
      features.maximumRefusalFrequency >= calibration.amberRefusalFrequency)
  ) {
    return {
      signal: "amber",
      reason: "meaningful_deviation_from_personal_baseline",
      confidence: features.providerRoles.length >= 2 ? "high" : "moderate",
      explanation:
        "Transition latency or refusal exceeded this client's established baseline enough to require review.",
    };
  }

  if (calibration.blueRequiresIndependenceMilestone && features.hasIndependenceMilestone) {
    return {
      signal: "blue",
      reason: "new_independent_functional_communication",
      confidence: features.providerRoles.length >= 2 ? "high" : "moderate",
      explanation:
        "A functional-communication skill reached independently after repeated prior supported opportunities.",
    };
  }

  if (
    !calibration.blueRequiresIndependenceMilestone &&
    typeof calibration.bluePerformanceFloor === "number" &&
    typeof features.normalizedPerformance === "number" &&
    features.normalizedPerformance >= calibration.bluePerformanceFloor &&
    (typeof features.maximumTransitionLatency !== "number" ||
      features.maximumTransitionLatency <= (calibration.blueTransitionLatencyMinutes ?? 10)) &&
    (typeof features.maximumRefusalFrequency !== "number" ||
      features.maximumRefusalFrequency <= (calibration.blueRefusalFrequency ?? 1)) &&
    !features.hasHighIntensityAbc
  ) {
    return {
      signal: "blue",
      reason: "positive_change_from_personal_baseline",
      confidence: features.providerRoles.length >= 2 ? "high" : "moderate",
      explanation:
        "Participation and transition measures are meaningfully better than this client's established support baseline.",
    };
  }

  if (
    (typeof features.maximumFrequency === "number" && features.maximumFrequency >= 3) ||
    (typeof features.trendDelta === "number" &&
      features.trendDelta <= -0.11 &&
      (typeof calibration.personalBaselinePerformanceFloor !== "number" ||
        typeof features.normalizedPerformance !== "number" ||
        features.normalizedPerformance < calibration.personalBaselinePerformanceFloor))
  ) {
    return {
      signal: "amber",
      reason: "meaningful_change_for_review",
      confidence: features.providerRoles.length >= 2 ? "high" : "moderate",
      explanation:
        "Current measurements show a meaningful decline from recent comparable records or an elevated event count.",
    };
  }

  if (
    !calibration.blueRequiresIndependenceMilestone &&
    typeof features.trendDelta === "number" &&
    features.trendDelta >= 0.18 &&
    (features.maximumFrequency === null || features.maximumFrequency <= 1)
  ) {
    return {
      signal: "blue",
      reason: "sustained_positive_change",
      confidence: features.providerRoles.length >= 2 ? "high" : "moderate",
      explanation:
        "Current measurements improve on recent comparable records without an elevated event count.",
    };
  }

  return {
    signal: "neutral",
    reason: features.entries.length === 0 ? "insufficient_daily_evidence" : "routine_baseline",
    confidence: features.entries.length === 0 ? "low" : "moderate",
    explanation:
      features.entries.length === 0
        ? "No source entry was available for this evaluable date."
        : "Available measurements remain within ordinary variability and no active escalation condition is documented.",
  };
}

function replaySignals({ sourceRecords, evaluationDates, calibration = {} }) {
  const grouped = recordsByDay(sourceRecords);
  const history = new Map();
  const caseRequest = datedRecord(sourceRecords, "caseSupportRequest");
  const plan = datedRecord(
    sourceRecords,
    "caseSupportCoordination",
    (record) => record.status === "MONITORING"
  );
  const caseRequestDate = caseRequest ? day(caseRequest.date) : null;
  const planDate = plan ? day(plan.date) : null;

  return evaluationDates.map((date) => {
    const records = grouped.get(date) ?? [];
    const features = extractDailyFeatures(records, history);
    const result = evaluateSignal({ date, features, caseRequestDate, planDate, calibration });
    updateHistory(records, history);
    return { date, ...result, features };
  });
}

function compareReplay(actual, expected) {
  const expectedByDate = new Map(expected.map((item) => [item.date, item.expectedSignal]));
  const labels = ["neutral", "blue", "amber", "red"];
  const confusion = Object.fromEntries(
    labels.map((expectedLabel) => [
      expectedLabel,
      Object.fromEntries(labels.map((actualLabel) => [actualLabel, 0])),
    ])
  );
  const mismatches = [];
  let matches = 0;

  for (const result of actual) {
    const expectedSignal = expectedByDate.get(result.date);
    if (!expectedSignal) continue;
    confusion[expectedSignal][result.signal] += 1;
    if (result.signal === expectedSignal) matches += 1;
    else {
      mismatches.push({
        date: result.date,
        expected: expectedSignal,
        actual: result.signal,
        reason: result.reason,
      });
    }
  }

  return {
    evaluated: actual.length,
    matches,
    accuracy: actual.length === 0 ? 0 : matches / actual.length,
    confusion,
    mismatches,
  };
}

module.exports = {
  compareReplay,
  extractDailyFeatures,
  normalizedValue,
  replaySignals,
};
