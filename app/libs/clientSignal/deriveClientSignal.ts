import type {
  ClientSignalEvidence,
  ClientSignalSnapshot,
  SignalEntry,
} from "./types";

const DAY_MS = 86_400_000;
const SIGNAL_LOOKBACK_DAYS = 7;
const HISTORY_LOOKBACK_DAYS = 42;

export function deriveClientSignal(input: {
  entries: SignalEntry[];
  now?: Date;
  signalWindow?: { start: Date; end: Date };
}): ClientSignalSnapshot {
  const now = input.now ?? new Date();
  const signalStart = input.signalWindow?.start ?? new Date(now.getTime() - SIGNAL_LOOKBACK_DAYS * DAY_MS);
  const signalEnd = input.signalWindow?.end ?? now;
  const historyStart = new Date(signalEnd.getTime() - HISTORY_LOOKBACK_DAYS * DAY_MS);
  const entries = [...input.entries]
    .filter((entry) => toDate(entry.date) >= historyStart && toDate(entry.date) < signalEnd)
    .sort((first, second) => toDate(first.date).getTime() - toDate(second.date).getTime());
  const recentEntries = entries.filter((entry) => toDate(entry.date) >= signalStart);
  const historicalEntries = entries.filter((entry) => toDate(entry.date) < signalStart);

  const seriousPattern = sustainedSeriousPattern(entries, recentEntries, signalStart);
  if (seriousPattern) {
    return snapshot({
      color: "red",
      reason: "sustained_serious_pattern",
      explanation:
        "A serious pattern continued across multiple sessions and providers and requires coordinated review.",
      confidence: "high",
      evidence: seriousPattern.map((entry) =>
        evidenceForEntry(entry, "Sustained serious pattern documented")
      ),
      ttlDays: 1,
    });
  }

  const transitionEvidence = recentEntries
    .map((entry) => ({ entry, minutes: transitionMinutes(entry) }))
    .filter((item): item is { entry: SignalEntry; minutes: number } => item.minutes !== null);
  const prolongedTransition = transitionEvidence.find((item) => item.minutes >= 35);
  const repeatedTransitionDays = new Set(
    transitionEvidence.filter((item) => item.minutes >= 20).map((item) => dayKey(item.entry.date))
  );
  if (prolongedTransition || repeatedTransitionDays.size >= 2) {
    const selected = prolongedTransition
      ? [prolongedTransition]
      : transitionEvidence.filter((item) => item.minutes >= 20).slice(-2);
    return snapshot({
      color: "amber",
      reason: "transition_above_personal_baseline",
      explanation:
        prolongedTransition
          ? "A recent transition exceeded 35 minutes and should be reviewed against the client's established baseline."
          : "Transitions of at least 20 minutes occurred on multiple recent days and should be reviewed as a pattern.",
      confidence: selected.length >= 2 ? "high" : "moderate",
      evidence: selected.map(({ entry, minutes }) =>
        evidenceForEntry(entry, `${minutes}-minute transition documented`)
      ),
      ttlDays: 3,
    });
  }

  const elevatedBehavior = recentEntries.find((entry) =>
    entry.items.some(
      (item) =>
        item.metricType === "Frequency" &&
        typeof item.rawValue === "number" &&
        item.rawValue >= 3 &&
        /refusal|elopement|aggression|self[-\s]?injury|property destruction/i.test(
          `${item.target} ${item.goal}`
        )
    )
  );
  if (elevatedBehavior) {
    return snapshot({
      color: "amber",
      reason: "meaningful_deviation_from_personal_baseline",
      explanation:
        "A recent observable behavior count crossed the conservative review threshold.",
      confidence: "moderate",
      evidence: [evidenceForEntry(elevatedBehavior, "Elevated observable behavior count")],
      ttlDays: 3,
    });
  }

  const safetyAbc = recentEntries.find((entry) =>
    entry.abcObservations.some((abc) =>
      /\b(elopement|self[-\s]?injury|property destruction|hit|bite|kick)\b/i.test(
        `${abc.antecedent} ${abc.behavior} ${abc.consequence}`
      )
    )
  );
  if (safetyAbc) {
    return snapshot({
      color: "amber",
      reason: "bounded_safety_related_event",
      explanation:
        "A recent A-B-C record contains safety-related behavior language that warrants review but does not meet the red threshold.",
      confidence: "moderate",
      evidence: [evidenceForEntry(safetyAbc, "Safety-related A-B-C observation")],
      ttlDays: 3,
    });
  }

  const communicationMilestone = independentCommunicationMilestone(
    recentEntries,
    entries
  );
  if (communicationMilestone) {
    return snapshot({
      color: "blue",
      reason: "new_independent_functional_communication",
      explanation:
        "A functional-communication response reached independence after prior supported opportunities.",
      confidence: communicationMilestone.providerCount >= 2 ? "high" : "moderate",
      evidence: [
        evidenceForEntry(
          communicationMilestone.entry,
          `${communicationMilestone.target} reached independently`
        ),
      ],
      ttlDays: 3,
    });
  }

  const positiveChange = crossProviderPositiveChange(recentEntries, historicalEntries);
  if (positiveChange) {
    return snapshot({
      color: "blue",
      reason: "sustained_positive_change",
      explanation:
        "At least two providers documented meaningful improvement from recent comparable records.",
      confidence: "high",
      evidence: positiveChange,
      ttlDays: 3,
    });
  }

  return {
    sessionDate: null,
    color: "neutral",
    reason: recentEntries.length > 0 ? "personal_baseline" : "insufficient_recent_evidence",
    explanation:
      recentEntries.length > 0
        ? "Recent shared records remain within expected variability for this client's individualized baseline."
        : "No recent shared evidence is available for a proposed color signal.",
    confidence: recentEntries.length > 0 ? "moderate" : "low",
    observedAt: recentEntries.at(-1) ? toDate(recentEntries.at(-1)!.date).toISOString() : null,
    expiresAt: null,
    status: "proposed",
    requiresSupervisorReview: false,
    isUnread: false,
    evidence: [],
  };
}

