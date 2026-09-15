import { AssessmentDomain, MetricType, Role } from "@prisma/client";
import { normalizeItem } from "@/lib/sessionScoring";
import { buildInsightContext, type InsightContext } from "./insightContext";
import type { InsightCategory } from "@/app/libs/insights/categories";
import { formatClinicalDateTime } from "@/app/libs/dateTime";
import {
  buildEntryRevisionChanges,
  type EntryRevisionSnapshot,
} from "@/app/libs/entryRevision";
import { formatRevisionUpdate } from "@/app/portal/notes/view/noteHistoryRevision";
import { formatProviderDisplayName } from "../../libs/providerDisplayName";

export type ParsedInsightQuestion = {
  providerRole?: string;
  metricType?: "Percentage" | "Frequency" | "Duration" | "Subjective";
  domainFocus?: Array<"Behavior" | "SkillAcquisition" | "Communication" | "Adaptive" | "Regulation" | "Other">;
  dateRange?: { from: Date; to: Date };
  threshold?: number;
  comparison?: "above" | "below";
  intent: "summary" | "ranking" | "trend" | "compliance";
  context?: string[];
};

export type InsightResult = {
  category?: InsightCategory;
  headline?: string;
  summary: string;
  context?: string;
  trend?: "up" | "down" | "flat";
  answerMode?: "deterministic" | "synthesized" | "insufficient";
  confidence?: "high" | "medium" | "low";
  limitations?: string[];
  evidence?: Array<{
    label: string;
    value: string;
    date?: string;
    sourceId?: string;
  }>;
  supportingData?: {
    providers?: Array<{
      providerId: string;
      providerName: string;
      role: string;
      avgScore?: number;
      avgPercent?: number;
      sessions?: number;
      avgDelayHours?: number;
    }>;
    behaviors?: Array<{
      target: string;
      avgFrequency: number;
      observations: number;
    }>;
    sessions?: number;
  };
};

type InsightBuildOptions = {
  category: InsightCategory;
  viewerProviderId: string;
  context?: InsightContext | null;
};

type InsightEntry = InsightContext["sessions"][number];
type ProviderInsight = NonNullable<
  NonNullable<InsightResult["supportingData"]>["providers"]
>[number];
type BehaviorInsight = NonNullable<
  NonNullable<InsightResult["supportingData"]>["behaviors"]
>[number];

