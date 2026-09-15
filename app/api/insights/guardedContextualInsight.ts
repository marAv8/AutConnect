import { INSIGHT_LENS_LABELS, type InsightLens } from "../../libs/insights/lenses";
import type { InsightContext } from "./insightContextTypes";
import type { InsightResult } from "./insightsEngine";
import { buildInsightSnapshot } from "./insightSnapshot";

type GoalSeries = InsightContext["providerGoalSeries"][number];
type GoalSeriesSession = GoalSeries["sessions"][number];

const QUESTION_STOP_WORDS = new Set([
  "when",
  "what",
  "where",
  "which",
  "rating",
  "ratings",
  "measure",
  "measures",
  "measurement",
  "measurements",
  "increase",
  "increased",
  "increasing",
  "decrease",
  "decreased",
  "decreasing",
  "change",
  "changed",
  "within",
]);

export function buildGuardedContextualInsight(
  context: InsightContext,
  lens: InsightLens,
  question: string
): InsightResult {
  const valencedPatternAnswer =
    lens === "patterns"
      ? buildValencedPatternAnswer(context, question)
      : null;
  if (valencedPatternAnswer) return valencedPatternAnswer;

  const temporalPatternAnswer =
    lens === "patterns"
      ? buildTemporalPatternAnswer(context, question)
      : null;
  if (temporalPatternAnswer) return temporalPatternAnswer;

  const findings = buildInsightSnapshot(context).lenses[lens].findings;
  if (findings.length === 0) {
    return {
      headline: `${INSIGHT_LENS_LABELS[lens]} evidence`,
      summary:
        "No supported finding is available for this question from the current authorized records.",
      answerMode: "insufficient",
      confidence: "low",
      limitations: [
        "The available records do not support an answer in this lens.",
      ],
      evidence: [],
    };
  }

  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4);
  const scored = findings
    .map((finding) => ({
      finding,
      score: terms.filter((term) =>
        `${finding.title} ${finding.statement}`.toLowerCase().includes(term)
      ).length,
    }))
    .sort((left, right) => right.score - left.score);
  const selected = (scored.some((item) => item.score > 0)
    ? scored.filter((item) => item.score > 0)
    : scored
  )
    .slice(0, 3)
    .map((item) => item.finding);
  const evidence = selected
    .flatMap((finding) =>
      finding.sources.map((source) => ({
        label: source.label,
        value: source.excerpt ?? finding.statement,
        date: source.occurredAt,
        sourceId: source.recordId,
      }))
    )
    .filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) => candidate.sourceId === item.sourceId
        ) === index
    )
    .slice(0, 8);
  const strengths = selected.map((finding) => finding.evidenceStrength);
  const confidence = strengths.includes("low")
    ? "low"
    : strengths.every((strength) => strength === "high")
      ? "high"
      : "medium";

  return {
    headline: `${INSIGHT_LENS_LABELS[lens]} evidence`,
    summary: selected.map((finding) => finding.statement).join(" "),
    answerMode: "deterministic",
    confidence,
    limitations: [...new Set(selected.flatMap((finding) => finding.limitations))],
    evidence,
  };
}

function buildValencedPatternAnswer(
  context: InsightContext,
  question: string
): InsightResult | null {
  const requestedRelationship = requestedTrendRelationship(question);
  if (!requestedRelationship) return null;

  const findings = buildInsightSnapshot(context).lenses.patterns.findings.filter(
    (finding) => finding.measurement
  );
  const supported = findings.filter(
    (finding) =>
      finding.measurement?.goalRelationship === requestedRelationship
  );
  const unresolved = findings.filter(
    (finding) => finding.measurement?.goalRelationship === "unknown"
  );
  const directionSummary = unresolved
    .map((finding) => {
      const direction = finding.measurement?.direction;
      const subject = finding.title.replace(/^Recorded pattern for\s+/i, "");
      if (direction === "increasing") return `${subject} increased`;
      if (direction === "decreasing") return `${subject} decreased`;
      if (direction === "stable") return `${subject} remained stable`;
      return "";
    })
    .filter(Boolean);
  const providerCoverage = providerTrendCoverage(context);
  const evidence = evidenceForFindings(supported.length ? supported : unresolved);
  const asksPositive = requestedRelationship === "towardCriterion";

  if (supported.length === 0) {
    const rawDirections = directionSummary.length
      ? ` The records show ${joinList(directionSummary)}, but these are raw rating directions; the configured scales do not establish which direction represents progress.`
      : "";
    return {
      headline: asksPositive
        ? "No confirmed positive trend"
        : "No confirmed regression trend",
      summary: `No ${asksPositive ? "positive" : "regression"} trend can be confirmed from the current configured criteria.${rawDirections}${providerCoverage}`,
      answerMode: "deterministic",
      confidence: "medium",
      limitations: [],
      evidence,
    };
  }

  const supportedSummary = supported
    .map((finding) => {
      const subject = finding.title.replace(/^Recorded pattern for\s+/i, "");
      return `${subject} moved ${asksPositive ? "toward" : "away from"} its configured criterion`;
    })
    .join("; ");
  return {
    headline: asksPositive ? "Supported positive trends" : "Supported regression trends",
    summary: `${supportedSummary}.${providerCoverage}`,
    answerMode: "deterministic",
    confidence: supported.some((finding) => finding.evidenceStrength === "low")
      ? "medium"
      : "high",
    limitations: [],
    evidence,
  };
}