function independentCommunicationMilestone(
  recentEntries: SignalEntry[],
  allEntries: SignalEntry[]
) {
  for (const entry of recentEntries) {
    for (const item of entry.items) {
      if (item.score !== 4 || !isCommunicationItem(item)) continue;
      const priorEntries = allEntries.filter(
        (priorEntry) => toDate(priorEntry.date) < toDate(entry.date)
      );
      const comparable = priorEntries
        .flatMap((priorEntry) => priorEntry.items)
        .filter((prior) => sameGoal(item, prior) && typeof prior.score === "number");
      if (comparable.length >= 2 && comparable.every((prior) => (prior.score ?? 0) < 4)) {
        return {
          entry,
          target: item.target,
          providerCount: new Set(
            priorEntries
              .filter((priorEntry) => priorEntry.items.some((prior) => sameGoal(item, prior)))
              .map((priorEntry) => priorEntry.providerId)
          ).size,
        };
      }
    }
  }
  return null;
}

function crossProviderPositiveChange(
  recentEntries: SignalEntry[],
  historicalEntries: SignalEntry[]
): ClientSignalEvidence[] | null {
  const improvingEntries = recentEntries.filter((entry) =>
    entry.items.some((item) => {
      if (typeof item.score !== "number") return false;
      const priorScores = historicalEntries
        .flatMap((historicalEntry) => historicalEntry.items)
        .filter((prior) => sameGoal(item, prior) && typeof prior.score === "number")
        .map((prior) => prior.score as number);
      if (priorScores.length < 2) return false;
      const priorAverage = priorScores.reduce((sum, value) => sum + value, 0) / priorScores.length;
      return item.score - priorAverage >= 1;
    })
  );
  const providers = new Set(improvingEntries.map((entry) => entry.providerId));
  if (providers.size < 2) return null;
  return improvingEntries
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.providerId === entry.providerId) === index)
    .slice(0, 3)
    .map((entry) => evidenceForEntry(entry, "Improvement from comparable prior records"));
}

