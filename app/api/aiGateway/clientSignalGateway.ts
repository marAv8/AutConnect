import type {
  ClientSignalEvidence,
  ClientSignalSnapshot,
  SignalEntry,
  SignalSemanticEvidence,
  SignalTeamFocus,
} from "@/app/libs/clientSignal/types";

type GatewayInput = {
  entries: SignalEntry[];
  targetSessionDate: string;
  teamFocus?: SignalTeamFocus | null;
  semanticEvidence?: SignalSemanticEvidence[];
};

type Candidate = {
  color: "blue" | "amber" | "red";
  reason: string;
  explanation: string;
  confidence: "moderate" | "high";
  evidence: ClientSignalEvidence[];
};

const SUPPORT_PROFILES = new Set([
  "PromptLevel",
  "CueingLevel",
  "AssistanceLevel",
  "SupportLevel",
  "Independence",
]);

const POSITIVE_CONTEXT =
  /\b(reinforc(?:e|ed|ement|er)|preferred|choice|visual support|visual schedule|token|first[-\s]?then|break|humou?r|funny|laugh(?:ed|ing)?|jok(?:e|ed|ing)|calm(?:ed)?|engag(?:e|ed|ing)|participat(?:e|ed|ing)|independent(?:ly)?)\b/i;
const SUPPORT_CONCERN =
  /\b(maximum prompt|maximum assistance|full support|full physical|prolonged|struggl(?:e|ed|ing)|difficult(?:y)?|unable|could not|couldn't|needed assistance|required assistance|did not stabilize|could not stabilize|dysregulat(?:ed|ion)|refus(?:al|ed)|collapse(?:d)?|elop(?:e|ed|ement))\b/i;
const SERIOUS_BEHAVIOR =
  /\b(property destruction|destroy(?:ed|ing)|self[-\s]?injur(?:y|ious)|aggress(?:ion|ive)|violent|violence|hit|hitting|bite|biting|kick|kicking|extreme tantrum|scream(?:ed|ing)?|elop(?:e|ed|ement))\b/i;

export function evaluateClientSignalGateway(input: GatewayInput): ClientSignalSnapshot {
  const sessionEntries = sortedEntries(input.entries).filter(
    (entry) => sessionKey(entry.date) === input.targetSessionDate
  );
  const historyEntries = sortedEntries(input.entries).filter(
    (entry) => sessionKey(entry.date) < input.targetSessionDate
  );
  const semanticByEntry = new Map(
    (input.semanticEvidence ?? []).map((evidence) => [evidence.entryId, evidence])
  );
  if (sessionEntries.length === 0) {
    return neutralSnapshot("insufficient_session_evidence", null);
  }

  const candidates: Candidate[] = [];
  const red = redCandidate({
    sessionEntries,
    historyEntries,
    semanticByEntry,
  });
  if (red) candidates.push(red);

  const amber = amberCandidate({
    sessionEntries,
    historyEntries,
    semanticByEntry,
  });
  if (amber) candidates.push(amber);

  const mastery = masteryCandidate(sessionEntries, historyEntries);
  if (mastery) candidates.push(mastery);

  const positiveOutlier = positiveOutlierCandidate({
    sessionEntries,
    historyEntries,
    semanticByEntry,
  });
  if (positiveOutlier) candidates.push(positiveOutlier);

  const communication = independentCommunicationCandidate(
    sessionEntries,
    historyEntries
  );
  if (communication) candidates.push(communication);

  const plan = positivePlanCandidate(input.teamFocus, input.targetSessionDate);
  if (plan) candidates.push(plan);

  const selected = candidates.sort(compareCandidates)[0];
  if (!selected) {
    return neutralSnapshot(
      "routine_session_baseline",
      sessionEntries.at(-1)?.date ?? null
    );
  }

  return candidateSnapshot(selected);
}

export function latestCompletedSessionDate(
  entries: Array<Pick<SignalEntry, "date">>,
  before: Date
) {
  const beforeKey = sessionKey(before);
  return entries
    .map((entry) => sessionKey(entry.date))
    .filter((date) => date < beforeKey)
    .sort()
    .at(-1) ?? null;
}

function redCandidate(input: {
  sessionEntries: SignalEntry[];
  historyEntries: SignalEntry[];
  semanticByEntry: Map<string, SignalSemanticEvidence>;
}): Candidate | null {
  const currentSerious = input.sessionEntries.filter((entry) =>
    isSeriousEntry(entry, input.semanticByEntry.get(entry.id))
  );
  if (currentSerious.length === 0) return null;

  const recentSessionDates = distinctSessionDates([
    ...input.historyEntries,
    ...input.sessionEntries,
  ]).slice(-3);
  const corroborating = [...input.historyEntries, ...input.sessionEntries].filter(
    (entry) =>
      recentSessionDates.includes(sessionKey(entry.date)) &&
      isSeriousEntry(entry, input.semanticByEntry.get(entry.id))
  );
  const providers = new Set(corroborating.map((entry) => entry.providerId));
  const destructiveOrAggressive = corroborating.some(hasDestructiveOrAggressiveBehavior);

  if (providers.size < 2 || !destructiveOrAggressive) {
    return null;
  }

  return {
    color: "red",
    reason: "corroborated_serious_behavior_pattern",
    explanation:
      "Serious behavior was corroborated across providers and requires coordinated review of the established support plan.",
    confidence: "high",
    evidence: corroborating.slice(-3).map((entry) =>
      evidenceForEntry(entry, "Corroborated serious behavior documentation")
    ),
  };
}

function amberCandidate(input: {
  sessionEntries: SignalEntry[];
  historyEntries: SignalEntry[];
  semanticByEntry: Map<string, SignalSemanticEvidence>;
}): Candidate | null {
  const recentSessionDates = distinctSessionDates([
    ...input.historyEntries,
    ...input.sessionEntries,
  ]).slice(-3);
  const supportEntries = [...input.historyEntries, ...input.sessionEntries].filter(
    (entry) =>
      recentSessionDates.includes(sessionKey(entry.date)) &&
      hasCombinedSupportConcern(entry, input.semanticByEntry.get(entry.id))
  );
  const currentHasConcern = input.sessionEntries.some((entry) =>
    hasCombinedSupportConcern(entry, input.semanticByEntry.get(entry.id))
  );
  const providers = new Set(supportEntries.map((entry) => entry.providerId));
  if (currentHasConcern && providers.size >= 2) {
    return {
      color: "amber",
      reason: "cross_provider_support_difficulty",
      explanation:
        "Measurements and observations show elevated support needs across more than one provider workflow.",
      confidence: "high",
      evidence: uniqueProviderEntries(supportEntries)
        .slice(-3)
        .map((entry) => evidenceForEntry(entry, "Elevated support need documented")),
    };
  }

  const serious = input.sessionEntries.find((entry) =>
    isSeriousEntry(entry, input.semanticByEntry.get(entry.id))
  );
  if (serious) {
    return {
      color: "amber",
      reason: "unusual_difficult_session",
      explanation:
        "A serious but not yet corroborated session-level change should be reviewed against the client's baseline.",
      confidence: "moderate",
      evidence: [evidenceForEntry(serious, "Unusual difficult session documented")],
    };
  }

  const prolongedTransition = input.sessionEntries
    .map((entry) => ({ entry, minutes: transitionMinutes(entry) }))
    .find(({ minutes }) => typeof minutes === "number" && minutes >= 20);
  if (prolongedTransition && typeof prolongedTransition.minutes === "number") {
    return {
      color: "amber",
      reason: "transition_above_personal_baseline",
      explanation:
        "A prolonged transition exceeded the conservative review threshold for this session.",
      confidence: "moderate",
      evidence: [
        evidenceForEntry(
          prolongedTransition.entry,
          `${prolongedTransition.minutes}-minute transition documented`
        ),
      ],
    };
  }

  return null;
}

function masteryCandidate(
  sessionEntries: SignalEntry[],
  historyEntries: SignalEntry[]
): Candidate | null {
  const allEntries = [...historyEntries, ...sessionEntries];
  for (const currentEntry of sessionEntries) {
    for (const currentItem of currentEntry.items) {
      const comparable = allEntries
        .flatMap((entry) =>
          entry.items
            .filter((item) => sameGoal(currentEntry, currentItem, entry, item))
            .map((item) => ({ entry, item }))
        )
        .sort((first, second) =>
          toDate(first.entry.date).getTime() - toDate(second.entry.date).getTime()
        );
      const lastThree = comparable.slice(-3);
      if (
        lastThree.length === 3 &&
        lastThree.at(-1)?.entry.id === currentEntry.id &&
        lastThree.every(({ item }) => isMasterySuccess(item))
      ) {
        return {
          color: "blue",
          reason: "three_session_mastery_pattern",
          explanation:
            "The target met its success criterion across three consecutive recorded sessions.",
          confidence: "high",
          evidence: lastThree.map(({ entry }) =>
            evidenceForEntry(entry, `${currentItem.target} met the session criterion`)
          ),
        };
      }
    }
  }
  return null;
}

function positiveOutlierCandidate(input: {
  sessionEntries: SignalEntry[];
  historyEntries: SignalEntry[];
  semanticByEntry: Map<string, SignalSemanticEvidence>;
}): Candidate | null {
  for (const entry of input.sessionEntries) {
    const semantic = input.semanticByEntry.get(entry.id);
    const text = contextualEntryText(entry);
    const hasContext =
      Boolean(semantic?.interventionContext?.trim()) || POSITIVE_CONTEXT.test(text);
    const semanticPositive =
      semantic?.positiveChange === "clear" || semantic?.positiveChange === "possible";
    if (!hasContext && !semanticPositive) continue;

    for (const item of entry.items) {
      const historical = input.historyEntries
        .flatMap((historicalEntry) =>
          historicalEntry.items
            .filter((prior) => sameGoal(entry, item, historicalEntry, prior))
            .map((prior) => ({ entry: historicalEntry, item: prior }))
        )
        .slice(-5);
      if (historical.length < 2 || !isMeaningfulPositiveOutlier(item, historical.map((row) => row.item))) {
        continue;
      }

      return {
        color: "blue",
        reason: "unusually_positive_session",
        explanation:
          "Performance was unusually strong relative to comparable sessions, with contextual information the team may be able to reproduce.",
        confidence: semantic?.positiveChange === "clear" ? "high" : "moderate",
        evidence: [evidenceForEntry(entry, `${item.target} was unusually strong`)],
      };
    }
  }
  return null;
}

function independentCommunicationCandidate(
  sessionEntries: SignalEntry[],
  historyEntries: SignalEntry[]
): Candidate | null {
  for (const entry of sessionEntries) {
    for (const item of entry.items) {
      if (!isCommunicationItem(item) || !isIndependent(item)) continue;
      const prior = historyEntries
        .flatMap((historicalEntry) =>
          historicalEntry.items
            .filter((historicalItem) =>
              sameGoal(entry, item, historicalEntry, historicalItem)
            )
            .map((historicalItem) => ({ entry: historicalEntry, item: historicalItem }))
        );
      if (prior.length < 2 || prior.every(({ item: historicalItem }) => !isIndependent(historicalItem))) {
        return {
          color: "blue",
          reason: "new_independent_functional_communication",
          explanation:
            "A functional-communication response reached independence after prior supported opportunities.",
          confidence: "moderate",
          evidence: [evidenceForEntry(entry, `${item.target} reached independently`)],
        };
      }
    }
  }
  return null;
}

function positivePlanCandidate(
  teamFocus: SignalTeamFocus | null | undefined,
  targetSessionDate: string
): Candidate | null {
  if (!teamFocus || sessionKey(teamFocus.updatedAt) !== targetSessionDate) return null;
  if (!/\b(master(?:ed|y)|new (?:goal|target|plan)|introduc(?:e|ed|ing)|progress|maintain|generaliz)\b/i.test(
    `${teamFocus.title ?? ""} ${teamFocus.content}`
  )) return null;
  return {
    color: "blue",
    reason: "meaningful_new_clinical_plan",
    explanation:
      "Team Focus documents a meaningful positive development or next clinical plan.",
    confidence: "high",
    evidence: [{
      observedAt: toDate(teamFocus.updatedAt).toISOString(),
      label: teamFocus.title?.trim() || "Updated Team Focus",
    }],
  };
}

function hasCombinedSupportConcern(
  entry: SignalEntry,
  semantic?: SignalSemanticEvidence
) {
  const hasMaximumSupport = entry.items.some(
    (item) =>
      SUPPORT_PROFILES.has(item.measurementProfile ?? "") && item.score === 1
  );
  const noteConcern =
    SUPPORT_CONCERN.test(entryText(entry)) || semantic?.supportConcern === "clear";
  return hasMaximumSupport && noteConcern;
}

function isSeriousEntry(entry: SignalEntry, semantic?: SignalSemanticEvidence) {
  if (semantic?.seriousBehavior === "clear") return true;
  const elevatedStructuredBehavior = entry.items.some(
    (item) =>
      item.metricType === "Frequency" &&
      typeof item.rawValue === "number" &&
      item.rawValue >= 3 &&
      SERIOUS_BEHAVIOR.test(`${item.target} ${item.goal} ${item.observation ?? ""}`)
  );
  return elevatedStructuredBehavior || SERIOUS_BEHAVIOR.test(entryText(entry));
}

function hasDestructiveOrAggressiveBehavior(entry: SignalEntry) {
  return /\b(property destruction|destroy(?:ed|ing)|self[-\s]?injur(?:y|ious)|aggress(?:ion|ive)|violent|violence|hit|hitting|bite|biting|kick|kicking)\b/i.test(
    entryText(entry)
  );
}

function isMasterySuccess(item: SignalEntry["items"][number]) {
  const profile = item.measurementProfile ?? "";
  if (SUPPORT_PROFILES.has(profile)) {
    return typeof item.score === "number" && item.score >= 3;
  }
  if (item.metricType === "Percentage" && typeof item.rawValue === "number") {
    return item.rawValue >= (item.targetValue ?? 85);
  }
  if (typeof item.rawValue === "number" && typeof item.targetValue === "number") {
    return compareValue(item.rawValue, item.targetValue, item.comparison);
  }
  if (profile === "Accuracy" || item.metricType === "Accuracy") {
    return typeof item.score === "number" && item.score >= 4;
  }
  return false;
}

function isMeaningfulPositiveOutlier(
  current: SignalEntry["items"][number],
  historical: SignalEntry["items"][number][]
) {
  const historicalScores = historical
    .map((item) => item.score)
    .filter((value): value is number => typeof value === "number");
  if (typeof current.score === "number" && historicalScores.length >= 2) {
    return current.score >= 3 && current.score - average(historicalScores) >= 1;
  }

  const historicalValues = historical
    .map((item) => item.rawValue)
    .filter((value): value is number => typeof value === "number");
  if (typeof current.rawValue !== "number" || historicalValues.length < 2) return false;
  const baseline = average(historicalValues);
  if (current.comparison === "GreaterThan") {
    return current.rawValue >= baseline * 1.5 && current.rawValue - baseline >= 1;
  }
  if (current.comparison === "LessThan") {
    return baseline >= 2 && current.rawValue <= baseline * 0.5;
  }
  if (current.metricType === "Frequency" || current.metricType === "Duration") {
    return baseline >= 2 && current.rawValue <= baseline * 0.5;
  }
  return current.rawValue >= 85 && current.rawValue - baseline >= 15;
}

function isIndependent(item: SignalEntry["items"][number]) {
  return typeof item.score === "number" && item.score >= 4;
}

function isCommunicationItem(item: SignalEntry["items"][number]) {
  return /communication|request|point|aac|picture|gesture/i.test(
    `${item.target} ${item.goal}`
  );
}

function sameGoal(
  firstEntry: SignalEntry,
  first: SignalEntry["items"][number],
  secondEntry: SignalEntry,
  second: SignalEntry["items"][number]
) {
  if (first.goalId && second.goalId) return first.goalId === second.goalId;
  return (
    firstEntry.providerId === secondEntry.providerId &&
    first.target.trim().toLowerCase() === second.target.trim().toLowerCase() &&
    first.goal.trim().toLowerCase() === second.goal.trim().toLowerCase()
  );
}

function transitionMinutes(entry: SignalEntry) {
  const structured = entry.items.find(
    (item) =>
      /transition/i.test(`${item.target} ${item.goal}`) &&
      item.metricType === "Duration" &&
      typeof item.rawValue === "number"
  )?.rawValue;
  if (typeof structured === "number") return structured;
  if (!/transition/i.test(entryText(entry))) return null;
  const values = Array.from(
    entryText(entry).matchAll(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/gi)
  ).map((match) => Number(match[1]));
  return values.length ? Math.max(...values) : null;
}

function compareCandidates(first: Candidate, second: Candidate) {
  const priority = { red: 3, amber: 2, blue: 1 };
  return priority[second.color] - priority[first.color];
}

function candidateSnapshot(candidate: Candidate): ClientSignalSnapshot {
  const observedAt = candidate.evidence
    .map((evidence) => evidence.observedAt)
    .sort()
    .at(-1) ?? null;
  return {
    sessionDate: null,
    color: candidate.color,
    reason: candidate.reason,
    explanation: candidate.explanation,
    confidence: candidate.confidence,
    observedAt,
    expiresAt: null,
    status: "proposed",
    requiresSupervisorReview: true,
    isUnread: true,
    evidence: candidate.evidence.slice(0, 3),
  };
}

function neutralSnapshot(
  reason: string,
  observedAt: Date | string | null
): ClientSignalSnapshot {
  return {
    sessionDate: null,
    color: "neutral",
    reason,
    explanation:
      reason === "insufficient_session_evidence"
        ? "No completed shared session is available for a proposed color signal."
        : "Available session information remains within expected variability for this client's individualized baseline.",
    confidence: observedAt ? "moderate" : "low",
    observedAt: observedAt ? toDate(observedAt).toISOString() : null,
    expiresAt: null,
    status: "proposed",
    requiresSupervisorReview: false,
    isUnread: false,
    evidence: [],
  };
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

function entryText(entry: SignalEntry) {
  return [
    entry.note,
    ...entry.items.flatMap((item) => [item.target, item.goal, item.observation]),
    ...entry.abcObservations.flatMap((abc) => [
      abc.antecedent,
      abc.behavior,
      abc.consequence,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function contextualEntryText(entry: SignalEntry) {
  return [
    entry.note,
    ...entry.items.map((item) => item.observation),
    ...entry.abcObservations.flatMap((abc) => [
      abc.antecedent,
      abc.behavior,
      abc.consequence,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function uniqueProviderEntries(entries: SignalEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.providerId)) return false;
    seen.add(entry.providerId);
    return true;
  });
}

function distinctSessionDates(entries: SignalEntry[]) {
  return Array.from(new Set(entries.map((entry) => sessionKey(entry.date)))).sort();
}

function sortedEntries(entries: SignalEntry[]) {
  return [...entries].sort(
    (first, second) => toDate(first.date).getTime() - toDate(second.date).getTime()
  );
}

function sessionKey(value: Date | string) {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareValue(value: number, target: number, comparison?: string | null) {
  if (comparison === "LessThan") return value < target;
  if (comparison === "LessThanOrEqual") return value <= target;
  if (comparison === "Equal") return value === target;
  if (comparison === "GreaterThan") return value > target;
  return value >= target;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}