function requestedTrendRelationship(question: string) {
  if (/\b(positive|improv(?:e|ed|ement|ing)|favorable|progress(?:ing)?)\b/i.test(question)) {
    return "towardCriterion" as const;
  }
  if (/\b(negative|regress(?:ed|ion|ing)?|worsen(?:ed|ing)?)\b/i.test(question)) {
    return "awayFromCriterion" as const;
  }
  return null;
}

function evidenceForFindings(
  findings: ReturnType<typeof buildInsightSnapshot>["lenses"]["patterns"]["findings"]
) {
  return findings
    .flatMap((finding) =>
      finding.sources.map((source) => ({
        label: source.label,
        value: source.excerpt ?? finding.statement,
        date: source.occurredAt,
        sourceId: source.recordId,
      }))
    )
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.sourceId === item.sourceId) ===
        index
    )
    .slice(0, 8);
}

function providerTrendCoverage(context: InsightContext) {
  const comparableRoles = new Set(
    context.providerGoalSeries
      .filter((series) => comparableSessions(series).length >= 3)
      .map((series) => humanizeRole(series.providerRole))
      .filter(Boolean)
  );
  const documentedRoles = new Set(
    context.documentationRecords
      .map((record) => humanizeRole(record.providerRole))
      .filter(Boolean)
  );
  const qualitativeOnly = [...documentedRoles].filter(
    (role) => !comparableRoles.has(role)
  );

  if (qualitativeOnly.length === 0) return "";
  const calculated = comparableRoles.size
    ? ` Comparable trend calculations are currently available for ${joinList([...comparableRoles])}.`
    : " No provider role currently has enough comparable structured measurements for a trend calculation.";
  return `${calculated} ${joinList(qualitativeOnly)} contributed qualitative documentation that remains available as observations rather than a numeric trend.`;
}

function humanizeRole(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bBehavior Therapist\b/i, "Behavior Therapy")
    .replace(/\bSpeech Pathologist\b/i, "Speech Therapy")
    .replace(/\bOccupational Therapist\b/i, "Occupational Therapy")
    .trim();
}

function buildTemporalPatternAnswer(
  context: InsightContext,
  question: string
): InsightResult | null {
  const direction = requestedChangeDirection(question);
  if (!direction || !asksWhen(question)) return null;

  const selectedSeries = seriesForQuestion(context.providerGoalSeries, question);
  if (selectedSeries.length === 0) return null;

  const answers = selectedSeries.map((series) =>
    describeSeriesChanges(context, series, direction)
  );
  const evidence = answers
    .flatMap((answer) => answer.evidence)
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.sourceId === item.sourceId) ===
        index
    )
    .slice(0, 8);
  const lowData = selectedSeries.some((series) =>
    comparableSessions(series).some((session) => session.lowData)
  );

  return {
    headline: `${selectedSeries[0].target} rating ${direction === "increase" ? "increases" : "decreases"}`,
    summary: answers.map((answer) => answer.summary).join(" "),
    answerMode: evidence.length > 0 ? "deterministic" : "insufficient",
    confidence: lowData ? "medium" : "high",
    limitations: [],
    evidence,
  };
}

function requestedChangeDirection(question: string) {
  const normalized = question.toLowerCase();
  if (/\b(increase[ds]?|increasing|rose|higher)\b/.test(normalized)) {
    return "increase" as const;
  }
  if (/\b(decrease[ds]?|decreasing|fell|lower)\b/.test(normalized)) {
    return "decrease" as const;
  }
  return null;
}

function asksWhen(question: string) {
  return /\b(when|which (?:session|measure|measurement)|what date|start(?:ed)?)\b/i.test(
    question
  );
}