function transitionMinutes(entry: SignalEntry) {
  const structured = entry.items
    .filter((item) => /transition/i.test(`${item.target} ${item.goal}`))
    .find(
      (item) =>
        item.metricType === "Duration" && typeof item.rawValue === "number"
    )?.rawValue;
  if (typeof structured === "number") return structured;

  const text = entryText(entry);
  if (!/transition/i.test(text)) return null;
  const values = Array.from(text.matchAll(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/gi)).map(
    (match) => Number(match[1])
  );
  return values.length ? Math.max(...values) : null;
}

function entryText(entry: SignalEntry) {
  return [
    entry.note,
    ...entry.items.flatMap((item) => [item.target, item.goal, item.observation]),
    ...entry.abcObservations.flatMap((abc) => [abc.antecedent, abc.behavior, abc.consequence]),
  ]
    .filter(Boolean)
    .join(" ");
}

function isCommunicationItem(item: SignalEntry["items"][number]) {
  return /communication|request|point|aac|picture|gesture/i.test(
    `${item.target} ${item.goal}`
  );
}

function sameGoal(
  first: SignalEntry["items"][number],
  second: SignalEntry["items"][number]
) {
  if (first.goalId && second.goalId) return first.goalId === second.goalId;
  return (
    first.target.toLowerCase() === second.target.toLowerCase() &&
    first.goal.toLowerCase() === second.goal.toLowerCase()
  );
}

function evidenceForEntry(entry: SignalEntry, label: string): ClientSignalEvidence {
  return {
    entryId: entry.id,
    providerId: entry.providerId,
    providerRole: entry.providerRole,
    observedAt: toDate(entry.date).toISOString(),
    label,
  };
}

function snapshot(input: {
  color: "blue" | "amber" | "red";
  reason: string;
  explanation: string;
  confidence: "moderate" | "high";
  evidence: ClientSignalEvidence[];
  ttlDays: number;
}): ClientSignalSnapshot {
  const observedAt = input.evidence
    .map((evidence) => evidence.observedAt)
    .sort()
    .at(-1)!;
  return {
    sessionDate: null,
    color: input.color,
    reason: input.reason,
    explanation: input.explanation,
    confidence: input.confidence,
    observedAt,
    expiresAt: new Date(toDate(observedAt).getTime() + input.ttlDays * DAY_MS).toISOString(),
    status: "proposed",
    requiresSupervisorReview: true,
    isUnread: true,
    evidence: input.evidence.slice(0, 3),
  };
}

function sustainedSeriousPattern(
  allEntries: SignalEntry[],
  signalEntries: SignalEntry[],
  signalStart: Date
) {
  if (!signalEntries.some(isSeriousPatternEntry)) return null;
  const patternStart = new Date(signalStart.getTime() - 13 * DAY_MS);
  const matching = allEntries.filter(
    (entry) => toDate(entry.date) >= patternStart && isSeriousPatternEntry(entry)
  );
  const days = new Set(matching.map((entry) => dayKey(entry.date)));
  const providers = new Set(matching.map((entry) => entry.providerId));
  if (days.size < 3 || providers.size < 2) return null;
  return matching.slice(-3);
}

function isSeriousPatternEntry(entry: SignalEntry) {
  const hasElevatedCount = entry.items.some(
    (item) =>
      item.metricType === "Frequency" &&
      typeof item.rawValue === "number" &&
      item.rawValue >= 3 &&
      /refusal|elopement|aggression|self[-\s]?injury|property destruction/i.test(
        `${item.target} ${item.goal}`
      )
  );
  const hasSafetyObservation = entry.abcObservations.some((abc) =>
    /\b(elopement|self[-\s]?injury|property destruction|hit|bite|kick)\b/i.test(
      `${abc.antecedent} ${abc.behavior} ${abc.consequence}`
    )
  );
  return hasElevatedCount || hasSafetyObservation;
}

function dayKey(value: Date | string) {
  return toDate(value).toISOString().slice(0, 10);
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}