const roleAliases: Array<[RegExp, Role]> = [
  [/\b(parent|caregiver|caretaker|family|home)\b/i, Role.Caregiver],
  [/\b(speech|slp|pathologist)\b/i, Role.SpeechPathologist],
  [/\b(occupational|ot)\b/i, Role.OccupationalTherapist],
  [/\b(behavior|bt|rbt|technician|therapist)\b/i, Role.BehaviorTherapist],
  [/\b(teacher|educator|school)\b/i, Role.Educator],
  [/\b(supervisor|bcba)\b/i, Role.Supervisor],
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function parseDateRange(question: string, now = new Date()) {
  if (/\b(today|tonight)\b/i.test(question)) {
    return {
      from: startOfDay(now),
      to: endOfDay(now),
    };
  }

  if (/\b(yesterday|previous day)\b/i.test(question)) {
    const yesterday = startOfDay(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      from: yesterday,
      to: endOfDay(yesterday),
    };
  }

  const monthNames =
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const dateMatch = question.match(
    new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`, "i")
  );

  if (!dateMatch) return undefined;

  const year = Number(dateMatch[3] ?? new Date().getFullYear());
  const parsed = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${year}`);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return {
    from: startOfDay(parsed),
    to: endOfDay(parsed),
  };
}

export function parseQuestion(
  question: string,
  now = new Date()
): ParsedInsightQuestion {
  const normalized = question.toLowerCase();
  const role = roleAliases.find(([pattern]) => pattern.test(question))?.[1];
  const metricType = Object.values(MetricType).find((type) =>
    normalized.includes(type.toLowerCase())
  );
  const domainFocus = [
    /\b(behavior|aggression|elopement|self[-\s]?injury|tantrum|meltdown|safety)\b/.test(normalized)
      ? AssessmentDomain.Behavior
      : null,
    /\b(communication|speech|language|aac|mand|manding|request|intraverbal|conversation|pragmatic|articulation|intelligibility)\b/.test(normalized)
      ? AssessmentDomain.Communication
      : null,
    /\b(sensory|regulation|tolerance|attention|self[-\s]?regulation)\b/.test(normalized)
      ? AssessmentDomain.Regulation
      : null,
    /\b(adaptive|daily living|adl|toilet|toileting|feeding|dressing|transition|routine|independence)\b/.test(normalized)
      ? AssessmentDomain.Adaptive
      : null,
    /\b(education|academic|reading|writing|math|classroom|homework|skill acquisition|learning)\b/.test(normalized)
      ? AssessmentDomain.SkillAcquisition
      : null,
    /\b(supervision|fidelity|training|clinical review|program integrity)\b/.test(normalized)
      ? AssessmentDomain.Other
      : null,
  ].filter((value): value is AssessmentDomain => Boolean(value));
  const thresholdMatch = normalized.match(/\b(above|over|greater than|below|under|less than)\s+(\d+(?:\.\d+)?)\s*%?/);
  const thresholdValue = thresholdMatch ? Number(thresholdMatch[2]) : undefined;
  const comparison = thresholdMatch
    ? /above|over|greater/.test(thresholdMatch[1])
      ? "above"
      : "below"
    : undefined;

  let intent: ParsedInsightQuestion["intent"] = "summary";
  if (/\b(most|least|lowest|highest|struggles?|challenging|difficult)\b/.test(normalized)) {
    intent = "ranking";
  }
  if (/\b(trend|improv|declin|progress|over time)\b/.test(normalized)) {
    intent = "trend";
  }
  if (/\b(submits?|submitted|late|delay|timing|compliance)\b/.test(normalized)) {
    intent = "compliance";
  }

  const context = [
    /\bmorning\b/.test(normalized) ? "morning" : null,
    /\bafternoon\b/.test(normalized) ? "afternoon" : null,
    /\bevening\b/.test(normalized) ? "evening" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    providerRole: role,
    metricType,
    domainFocus: domainFocus.length ? Array.from(new Set(domainFocus)) : undefined,
    dateRange: parseDateRange(question, now),
    threshold: thresholdValue,
    comparison,
    intent,
    context: context.length ? context : undefined,
  };
}

function formatRole(role: string) {
  return role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^Caregiver$/, "Caretaker");
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeScore(item: InsightEntry["items"][number]) {
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

function entryMatchesContext(entry: InsightEntry, parsed: ParsedInsightQuestion) {
  if (!parsed.context?.length) return true;

  const searchText = [
    entry.note,
    ...entry.items.flatMap((item) => [item.target, item.goal]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return parsed.context.some((token) => searchText.includes(token));
}

function providerSummaries(entries: InsightEntry[], parsed: ParsedInsightQuestion) {
  const providerMap = new Map<
    string,
    {
      providerId: string;
      providerName: string;
      role: string;
      scores: number[];
      entries: InsightEntry[];
    }
  >();

  for (const entry of entries) {
    const scores = entry.items
      .filter(
        (item) =>
          (!parsed.metricType || item.metricType === parsed.metricType) &&
          (!parsed.domainFocus?.length ||
            (item.domain !== null &&
              parsed.domainFocus.includes(item.domain)))
      )
      .map(normalizeScore)
      .filter((score): score is number => score !== null);

    if (scores.length === 0) continue;

    const existing =
      providerMap.get(entry.providerId) ??
      {
        providerId: entry.providerId,
        providerName: formatProviderDisplayName(
          entry.provider.firstName,
          entry.provider.lastName
        ),
        role: formatRole(entry.provider.role),
        scores: [],
        entries: [],
      };

    existing.scores.push(...scores);
    existing.entries.push(entry);
    providerMap.set(entry.providerId, existing);
  }

  return Array.from(providerMap.values()).map((provider) => {
    const avgScore = average(provider.scores) ?? 0;
    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      role: provider.role,
      avgScore,
      avgPercent: avgScore * 10,
      sessions: provider.entries.length,
    };
  });
}

function mostDifficultBehavior(entries: InsightEntry[]): InsightResult {
  const behaviorMap = new Map<string, { target: string; values: number[] }>();

  for (const entry of entries) {
    for (const item of entry.items) {
      if (
        item.metricType !== MetricType.Frequency ||
        item.domain !== AssessmentDomain.Behavior ||
        typeof item.rawValue !== "number"
      ) {
        continue;
      }

      const existing = behaviorMap.get(item.target) ?? { target: item.target, values: [] };
      existing.values.push(item.rawValue);
      behaviorMap.set(item.target, existing);
    }
  }

  const behaviors = Array.from(behaviorMap.values())
    .map((behavior) => ({
      target: behavior.target,
      avgFrequency: average(behavior.values) ?? 0,
      observations: behavior.values.length,
    }))
    .sort((a, b) => b.avgFrequency - a.avgFrequency);

  if (behaviors.length === 0) {
    return {
      ...formatNoDataObservation("No frequency-based behavior patterns were found for this client."),
      supportingData: { behaviors: [], sessions: entries.length },
    };
  }

  const top = behaviors[0];
  return {
    ...formatBehaviorObservation(top),
    supportingData: { behaviors, sessions: entries.length },
  };
}

function noteTimingCompliance(entries: InsightEntry[]): InsightResult {
  const providers = new Map<
    string,
    {
      providerId: string;
      providerName: string;
      role: string;
      delays: number[];
    }
  >();

  for (const entry of entries) {
    const delayHours =
      Math.max(0, entry.createdAt.getTime() - entry.date.getTime()) / (1000 * 60 * 60);
    const existing =
      providers.get(entry.providerId) ??
      {
        providerId: entry.providerId,
        providerName: formatProviderDisplayName(
          entry.provider.firstName,
          entry.provider.lastName
        ),
        role: formatRole(entry.provider.role),
        delays: [],
      };

    existing.delays.push(delayHours);
    providers.set(entry.providerId, existing);
  }

  const ranked = Array.from(providers.values())
    .map((provider) => ({
      providerId: provider.providerId,
      providerName: provider.providerName,
      role: provider.role,
      avgDelayHours: average(provider.delays) ?? 0,
      sessions: provider.delays.length,
    }))
    .sort((a, b) => b.avgDelayHours - a.avgDelayHours);

  if (ranked.length === 0) {
    return {
      ...formatNoDataObservation("No submitted notes were found for this client."),
      supportingData: { providers: [], sessions: 0 },
    };
  }

  const slowest = ranked[0];
  return {
    ...formatComplianceObservation(slowest),
    supportingData: { providers: ranked, sessions: entries.length },
  };
}

function trendFor(entries: InsightEntry[], parsed: ParsedInsightQuestion): InsightResult["trend"] {
  const datedScores = entries
    .map((entry) => {
      const scores = entry.items
        .filter(
          (item) =>
            (!parsed.metricType || item.metricType === parsed.metricType) &&
            (!parsed.domainFocus?.length ||
              (item.domain !== null &&
                parsed.domainFocus.includes(item.domain)))
        )
        .map(normalizeScore)
        .filter((score): score is number => score !== null);

      return {
        date: entry.createdAt.getTime(),
        score: average(scores),
      };
    })
    .filter((point): point is { date: number; score: number } => point.score !== null)
    .sort((a, b) => a.date - b.date);

  if (datedScores.length < 2) return undefined;

  const midpoint = Math.ceil(datedScores.length / 2);
  const first = average(datedScores.slice(0, midpoint).map((point) => point.score));
  const second = average(datedScores.slice(midpoint).map((point) => point.score));

  if (first === null || second === null || Math.abs(second - first) < 0.35) return "flat";
  return second > first ? "up" : "down";
}

function formatTrendObservation(trend: InsightResult["trend"]) {
  switch (trend) {
    case "up":
      return "Recent sessions are beginning to show a more consistent pattern.";
    case "down":
      return "Recent sessions suggest this area may need closer follow-up.";
    case "flat":
      return "The pattern has stayed fairly steady across the available sessions.";
    default:
      return undefined;
  }
}

function consistencyBand(avgPercent: number) {
  if (avgPercent >= 80) return "strong consistency";
  if (avgPercent >= 60) return "moderate consistency";
  if (avgPercent >= 40) return "emerging consistency";
  return "limited consistency";
}

function expectedRangeLabel(thresholdPercent: number) {
  if (thresholdPercent >= 70) return "the expected range";
  if (thresholdPercent >= 50) return "the developing range";
  return "the early skill range";
}

function joinObservation(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatNoDataObservation(summary: string) {
  return {
    summary,
  };
}

function formatAverageObservation({
  roleLabel,
  avgPercent,
  sessions,
  trend,
}: {
  roleLabel: string;
  avgPercent: number;
  sessions: number;
  trend: InsightResult["trend"];
}) {
  const subject = roleLabel === "The care team" ? "The care team" : `${roleLabel} sessions`;
  const band = consistencyBand(avgPercent);

  return {
    headline: "Overall pattern",
    summary: joinObservation([
      `${subject} is showing ${band} overall.`,
      formatTrendObservation(trend),
    ]),
    context:
      sessions > 1
        ? `This reflects the available pattern across ${sessions} sessions.`
        : "This reflects the available pattern from one session.",
  };
}

function formatBehaviorObservation(behavior: BehaviorInsight) {
  return {
    headline: "Behavior pattern",
    summary: `${behavior.target}-related behaviors appeared more consistently than other tracked behaviors during this period.`,
    context:
      behavior.observations > 1
        ? `This pattern appeared across ${behavior.observations} observations.`
        : "This pattern appeared in the available behavior observation.",
  };
}

function formatComplianceObservation(provider: ProviderInsight) {
  const delay = provider.avgDelayHours ?? 0;
  const timing =
    delay <= 2
      ? "Note timing appears prompt overall."
      : delay <= 24
        ? "Note timing appears generally consistent, with some delay after sessions."
        : "Note timing may need closer follow-up after sessions.";

  return {
    headline: "Note timing",
    summary: `${timing} ${provider.role} notes showed the longest delay in the available records.`,
  };
}

function formatThresholdObservation({
  matched,
  thresholdPercent,
  comparison,
  trend,
}: {
  matched: ProviderInsight[];
  thresholdPercent: number;
  comparison: "above" | "below";
  trend: InsightResult["trend"];
}) {
  const range = expectedRangeLabel(thresholdPercent);

  if (matched.length === 0) {
    return {
      headline: "Threshold pattern",
      summary: joinObservation([
        comparison === "above"
          ? `No provider group is consistently above ${range} right now.`
          : `No provider group is consistently below ${range} right now.`,
        formatTrendObservation(trend),
      ]),
    };
  }

  const roles = matched.map((provider) => provider.role).join(", ");
  const direction =
    comparison === "above"
      ? `showed steadier performance within ${range}`
      : `may need additional support within ${range}`;

  return {
    headline: "Threshold pattern",
    summary: joinObservation([
      `${roles} ${direction}.`,
      formatTrendObservation(trend),
    ]),
  };
}

function formatRankingObservation({
  provider,
  trend,
}: {
  provider: ProviderInsight;
  trend: InsightResult["trend"];
}) {
  return {
    headline: "Support pattern",
    summary: joinObservation([
      `Additional support may be useful during ${provider.role.toLowerCase()} sessions, where consistency was lower than the rest of the care team.`,
      formatTrendObservation(trend),
    ]),
  };
}

export async function buildInsight(
  clientId: string,
  question: string,
  options: InsightBuildOptions
): Promise<InsightResult> {
  const parsed = parseQuestion(question);
  const insightContext =
    options.context === undefined
      ? await buildInsightContext(clientId, parsed, options)
      : options.context;

  if (!insightContext) {
    return {
      category: options.category,
      summary: "No matching client data was found.",
      supportingData: { sessions: 0 },
    };
  }

  if (options.category === "overview") {
    return buildOverviewInsight(insightContext, question);
  }
  if (options.category === "documentation") {
    return buildDocumentationInsight(insightContext, question);
  }
  if (options.category === "providers") {
    return buildProviderInsight(insightContext, question);
  }
  if (options.category === "caseSupport") {
    return buildCaseSupportInsight(insightContext, question);
  }

  const targetProgressInsight = buildTargetProgressInsight(
    insightContext,
    question,
    parsed
  );
  if (targetProgressInsight) {
    return targetProgressInsight;
  }

  const rawEntries = insightContext?.sessions ?? [];
  const entries = rawEntries.filter((entry) => entryMatchesContext(entry, parsed));

  if (entries.length === 0) {
    return {
      category: "progress",
      ...formatNoDataObservation("No matching data was found for this client."),
      supportingData: { sessions: 0 },
    };
  }

  if (parsed.intent === "compliance") {
    return {
      category: "progress",
      ...noteTimingCompliance(entries),
    };
  }

  if (
    parsed.intent === "ranking" &&
    (parsed.metricType === "Frequency" ||
      /\b(challenging|difficult|behavior)\b/i.test(question))
  ) {
    return {
      category: "progress",
      ...mostDifficultBehavior(entries),
    };
  }

  const providers = providerSummaries(entries, parsed).sort((a, b) => a.avgScore - b.avgScore);
  if (providers.length === 0) {
    return {
      category: "progress",
      ...formatNoDataObservation("No scored assessment data was found for this client."),
      supportingData: { providers: [], sessions: entries.length },
    };
  }

  const thresholdScore =
    parsed.threshold !== undefined
      ? parsed.threshold > 10
        ? parsed.threshold / 10
        : parsed.threshold
      : undefined;

  if (thresholdScore !== undefined && parsed.comparison) {
    const matched = providers.filter((provider) =>
      parsed.comparison === "above"
        ? provider.avgScore > thresholdScore
        : provider.avgScore < thresholdScore
    );
    const trend = trendFor(entries, parsed);

    return {
      category: "progress",
      ...formatThresholdObservation({
        matched,
        thresholdPercent: thresholdScore * 10,
        comparison: parsed.comparison,
        trend,
      }),
      trend,
      supportingData: { providers: matched, sessions: entries.length },
    };
  }

  if (parsed.intent === "ranking") {
    const lowest = providers[0];
    const trend = trendFor(entries, parsed);
    return {
      category: "progress",
      ...formatRankingObservation({ provider: lowest, trend }),
      trend,
      supportingData: { providers, sessions: entries.length },
    };
  }

  const avgScore = average(providers.map((provider) => provider.avgScore)) ?? 0;
  const roleLabel = parsed.providerRole ? formatRole(parsed.providerRole) : "The care team";
  const trend = trendFor(entries, parsed);
  return {
    category: "progress",
    ...formatAverageObservation({
      roleLabel,
      avgPercent: avgScore * 10,
      sessions: entries.length,
      trend,
    }),
    trend,
    supportingData: { providers, sessions: entries.length },
  };
}

function buildOverviewInsight(
  context: InsightContext,
  question: string
): InsightResult {
  const fieldObservationInsight = buildFieldObservationInsight(
    context,
    question,
    "overview"
  );
  if (fieldObservationInsight) return fieldObservationInsight;

  const latestDocumentation = [...context.documentationRecords].sort(
    (left, right) =>
      new Date(right.completedAt ?? right.updatedAt).getTime() -
      new Date(left.completedAt ?? left.updatedAt).getTime()
  )[0];
  const openCases = context.caseSupport.cases.filter(
    (caseRecord) => caseRecord.status === "OPEN"
  );
  const pendingRequests = context.caseSupport.requests.filter((request) =>
    ["REQUESTED", "ACKNOWLEDGED"].includes(request.status)
  );
  const focus = context.currentTeamFocus;
  const asksTeamFocus = /\b(team\s*focus|current focus|focus banner)\b/i.test(
    question
  );
  const asksCaseSupport = /\b(case support|support request|open case)\b/i.test(
    question
  );
  const asksRecentActivity =
    /\b(recent|latest|today|activity|happened|new)\b/i.test(question) &&
    !asksCaseSupport;
  const asksCareTeam =
    /\b(care team|providers?|who is involved|who.*assigned|assigned team)\b/i.test(
      question
    );

  if (asksTeamFocus) {
    return {
      category: "overview",
      headline: "Current Team Focus",
      summary: focus
        ? `${focus.title ? `${focus.title}: ` : ""}${focus.content}`
        : "No active Team Focus is currently displayed for this client.",
      supportingData: { sessions: context.precomputedStatistics.sessionCount },
      evidence: focus
        ? [
            {
              label: focus.authorName,
              value: `Updated ${formatClinicalDateTime(focus.updatedAt)}`,
              date: focus.updatedAt,
              sourceId: focus.id,
            },
          ]
        : [],
    };
  }

  if (asksRecentActivity) {
    if (!latestDocumentation) {
      return {
        category: "overview",
        headline: "Recent activity",
        summary: "No completed documentation is available for this client.",
        supportingData: { sessions: 0 },
      };
    }

    return {
      category: "overview",
      headline: "Recent activity",
      summary: `${latestDocumentation.providerName} completed the most recent ${humanizeValue(latestDocumentation.kind)} on ${formatClinicalDateTime(latestDocumentation.completedAt ?? latestDocumentation.updatedAt)}.`,
      supportingData: { sessions: context.precomputedStatistics.sessionCount },
      evidence: [
        {
          label: humanizeValue(latestDocumentation.kind),
          value:
            latestDocumentation.note ||
            latestDocumentation.observations[0]?.observation ||
            "Completed documentation",
          date:
            latestDocumentation.completedAt ?? latestDocumentation.updatedAt,
          sourceId: latestDocumentation.id,
        },
      ],
    };
  }

  if (asksCareTeam) {
    const providersWithActivity = context.providerRelationships.filter(
      (provider) => provider.totalSessions > 0
    );
    return {
      category: "overview",
      headline: "Care team",
      summary: `${context.careTeam.length} providers are assigned to this client. ${providersWithActivity.length} have contributed completed documentation.`,
      supportingData: {
        sessions: context.precomputedStatistics.sessionCount,
        providers: context.providerRelationships.map((provider) => ({
          providerId: provider.providerId,
          providerName: provider.providerName,
          role: humanizeValue(provider.assignmentRole),
          sessions: provider.totalSessions,
        })),
      },
      evidence: context.careTeam.map((provider) => ({
        label: provider.providerName,
        value: humanizeValue(provider.assignmentRole),
        sourceId: provider.providerId,
      })),
    };
  }

  if (asksCaseSupport) {
    return {
      category: "overview",
      headline: "Case Support",
      summary:
        pendingRequests.length || openCases.length
          ? `${pendingRequests.length} request${pendingRequests.length === 1 ? " is" : "s are"} awaiting action and ${openCases.length} case-support record${openCases.length === 1 ? " is" : "s are"} open.`
          : "No accessible case-support request is awaiting action and no accessible case-support record is open.",
      supportingData: { sessions: context.precomputedStatistics.sessionCount },
      evidence: [
        ...pendingRequests.slice(0, 2).map((request) => ({
          label: `Request from ${request.requesterName}`,
          value: request.concern,
          date: request.createdAt,
          sourceId: request.id,
        })),
        ...openCases.slice(0, 2).map((caseRecord) => ({
          label: caseRecord.title,
          value: caseRecord.concern,
          date: caseRecord.updatedAt,
          sourceId: caseRecord.id,
        })),
      ],
    };
  }

  const parts = [
    `${context.precomputedStatistics.providersWithSessions} providers have contributed across ${context.precomputedStatistics.sessionCount} completed sessions.`,
    focus ? `The current Team Focus is “${focus.title || focus.content}.”` : null,
    pendingRequests.length
      ? `${pendingRequests.length} case-support request${pendingRequests.length === 1 ? " is" : "s are"} awaiting action.`
      : null,
    openCases.length
      ? `${openCases.length} case-support record${openCases.length === 1 ? " is" : "s are"} open.`
      : null,
  ].filter((part): part is string => Boolean(part));

  return {
    category: "overview",
    headline: "Client overview",
    summary: parts.join(" "),
    supportingData: { sessions: context.precomputedStatistics.sessionCount },
    evidence: [
      ...(focus
        ? [
            {
              label: "Team Focus",
              value: focus.title || focus.content,
              date: focus.updatedAt,
              sourceId: focus.id,
            },
          ]
        : []),
      ...(latestDocumentation
        ? [
            {
              label: "Latest documentation",
              value: `${latestDocumentation.providerName} · ${humanizeValue(latestDocumentation.kind)}`,
              date:
                latestDocumentation.completedAt ??
                latestDocumentation.updatedAt,
              sourceId: latestDocumentation.id,
            },
          ]
        : []),
    ],
  };
}

function buildDocumentationInsight(
  context: InsightContext,
  question: string
): InsightResult {
  const fieldObservationInsight = buildFieldObservationInsight(
    context,
    question,
    "documentation"
  );
  if (fieldObservationInsight) return fieldObservationInsight;

  const records = filterRecordsByProvider(
    context.documentationRecords,
    question
  ).sort(
    (left, right) =>
      new Date(right.completedAt ?? right.updatedAt).getTime() -
      new Date(left.completedAt ?? left.updatedAt).getTime()
  );

  if (records.length === 0) {
    return {
      category: "documentation",
      headline: "Documentation",
      summary: "No matching completed documentation was found.",
      supportingData: { sessions: 0 },
    };
  }

  const asksAboutRevision =
    /\b(update|updated|change|changed|revision|revised|edit|edited)\b/i.test(
      question
    );
  if (asksAboutRevision) {
    const revisedRecord = records.find((record) => record.revisions.length > 1);
    const revisionUpdate = revisedRecord
      ? buildLatestRevisionUpdate(revisedRecord.revisions)
      : null;

    if (!revisedRecord || !revisionUpdate || revisionUpdate.changes.length === 0) {
      return {
        category: "documentation",
        headline: "Documentation updates",
        summary: "No matching documented changes were found.",
        supportingData: { sessions: records.length },
      };
    }

    return {
      category: "documentation",
      headline: "Latest documented update",
      summary: `${revisionUpdate.authorName} updated ${humanizeValue(revisedRecord.kind)}. ${revisionUpdate.changes
        .map((change) => `${change.label}: ${change.value}`)
        .join(" ")}`,
      supportingData: { sessions: records.length },
      evidence: revisionUpdate.changes.map((change) => ({
        label: change.label,
        value: change.value,
        date: revisionUpdate.createdAt,
        sourceId: revisedRecord.id,
      })),
    };
  }

  const asksForCount =
    /\b(how many|count|number of|total)\b/i.test(question) &&
    /\b(notes?|documentation|records?|sessions?)\b/i.test(question);
  if (asksForCount) {
    const authors = Array.from(
      new Set(records.map((record) => record.providerName))
    );
    return {
      category: "documentation",
      headline: "Documentation count",
      summary: `${records.length} matching completed record${records.length === 1 ? " was" : "s were"} found from ${authors.length} provider${authors.length === 1 ? "" : "s"}.`,
      supportingData: { sessions: records.length },
      evidence: authors.map((author) => ({
        label: author,
        value: `${records.filter((record) => record.providerName === author).length} completed record${records.filter((record) => record.providerName === author).length === 1 ? "" : "s"}`,
      })),
    };
  }

  const latest = records[0];
  const asksWho =
    /\b(who|filed|submitted|documented|author|provider)\b/i.test(question);
  return {
    category: "documentation",
    headline: asksWho ? "Documentation author" : "Latest documentation",
    summary: asksWho
      ? `${latest.providerName} (${humanizeValue(latest.providerRole)}) completed the latest matching ${humanizeValue(latest.kind)} on ${formatClinicalDateTime(latest.completedAt ?? latest.updatedAt)}.`
      : `The latest matching record is ${humanizeValue(latest.kind)}, completed by ${latest.providerName} on ${formatClinicalDateTime(latest.completedAt ?? latest.updatedAt)}.`,
    supportingData: { sessions: records.length },
    evidence: [
      {
        label: humanizeValue(latest.kind),
        value:
          latest.note ||
          latest.observations[0]?.observation ||
          "Completed documentation",
        date: latest.completedAt ?? latest.updatedAt,
        sourceId: latest.id,
      },
    ],
  };
}

function buildProviderInsight(
  context: InsightContext,
  question: string
): InsightResult {
  const fieldObservationInsight = buildFieldObservationInsight(
    context,
    question,
    "providers"
  );
  if (fieldObservationInsight) return fieldObservationInsight;

  const normalizedQuestion = question.toLowerCase();
  const matched = context.providerRelationships.filter((provider) => {
    const nameMatch = normalizedQuestion.includes(
      provider.providerName.toLowerCase()
    );
    const firstName = provider.providerName.split(/\s+/)[0]?.toLowerCase();
    const roleMatch = roleAliases.some(
      ([pattern, role]) =>
        role === provider.accountRole && pattern.test(question)
    );
    return nameMatch || Boolean(firstName && normalizedQuestion.includes(firstName)) || roleMatch;
  });
  const providers = matched.length ? matched : context.providerRelationships;
  const asksRecentContributors =
    /\b(recent|recently|latest)\b/i.test(question) &&
    /\b(contribut|document|note|session|activity)\b/i.test(question);
  const asksOverlap =
    /\b(overlap|shared|same areas?|same goals?|together|both|compare|comparison|differently|difference)\b/i.test(
      question
    );
  const asksProviderObservation =
    /\b(observ(?:e|ed|ation|ations)?|document(?:ed|ation)?|notes?|record(?:ed)?)\b/i.test(
      question
    ) && matched.length === 1;

  if (providers.length === 0) {
    return {
      category: "providers",
      headline: "Providers",
      summary: "No provider activity was found for this client.",
      supportingData: { providers: [], sessions: 0 },
    };
  }

  const asksProviderPerformance =
    /\b(perform(?:ed|ance|ing)?|how (?:did|is|has)|doing)\b/i.test(question);
  if (asksProviderPerformance && providers.length === 1) {
    return buildProviderRecordedPerformanceInsight(context, providers[0]);
  }

  if (asksRecentContributors) {
    const latestByProvider = new Map<
      string,
      InsightContext["documentationRecords"][number]
    >();
    for (const record of [...context.documentationRecords].sort(
      (left, right) =>
        new Date(right.completedAt ?? right.updatedAt).getTime() -
        new Date(left.completedAt ?? left.updatedAt).getTime()
    )) {
      if (!latestByProvider.has(record.providerId)) {
        latestByProvider.set(record.providerId, record);
      }
    }
    const recent = Array.from(latestByProvider.values()).slice(0, 5);
    return {
      category: "providers",
      headline: "Recent provider contributions",
      summary: recent.length
        ? `${recent.length} provider${recent.length === 1 ? " has" : "s have"} recent completed documentation. ${recent
            .map(
              (record) =>
                `${record.providerName} completed ${humanizeValue(record.kind)}`
            )
            .join("; ")}.`
        : "No recent completed provider documentation was found.",
      supportingData: {
        sessions: context.precomputedStatistics.sessionCount,
      },
      evidence: recent.map((record) => ({
        label: record.providerName,
        value: humanizeValue(record.kind),
        date: record.completedAt ?? record.updatedAt,
        sourceId: record.id,
      })),
    };
  }

  if (asksProviderObservation) {
    const provider = matched[0];
    const latestRecord = [...context.documentationRecords]
      .filter((record) => record.providerId === provider.providerId)
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.updatedAt).getTime() -
          new Date(left.completedAt ?? left.updatedAt).getTime()
      )[0];

    return {
      category: "providers",
      headline: `${provider.providerName} contribution`,
      summary: latestRecord
        ? `${provider.providerName} most recently completed ${humanizeValue(latestRecord.kind)} on ${formatClinicalDateTime(latestRecord.completedAt ?? latestRecord.updatedAt)}.`
        : `${provider.providerName} is assigned to this client, but no matching completed documentation was found.`,
      supportingData: {
        sessions: provider.totalSessions,
      },
      evidence: latestRecord
        ? [
            {
              label: humanizeValue(latestRecord.kind),
              value:
                latestRecord.note ||
                latestRecord.observations[0]?.observation ||
                "Completed documentation",
              date: latestRecord.completedAt ?? latestRecord.updatedAt,
              sourceId: latestRecord.id,
            },
          ]
        : [],
    };
  }

  if (asksOverlap) {
    const matchedIds = new Set(matched.map((provider) => provider.providerId));
    const overlap = context.providerOverlap.find((candidate) =>
      matchedIds.size >= 2
        ? matchedIds.has(candidate.providerAId) &&
          matchedIds.has(candidate.providerBId)
        : candidate.relationshipMatches.length > 0 ||
          candidate.sharedDomains.length > 0
    );

    if (!overlap) {
      return {
        category: "providers",
        headline: "Provider overlap",
        summary:
          "No tracked overlap was found between the matching providers. This means the available goals and domains do not currently establish a shared area.",
        supportingData: { providers: [], sessions: 0 },
      };
    }

    const sharedAreas = [
      ...overlap.sharedTargets,
      ...overlap.sharedDomains.map(humanizeValue),
    ].filter((value, index, values) => values.indexOf(value) === index);
    const uniqueA = overlap.uniqueDomains.providerA.map(humanizeValue);
    const uniqueB = overlap.uniqueDomains.providerB.map(humanizeValue);
    return {
      category: "providers",
      headline: "Provider overlap",
      summary: sharedAreas.length
        ? `${overlap.providerAName} and ${overlap.providerBName} overlap in ${sharedAreas.join(", ")}. ${uniqueA.length ? `${overlap.providerAName} also contributes ${uniqueA.join(", ")}.` : ""} ${uniqueB.length ? `${overlap.providerBName} also contributes ${uniqueB.join(", ")}.` : ""}`.trim()
        : `${overlap.providerAName} and ${overlap.providerBName} do not have a directly shared tracked target or domain in the available data. ${uniqueA.length ? `${overlap.providerAName} contributes ${uniqueA.join(", ")}.` : ""} ${uniqueB.length ? `${overlap.providerBName} contributes ${uniqueB.join(", ")}.` : ""}`.trim(),
      supportingData: { sessions: overlap.overlappingSessions.length },
      evidence: [
        {
          label: "Shared areas",
          value: sharedAreas.length ? sharedAreas.join(", ") : "None recorded",
        },
        {
          label: overlap.providerAName,
          value: uniqueA.length ? uniqueA.join(", ") : "No unique domain recorded",
          sourceId: overlap.providerAId,
        },
        {
          label: overlap.providerBName,
          value: uniqueB.length ? uniqueB.join(", ") : "No unique domain recorded",
          sourceId: overlap.providerBId,
        },
      ],
    };
  }

  const summary =
    providers.length === 1
      ? providerSummarySentence(providers[0])
      : `${providers.length} assigned providers are represented. ${providers
          .slice(0, 3)
          .map(providerSummarySentence)
          .join(" ")}`;

  return {
    category: "providers",
    headline: providers.length === 1 ? providers[0].providerName : "Care team",
    summary,
    supportingData: {
      sessions: providers.reduce(
        (sum, provider) => sum + provider.totalSessions,
        0
      ),
      providers: providers.map((provider) => ({
        providerId: provider.providerId,
        providerName: provider.providerName,
        role: humanizeValue(provider.assignmentRole),
        sessions: provider.totalSessions,
        avgPercent: provider.averageNormalizedPerformance ?? undefined,
      })),
    },
    evidence: providers.map((provider) => ({
      label: provider.providerName,
      value: `${humanizeValue(provider.assignmentRole)} · ${provider.totalSessions} completed session${provider.totalSessions === 1 ? "" : "s"} · ${provider.activeGoals.length} active goal${provider.activeGoals.length === 1 ? "" : "s"}`,
      sourceId: provider.providerId,
    })),
  };
}

function buildProviderRecordedPerformanceInsight(
  context: InsightContext,
  provider: InsightContext["providerRelationships"][number]
): InsightResult {
  const observations = [...(context.fieldObservations ?? [])]
    .filter(
      (observation) =>
        observation.observedProvider.id === provider.providerId
    )
    .sort(
      (left, right) =>
        new Date(right.observedAt).getTime() -
        new Date(left.observedAt).getTime()
    );
  const series = context.providerGoalSeries
    .filter((item) => item.providerId === provider.providerId)
    .filter((item) => item.sessions.length > 0)
    .slice(0, 3);

  const measurementStatements = series.map((item) => {
    const metric = humanizeValue(item.metricType).toLowerCase();
    const subject = item.target.toLowerCase().includes(metric)
      ? item.target
      : `${item.target} ${metric}`;
    const direction =
      item.measurementTrend === "up"
        ? "increased"
        : item.measurementTrend === "down"
          ? "decreased"
          : item.measurementTrend === "flat"
            ? "was stable"
            : "does not yet have a supported direction";
    return `${subject} ${direction} across ${item.sessions.length} completed session${
      item.sessions.length === 1 ? "" : "s"
    }`;
  });
  const observationStatement = observations[0]
    ? `The most recent supervisor Field Observation recorded ${observations[0].fidelityPercent}% fidelity across ${observations[0].applicableItemCount} applicable criteria.`
    : null;
  const summaryParts = [observationStatement, ...measurementStatements].filter(
    (value): value is string => Boolean(value)
  );

  const measurementEvidence = series.flatMap((item) =>
    [...item.sessions]
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.date).getTime() -
          new Date(left.completedAt ?? left.date).getTime()
      )
      .slice(0, 2)
      .map((session) => ({
        label: `${provider.providerName} · ${item.target}`,
        value: `${humanizeValue(item.metricType)} recorded as ${
          session.measurementValue ?? "no native value"
        }`,
        date: session.completedAt ?? session.date,
        sourceId: session.sessionId,
      }))
  );

  return {
    category: "providers",
    headline: `${provider.providerName} recorded data`,
    summary: summaryParts.length
      ? `${provider.providerName}: ${summaryParts.join(" ")}`
      : `${provider.providerName} is assigned to this client, but no matching structured measurements or Field Observations were found.`,
    confidence: observations.length || series.length ? "high" : "low",
    limitations: [
      "Client measurements and Field Observations describe recorded sessions; they do not independently establish causation or provider competency.",
    ],
    supportingData: { sessions: provider.totalSessions },
    evidence: [
      ...observations
        .slice(0, 2)
        .map((observation) =>
          fieldObservationEvidence(
            observation,
            `${observation.fidelityPercent}% fidelity across ${observation.applicableItemCount} applicable criteria`
          )
        ),
      ...measurementEvidence,
    ].slice(0, 8),
  };
}