function seriesForQuestion(series: GoalSeries[], question: string) {
  const normalizedQuestion = normalizeText(question);
  const questionTerms = terms(question).filter(
    (term) => !QUESTION_STOP_WORDS.has(term)
  );
  const scored = series
    .map((item) => {
      const target = normalizeText(item.target);
      const goal = normalizeText(item.goal);
      const exactTarget = target.length >= 3 && normalizedQuestion.includes(target);
      const overlap = questionTerms.filter(
        (term) => target.includes(term) || goal.includes(term)
      ).length;
      return { item, score: exactTarget ? 100 + overlap : overlap };
    })
    .filter(({ item, score }) => score > 0 && comparableSessions(item).length >= 2)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) return [];
  const bestScore = scored[0].score;
  return scored
    .filter(({ score }) => score === bestScore)
    .map(({ item }) => item);
}

function describeSeriesChanges(
  context: InsightContext,
  series: GoalSeries,
  direction: "increase" | "decrease"
) {
  const sessions = comparableSessions(series);
  const changes = sessions
    .slice(1)
    .map((current, index) => ({
      previous: sessions[index],
      current,
      previousIndex: index + 1,
      currentIndex: index + 2,
    }))
    .filter(({ previous, current }) =>
      direction === "increase"
        ? current.measurementValue! > previous.measurementValue!
        : current.measurementValue! < previous.measurementValue!
    );

  if (changes.length === 0) {
    return {
      summary: `No session-to-session ${direction} for ${series.target} is recorded within the ${sessions.length} comparable measurements.`,
      evidence: [],
    };
  }

  const describedChanges = changes.slice(0, 4).map(({ previous, current, previousIndex, currentIndex }) =>
    `the ${ordinal(previousIndex)} and ${ordinal(currentIndex)} comparable measurements (${formatValue(previous.measurementValue!, series.metricType)} on ${formatDate(previous.date)} to ${formatValue(current.measurementValue!, series.metricType)} on ${formatDate(current.date)})`
  );
  const additionalCount = changes.length - describedChanges.length;
  const firstNote = documentationNote(context, changes[0].current.sessionId);
  const summary = `${series.target} first ${direction === "increase" ? "increased" : "decreased"} between ${describedChanges[0]}.${
    describedChanges.length > 1
      ? ` Additional ${direction === "increase" ? "increases" : "decreases"} occurred between ${joinList(describedChanges.slice(1))}.`
      : ""
  }${additionalCount > 0 ? ` ${additionalCount} additional change${additionalCount === 1 ? "" : "s"} of the same direction occurred later.` : ""}${
    firstNote
      ? ` The provider note by ${series.providerName} associated with the later measurement states: “${excerpt(firstNote)}”`
      : ""
  }`;

  const changedSessions = changes.flatMap(({ previous, current }) => [
    previous,
    current,
  ]);
  return {
    summary,
    evidence: changedSessions.map((session) =>
      evidenceForSession(context, series, session)
    ),
  };
}

function comparableSessions(series: GoalSeries) {
  return series.sessions
    .filter(
      (session, index, sessions) =>
        session.valueBasis === series.measurementValueBasis &&
        typeof session.measurementValue === "number" &&
        Number.isFinite(session.measurementValue) &&
        sessions.findIndex(
          (candidate) => candidate.sessionId === session.sessionId
        ) === index
    )
    .sort(
      (left, right) =>
        new Date(left.date).getTime() - new Date(right.date).getTime()
    );
}

function evidenceForSession(
  context: InsightContext,
  series: GoalSeries,
  session: GoalSeriesSession
) {
  const note = documentationNote(context, session.sessionId);
  return {
    label: `${series.target} ${series.metricType === "Subjective" ? "rating" : "measurement"} — ${series.providerName}`,
    value: `${formatValue(session.measurementValue!, series.metricType)}.${
      note ? ` Provider note: ${excerpt(note)}` : ""
    }`,
    date: session.date,
    sourceId: session.sessionId,
  };
}

function documentationNote(context: InsightContext, sessionId: string) {
  return context.sessions.find((session) => session.id === sessionId)?.note?.trim() ?? null;
}

function formatValue(value: number, metricType: string) {
  if (metricType === "Subjective") return `rating ${value}`;
  if (metricType === "Percentage") return `${value}%`;
  if (metricType === "Frequency") return `count ${value}`;
  return `duration ${value}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function terms(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((term) => term.length >= 3);
}

function excerpt(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 220
    ? normalized
    : `${normalized.slice(0, 217).trimEnd()}…`;
}
