import { AssessmentDomain, MetricType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeItem } from "@/lib/sessionScoring";

export type ParsedInsightQuestion = {
  providerRole?: string;
  metricType?: "Percentage" | "Frequency" | "Duration" | "Subjective";
  dateRange?: { from: Date; to: Date };
  threshold?: number;
  comparison?: "above" | "below";
  intent: "summary" | "ranking" | "trend" | "compliance";
  context?: string[];
};

type InsightResult = {
  headline?: string;
  summary: string;
  context?: string;
  trend?: "up" | "down" | "flat";
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

type InsightEntry = Awaited<ReturnType<typeof fetchInsightEntries>>[number];
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

function parseDateRange(question: string) {
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

export function parseQuestion(question: string): ParsedInsightQuestion {
  const normalized = question.toLowerCase();
  const role = roleAliases.find(([pattern]) => pattern.test(question))?.[1];
  const metricType = Object.values(MetricType).find((type) =>
    normalized.includes(type.toLowerCase())
  );
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
  if (/\b(submits?|notes?|late|delay|timing|compliance)\b/.test(normalized)) {
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
    dateRange: parseDateRange(question),
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

async function fetchInsightEntries(clientId: string, parsed: ParsedInsightQuestion) {
  return db.entry.findMany({
    where: {
      clientId,
      ...(parsed.providerRole
        ? {
            provider: {
              role: parsed.providerRole as Role,
            },
          }
        : {}),
      ...(parsed.dateRange
        ? {
            createdAt: {
              gte: parsed.dateRange.from,
              lt: parsed.dateRange.to,
            },
          }
        : {}),
      ...(parsed.metricType
        ? {
            items: {
              some: {
                metricType: parsed.metricType as MetricType,
              },
            },
          }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      date: true,
      createdAt: true,
      note: true,
      providerId: true,
      provider: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      items: {
        select: {
          target: true,
          goal: true,
          score: true,
          metricType: true,
          domain: true,
          rawValue: true,
          goalDefinition: {
            select: {
              metricType: true,
              targetValue: true,
              comparison: true,
              weight: true,
            },
          },
        },
      },
    },
  });
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
      .filter((item) => !parsed.metricType || item.metricType === parsed.metricType)
      .map(normalizeScore)
      .filter((score): score is number => score !== null);

    if (scores.length === 0) continue;

    const existing =
      providerMap.get(entry.providerId) ??
      {
        providerId: entry.providerId,
        providerName: `${entry.provider.firstName} ${entry.provider.lastName}`,
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
        providerName: `${entry.provider.firstName} ${entry.provider.lastName}`,
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
        .filter((item) => !parsed.metricType || item.metricType === parsed.metricType)
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

export async function buildInsight(clientId: string, question: string): Promise<InsightResult> {
  const parsed = parseQuestion(question);
  const rawEntries = await fetchInsightEntries(clientId, parsed);
  const entries = rawEntries.filter((entry) => entryMatchesContext(entry, parsed));

  if (entries.length === 0) {
    return {
      ...formatNoDataObservation("No matching data was found for this client."),
      supportingData: { sessions: 0 },
    };
  }

  if (parsed.intent === "compliance") {
    return noteTimingCompliance(entries);
  }

  if (
    parsed.intent === "ranking" &&
    (parsed.metricType === "Frequency" ||
      /\b(challenging|difficult|behavior)\b/i.test(question))
  ) {
    return mostDifficultBehavior(entries);
  }

  const providers = providerSummaries(entries, parsed).sort((a, b) => a.avgScore - b.avgScore);
  if (providers.length === 0) {
    return {
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
      ...formatRankingObservation({ provider: lowest, trend }),
      trend,
      supportingData: { providers, sessions: entries.length },
    };
  }

  const avgScore = average(providers.map((provider) => provider.avgScore)) ?? 0;
  const roleLabel = parsed.providerRole ? formatRole(parsed.providerRole) : "The care team";
  const trend = trendFor(entries, parsed);
  return {
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