type InsightFieldObservation = InsightContext["fieldObservations"][number];

const FIELD_OBSERVATION_QUESTION =
  /\b(field\s+observations?|fidelity|rubric|coaching (?:need|needs|focus)|strengths?)\b/i;

function fieldObservationsForQuestion(
  context: InsightContext,
  question: string
) {
  const observations = [...(context.fieldObservations ?? [])].sort(
    (left, right) =>
      new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime()
  );
  if (!observations.length) return observations;

  const normalizedQuestion = question.toLowerCase();
  const providerMatches = observations.filter((observation) => {
    const providerName = observation.observedProvider.name.toLowerCase();
    const firstName = providerName.split(/\s+/)[0];
    const roleMatch = roleAliases.some(
      ([pattern, role]) =>
        role === observation.observedProvider.role && pattern.test(question)
    );
    return (
      normalizedQuestion.includes(providerName) ||
      Boolean(firstName && normalizedQuestion.includes(firstName)) ||
      roleMatch
    );
  });

  return providerMatches.length ? providerMatches : observations;
}

function fieldObservationEvidence(
  observation: InsightFieldObservation,
  value: string
): NonNullable<InsightResult["evidence"]>[number] {
  return {
    label: `${observation.observedProvider.name} Field Observation`,
    value,
    date: observation.observedAt,
    sourceId: observation.id,
  };
}

function fieldObservationSummaryValue(observation: InsightFieldObservation) {
  const parts = [
    `${observation.fidelityPercent}% fidelity across ${observation.applicableItemCount} applicable criteria`,
    observation.strengths ? `Strengths: ${observation.strengths}` : null,
    observation.coachingFocus
      ? `Coaching focus: ${observation.coachingFocus}`
      : null,
    observation.followUp ? `Follow-up: ${observation.followUp}` : null,
  ];
  return parts.filter((part): part is string => Boolean(part)).join("; ");
}

function buildFieldObservationInsight(
  context: InsightContext,
  question: string,
  category: "overview" | "providers" | "documentation"
): InsightResult | null {
  if (!FIELD_OBSERVATION_QUESTION.test(question)) return null;

  const observations = fieldObservationsForQuestion(context, question);
  const limitations = [
    "Field Observations document specific observed sessions and should be reviewed by a supervisor; they do not independently establish employment, disciplinary, competency, or personnel conclusions.",
  ];

  if (observations.length === 0) {
    return {
      category,
      headline: "Field Observations",
      summary:
        "No Field Observations are available for this client. Provider performance cannot be inferred from unrelated notes or documentation.",
      supportingData: { sessions: 0 },
      evidence: [],
      limitations,
    };
  }

  const asksStrengths = /\bstrengths?\b/i.test(question);
  if (asksStrengths) {
    const withStrengths = observations.filter((observation) =>
      Boolean(observation.strengths?.trim())
    );
    return {
      category,
      headline: "Documented Field Observation strengths",
      summary: withStrengths.length
        ? `${withStrengths.length} Field Observation${withStrengths.length === 1 ? " includes" : "s include"} documented strengths. ${withStrengths
            .slice(0, 3)
            .map(
              (observation) =>
                `${observation.observedProvider.name}: ${observation.strengths}`
            )
            .join(" ")}`
        : "Field Observations exist for this client, but no strengths were documented in the matching records.",
      supportingData: { sessions: observations.length },
      evidence: withStrengths.slice(0, 6).map((observation) =>
        fieldObservationEvidence(
          observation,
          observation.strengths ?? "No strengths documented"
        )
      ),
      limitations,
    };
  }

  const asksCoachingCriteria =
    /\b(rubric|criteria|criterion|recurr|coaching (?:need|needs|focus))\b/i.test(
      question
    );
  if (asksCoachingCriteria) {
    const coachingRatings = new Set([
      "PARTIALLY_IMPLEMENTED",
      "NOT_IMPLEMENTED",
    ]);
    const criterionCounts = new Map<
      string,
      { label: string; count: number; notes: string[] }
    >();

    for (const observation of observations) {
      for (const item of observation.items) {
        if (!coachingRatings.has(item.rating)) continue;
        const current = criterionCounts.get(item.criterionKey) ?? {
          label: item.criterionLabel,
          count: 0,
          notes: [],
        };
        current.count += 1;
        if (item.note?.trim()) current.notes.push(item.note.trim());
        criterionCounts.set(item.criterionKey, current);
      }
    }

    const coachingCriteria = [...criterionCounts.values()].sort(
      (left, right) => right.count - left.count || left.label.localeCompare(right.label)
    );
    const recurring = coachingCriteria.filter((criterion) => criterion.count > 1);
    const reported = recurring.length ? recurring : coachingCriteria;
    const reportedLabels = new Set(reported.map((criterion) => criterion.label));

    return {
      category,
      headline: recurring.length
        ? "Recurring Field Observation coaching criteria"
        : "Field Observation coaching criteria",
      summary: reported.length
        ? `${recurring.length ? "Recurring" : "Documented"} coaching needs appear in ${reported
            .slice(0, 6)
            .map(
              (criterion) =>
                `${criterion.label} (${criterion.count} observation${criterion.count === 1 ? "" : "s"})`
            )
            .join(", ")}.`
        : "No partially implemented or not implemented rubric criteria were found in the matching Field Observations.",
      supportingData: { sessions: observations.length },
      evidence: observations
        .filter((observation) =>
          observation.items.some((item) =>
            reportedLabels.has(item.criterionLabel)
          )
        )
        .slice(0, 6)
        .map((observation) =>
          fieldObservationEvidence(
            observation,
            observation.items
              .filter((item) => reportedLabels.has(item.criterionLabel))
              .map(
                (item) =>
                  `${item.criterionLabel}: ${humanizeValue(item.rating.toLowerCase())}${item.note ? ` — ${item.note}` : ""}`
              )
              .join("; ")
          )
        ),
      limitations,
    };
  }

  const asksFidelityChange =
    /\b(fidelity|trend|changed?|increase|decrease|improv|declin)\b/i.test(question);
  if (asksFidelityChange) {
    const byProvider = new Map<string, InsightFieldObservation[]>();
    for (const observation of observations) {
      const existing = byProvider.get(observation.observedProvider.id) ?? [];
      existing.push(observation);
      byProvider.set(observation.observedProvider.id, existing);
    }
    const comparisons = [...byProvider.values()]
      .filter((records) => records.length >= 2)
      .map((records) => {
        const newest = records[0];
        const oldest = records[records.length - 1];
        const change = newest.fidelityPercent - oldest.fidelityPercent;
        const direction = change > 0 ? "increased" : change < 0 ? "decreased" : "was unchanged";
        return { newest, oldest, change, direction };
      });

    return {
      category,
      headline: "Field Observation fidelity",
      summary: comparisons.length
        ? comparisons
            .map(
              ({ newest, oldest, change, direction }) =>
                `${newest.observedProvider.name}'s documented fidelity ${direction} from ${oldest.fidelityPercent}% to ${newest.fidelityPercent}%${change === 0 ? "" : ` (${change > 0 ? "+" : ""}${change} points)`}.`
            )
            .join(" ")
        : "At least two Field Observations for the same provider are required to describe a fidelity change.",
      trend:
        comparisons.length === 1
          ? comparisons[0].change > 0
            ? "up"
            : comparisons[0].change < 0
              ? "down"
              : "flat"
          : undefined,
      supportingData: { sessions: observations.length },
      evidence: (comparisons.length
        ? comparisons.flatMap(({ newest, oldest }) => [newest, oldest])
        : observations.slice(0, 1)
      )
        .filter(
          (observation, index, records) =>
            records.findIndex((candidate) => candidate.id === observation.id) === index
        )
        .slice(0, 8)
        .map((observation) =>
          fieldObservationEvidence(
            observation,
            `${observation.fidelityPercent}% fidelity across ${observation.applicableItemCount} applicable criteria`
          )
        ),
      limitations,
    };
  }

  const newest = observations[0];
  return {
    category,
    headline:
      observations.length === 1
        ? "Recent Field Observation"
        : "Recent Field Observations",
    summary: `${observations.length} matching Field Observation${observations.length === 1 ? " is" : "s are"} available. The most recent observed ${newest.observedProvider.name} at ${newest.fidelityPercent}% fidelity on ${formatClinicalDateTime(newest.observedAt)}.`,
    supportingData: { sessions: observations.length },
    evidence: observations
      .slice(0, 6)
      .map((observation) =>
        fieldObservationEvidence(
          observation,
          fieldObservationSummaryValue(observation)
        )
      ),
    limitations,
  };
}

function buildTargetProgressInsight(
  context: InsightContext,
  question: string,
  parsed: ParsedInsightQuestion
): InsightResult | null {
  const asksTargetOrGoal = /\b(target|goal)\b/i.test(question);

  const series = context.providerGoalSeries
    .map((goalSeries) => {
      const scores = goalSeries.sessions
        .map((session) => session.normalizedScore)
        .filter((score): score is number => score !== null);
      return {
        ...goalSeries,
        average: average(scores),
      };
    })
    .filter((seriesItem) => {
      if (!parsed.domainFocus?.length) return true;
      return (
        seriesItem.domain !== null &&
        parsed.domainFocus.includes(seriesItem.domain)
      );
    });

  const named = series.find((seriesItem) => {
    const normalizedQuestion = question.toLowerCase();
    return (
      Boolean(
        seriesItem.target.trim() &&
          normalizedQuestion.includes(seriesItem.target.toLowerCase())
      ) ||
      Boolean(
        seriesItem.goal.trim() &&
          normalizedQuestion.includes(seriesItem.goal.toLowerCase())
      )
    );
  });
  const asksImproving = /\b(improv|strongest|best progress)\b/i.test(question);
  const asksDeclining = /\b(declin|regress|worsen)\b/i.test(question);
  const asksNeedsSupport =
    /\b(needs? (?:the )?most support|lowest|struggl|challenging|difficult|weakest)\b/i.test(
      question
    );

  if (!asksTargetOrGoal && !named) return null;

  let selected = named;
  if (!selected && asksImproving) {
    selected =
      series.find((seriesItem) => seriesItem.trend === "up") ??
      [...series]
        .filter((seriesItem) => seriesItem.average !== null)
        .sort((left, right) => (right.average ?? 0) - (left.average ?? 0))[0];
  }
  if (!selected && asksDeclining) {
    selected = series.find((seriesItem) => seriesItem.trend === "down");
  }
  if (!selected && asksNeedsSupport) {
    selected = [...series]
      .filter((seriesItem) => seriesItem.average !== null)
      .sort((left, right) => (left.average ?? 0) - (right.average ?? 0))[0];
  }

  if (!selected) {
    if (!asksImproving && !asksDeclining && !asksNeedsSupport && !named) {
      return null;
    }
    return {
      category: "progress",
      headline: "Target progress",
      summary: "No matching scored target history was found.",
      supportingData: { sessions: 0 },
    };
  }

  const trendDescription =
    selected.trend === "up"
      ? "is improving"
      : selected.trend === "down"
        ? "is declining"
        : selected.trend === "flat"
          ? "has remained steady"
          : "does not yet have enough data for a trend";
  const supportLead = asksNeedsSupport
    ? `${selected.target} currently shows the lowest consistency among the matching scored targets.`
    : `${selected.target} ${trendDescription}.`;

  return {
    category: "progress",
    headline: selected.target,
    summary: `${supportLead} ${selected.providerName} has recorded ${selected.sessions.length} matching session${selected.sessions.length === 1 ? "" : "s"}.`,
    trend: selected.trend,
    supportingData: { sessions: selected.sessions.length },
    evidence: selected.sessions
      .slice(-3)
      .reverse()
      .map((session) => ({
        label: selected.target,
        value:
          session.normalizedScore === null
            ? "No normalized score"
            : `${Math.round(session.normalizedScore * 10)}% normalized performance`,
        date: session.date,
        sourceId: session.sessionId,
      })),
  };
}

function buildCaseSupportInsight(
  context: InsightContext,
  question: string
): InsightResult {
  const { requests, cases } = context.caseSupport;
  if (requests.length === 0 && cases.length === 0) {
    return {
      category: "caseSupport",
      headline: "Case Support",
      summary:
        "No accessible case-support request or record was found for this client.",
    };
  }

  const latestRequest = requests[0];
  const latestCase = cases[0];
  const asksWho = /\b(who|filed|requested|author|opened)\b/i.test(question);
  const asksAboutRequest = /\brequest\b/i.test(question);
  const asksAboutDocumentation =
    /\b(documentation|documented|entry|note)\b/i.test(question);
  const asksCoordination =
    /\b(coordination|contact|school|agency|next step|follow.?up|response)\b/i.test(
      question
    );

  if (asksWho && asksAboutRequest) {
    if (!latestRequest) {
      return {
        category: "caseSupport",
        headline: "Case-support requester",
        summary:
          "No accessible case-support request is recorded for this client. An accessible case may have been opened directly by the supervisor.",
      };
    }
    return {
      category: "caseSupport",
      headline: "Case-support requester",
      summary: `${latestRequest.requesterName} (${humanizeValue(latestRequest.requesterRole)}) filed the latest request on ${formatClinicalDateTime(latestRequest.createdAt)}. Its current status is ${humanizeValue(latestRequest.status)}.`,
      evidence: [
        {
          label: "Support concern",
          value: latestRequest.concern,
          date: latestRequest.createdAt,
          sourceId: latestRequest.id,
        },
      ],
    };
  }

  if (asksWho && asksAboutDocumentation && latestCase) {
    const latestEntry = latestCase.entries[0];
    return {
      category: "caseSupport",
      headline: "Case-support documentation",
      summary: latestEntry
        ? `${latestEntry.authorName} (${humanizeValue(latestEntry.authorRole)}) filed the latest case-support documentation on ${formatClinicalDateTime(latestEntry.occurredAt)}.`
        : "No documentation entry has been added to the latest accessible case.",
      evidence: latestEntry
        ? [
            {
              label: humanizeValue(latestEntry.entryType),
              value: latestEntry.whatOccurred,
              date: latestEntry.occurredAt,
              sourceId: latestEntry.id,
            },
          ]
        : [],
    };
  }

  if (asksWho && latestCase) {
    return {
      category: "caseSupport",
      headline: "Case owner",
      summary: `${latestCase.ownerName} owns the latest accessible case, opened on ${formatClinicalDateTime(latestCase.createdAt)}.`,
      evidence: [
        {
          label: latestCase.title,
          value: latestCase.concern,
          date: latestCase.createdAt,
          sourceId: latestCase.id,
        },
      ],
    };
  }

  if (asksCoordination && latestCase) {
    const coordination = latestCase.coordinations[0];
    return {
      category: "caseSupport",
      headline: "Case coordination",
      summary: coordination
        ? `${coordination.authorName} recorded ${humanizeValue(coordination.path)} coordination with status ${humanizeValue(coordination.status)}. ${coordination.nextStep || coordination.requestOrDecision}`
        : "No coordination entry has been recorded for the latest accessible case.",
      evidence: coordination
        ? [
            {
              label: "Action taken",
              value: coordination.actionTaken,
              date: coordination.occurredAt,
              sourceId: coordination.id,
            },
          ]
        : [],
    };
  }

  return {
    category: "caseSupport",
    headline: latestCase?.title ?? "Case Support",
    summary: latestCase
      ? `The latest accessible case is ${humanizeValue(latestCase.status)} and is owned by ${latestCase.ownerName}. ${latestCase.concern}`
      : `The latest request is ${humanizeValue(latestRequest.status)}. ${latestRequest.concern}`,
    evidence: [
      ...(latestCase
        ? [
            {
              label: "Desired outcome",
              value: latestCase.desiredOutcome,
              date: latestCase.updatedAt,
              sourceId: latestCase.id,
            },
          ]
        : []),
      ...(!latestCase && latestRequest
        ? [
            {
              label: "Requested support",
              value: latestRequest.requestedSupport,
              date: latestRequest.createdAt,
              sourceId: latestRequest.id,
            },
          ]
        : []),
    ],
  };
}

function providerSummarySentence(
  provider: InsightContext["providerRelationships"][number]
) {
  const trend = provider.trend
    ? ` The available trend is ${provider.trend}.`
    : "";
  return `${provider.providerName} (${humanizeValue(provider.assignmentRole)}) has ${provider.totalSessions} completed session${provider.totalSessions === 1 ? "" : "s"} and ${provider.activeGoals.length} active goal${provider.activeGoals.length === 1 ? "" : "s"}.${trend}`;
}

function filterRecordsByProvider(
  records: InsightContext["documentationRecords"],
  question: string
) {
  const normalized = question.toLowerCase();
  const matched = records.filter((record) => {
    const fullName = record.providerName.toLowerCase();
    const firstName = fullName.split(/\s+/)[0];
    const roleMatch = roleAliases.some(
      ([pattern, role]) =>
        role === record.providerRole && pattern.test(question)
    );
    return (
      normalized.includes(fullName) ||
      Boolean(firstName && normalized.includes(firstName)) ||
      roleMatch
    );
  });
  return matched.length ? matched : records;
}

function parseRevisionChanges(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((change) => {
    if (!change || typeof change !== "object" || Array.isArray(change)) {
      return [];
    }
    const record = change as Record<string, unknown>;
    if (
      typeof record.label !== "string" ||
      typeof record.path !== "string"
    ) {
      return [];
    }
    return [
      {
        path: record.path,
        label: record.label,
        before: record.before,
        after: record.after,
      },
    ];
  });
}

function buildLatestRevisionUpdate(
  revisions: InsightContext["documentationRecords"][number]["revisions"]
) {
  const updates = revisions
    .filter((revision) => revision.revisionNumber > 1)
    .sort((left, right) => right.revisionNumber - left.revisionNumber);
  const latest = updates[0];
  if (!latest) return null;

  const latestTime = new Date(latest.createdAt).getTime();
  const sessionWindowMs = 2 * 60 * 1000;
  const editSession = updates.filter(
    (revision) =>
      latestTime - new Date(revision.createdAt).getTime() <= sessionWindowMs
  );
  const oldestSessionRevision = editSession.at(-1);
  const baseline = revisions
    .filter(
      (revision) =>
        oldestSessionRevision &&
        revision.revisionNumber < oldestSessionRevision.revisionNumber
    )
    .sort((left, right) => right.revisionNumber - left.revisionNumber)[0];

  const beforeSnapshot = parseRevisionSnapshot(baseline?.snapshot);
  const afterSnapshot = parseRevisionSnapshot(latest.snapshot);
  const exactChanges =
    beforeSnapshot && afterSnapshot
      ? buildEntryRevisionChanges(beforeSnapshot, afterSnapshot)
      : collapseStoredRevisionChanges(editSession);

  const changes = exactChanges.flatMap((change) => {
    const value = formatRevisionUpdate(change.before, change.after);
    return value ? [{ label: change.label, value }] : [];
  });

  return {
    authorName: latest.createdByName,
    createdAt: latest.createdAt,
    changes,
  };
}

function parseRevisionSnapshot(value: unknown): EntryRevisionSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<EntryRevisionSnapshot>;
  if (!Array.isArray(record.items) || !Array.isArray(record.abcObservations)) {
    return null;
  }
  return record as EntryRevisionSnapshot;
}

function collapseStoredRevisionChanges(
  revisions: InsightContext["documentationRecords"][number]["revisions"]
) {
  const byPath = new Map<
    string,
    { path: string; label: string; before: unknown; after: unknown }
  >();

  for (const revision of [...revisions].sort(
    (left, right) => left.revisionNumber - right.revisionNumber
  )) {
    for (const change of parseRevisionChanges(revision.changes)) {
      const existing = byPath.get(change.path);
      byPath.set(change.path, {
        path: change.path,
        label: change.label,
        before: existing?.before ?? change.before,
        after: change.after,
      });
    }
  }

  return Array.from(byPath.values());
}

function humanizeValue(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
