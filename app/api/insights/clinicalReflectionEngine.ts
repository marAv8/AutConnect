import { AssessmentDomain, MetricType } from "@prisma/client";
import { db } from "@/lib/db";
import { clientDisplayCode } from "@/app/libs/clientIdentity";
import { normalizeItem } from "@/lib/sessionScoring";

type ReflectionItem = {
  target: string;
  goal: string;
  score: number | null;
  metricType: MetricType;
  domain: AssessmentDomain | null;
  rawValue: number | null;
  supportLevel: number | null;
  goalDefinition: {
    metricType: MetricType;
    targetValue: number | null;
    comparison: "LessThan" | "GreaterThan" | "Equal" | null;
    weight: number;
    isMastered: boolean;
  } | null;
};

type ReflectionAbcObservation = {
  antecedent: string;
  behavior: string;
  consequence: string;
};

type ReflectionEntry = {
  id: string;
  clientId: string;
  providerId: string;
  date: Date;
  note: string | null;
  finalScore: number | null;
  provider: { role: string };
  client: { firstName: string; lastName: string };
  items: ReflectionItem[];
  abcObservations: ReflectionAbcObservation[];
};

export async function generateClinicalReflectionForEntry(entryId: string) {
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      clientId: true,
      providerId: true,
      date: true,
      note: true,
      finalScore: true,
      provider: {
        select: {
          role: true,
        },
      },
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      items: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          target: true,
          goal: true,
          score: true,
          metricType: true,
          domain: true,
          rawValue: true,
          supportLevel: true,
          goalDefinition: {
            select: {
              targetValue: true,
              comparison: true,
              metricType: true,
              weight: true,
              isMastered: true,
            },
          },
        },
      },
      abcObservations: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          antecedent: true,
          behavior: true,
          consequence: true,
        },
      },
    },
  });

  if (!entry) {
    return null;
  }

  const previousEntries = await db.entry.findMany({
    where: {
      clientId: entry.clientId,
      providerId: entry.providerId,
      date: {
        lt: entry.date,
      },
      OR: [
        {
          kind: {
            notIn: ["SupervisorObservation", "ClinicalNote"],
          },
        },
        {
          visibility: "Shared",
        },
      ],
      items: {
        some: {},
      },
    },
    orderBy: {
      date: "desc",
    },
    take: 5,
    select: {
      finalScore: true,
      items: {
        select: {
          target: true,
          goal: true,
          score: true,
          metricType: true,
          rawValue: true,
          supportLevel: true,
          goalDefinition: {
            select: {
              targetValue: true,
              comparison: true,
              metricType: true,
              weight: true,
            },
          },
        },
      },
    },
  });

  return buildClinicalReflection(entry, previousEntries);
}

function buildClinicalReflection(
  entry: ReflectionEntry,
  previousEntries: Array<{
    finalScore: number | null;
    items: Array<Omit<ReflectionItem, "domain" | "goalDefinition"> & {
      goalDefinition: {
        metricType: MetricType;
        targetValue: number | null;
        comparison: "LessThan" | "GreaterThan" | "Equal" | null;
        weight: number;
      } | null;
    }>;
  }>
) {
  const todayScores = entry.items
    .map((item) => normalizedPercent(item))
    .filter((score): score is number => score !== null);
  const previousScores = previousEntries
    .flatMap((previousEntry) => previousEntry.items.map((item) => normalizedPercent(item)))
    .filter((score): score is number => score !== null);
  const todayAverage = average(todayScores);
  const previousAverage = average(previousScores);

  return [
    performanceSentence(entry, todayAverage),
    progressSentence(todayAverage, previousAverage, entry.items),
    clinicalObservationSentence(entry),
    recommendationSentence(entry),
  ].join("\n\n");
}

function performanceSentence(entry: ReflectionEntry, todayAverage: number | null) {
  const name = clientDisplayCode(
    entry.client.firstName,
    entry.client.lastName
  );
  const measuredItems = entry.items.filter((item) => normalizedPercent(item) !== null);

  if (todayAverage !== null && measuredItems.length > 0) {
    const metricLabel = measurementLabel(measuredItems);
    return `${name} completed ${Math.round(todayAverage)}% normalized performance across ${measuredItems.length} documented ${roleSessionLabel(entry.provider.role)} ${metricLabel}.`;
  }

  if (entry.items.length > 0) {
    return `${name} had ${entry.items.length} documented ${roleSessionLabel(entry.provider.role)} assessment item${entry.items.length === 1 ? "" : "s"} without a calculable normalized score.`;
  }

  return `${name} had a ${roleSessionLabel(entry.provider.role)} note submitted without documented assessment scores.`;
}

function progressSentence(
  todayAverage: number | null,
  previousAverage: number | null,
  items: ReflectionItem[]
) {
  if (todayAverage === null || previousAverage === null) {
    return "Progress is a baseline data point for this provider.";
  }

  const masteredCount = items.filter((item) => item.goalDefinition?.isMastered).length;
  if (masteredCount > 0) {
    return "Progress reflects maintenance of mastery for documented mastered targets.";
  }

  const change = todayAverage - previousAverage;
  if (change >= 5) {
    return "Progress is improving compared with recent sessions.";
  }

  if (change <= -5) {
    return "Progress shows regression compared with recent sessions.";
  }

  return "Progress is stable compared with recent sessions.";
}

function clinicalObservationSentence(entry: ReflectionEntry) {
  const structuredAbc = entry.abcObservations[0];
  if (structuredAbc) {
    return `A-B-C observation documented antecedent ${structuredAbc.antecedent}, behavior ${structuredAbc.behavior}, consequence ${structuredAbc.consequence}.`;
  }

  const note = entry.note ?? "";
  const abc = documentedAbc(note);

  if (abc) {
    return abc;
  }

  if (/\btransition|transitions|routine change\b/i.test(note)) {
    return "Transition tolerance was documented in the provider note.";
  }

  if (/\breinforce|reinforcement|reinforcer\b/i.test(note)) {
    return "Reinforcement was documented in the provider note.";
  }

  if (/\bcommunication|request|mand|AAC\b/i.test(note)) {
    return "Communication was documented in the provider note.";
  }

  if (/\bsensory|regulation|self-regulation|self regulation\b/i.test(note)) {
    return "Sensory regulation was documented in the provider note.";
  }

  const maxSupport = Math.max(
    ...entry.items
      .map((item) => item.supportLevel)
      .filter((support): support is number => support !== null)
  );
  if (Number.isFinite(maxSupport) && maxSupport >= 7) {
    return "Support level data indicate continued prompt dependence.";
  }

  if (/\bprompt|prompting|cue|cues\b/i.test(note)) {
    return "Prompting was documented in the provider note.";
  }

  return "No additional A-B-C, prompting, transition, reinforcement, communication, or sensory regulation details were documented.";
}

function recommendationSentence(entry: ReflectionEntry) {
  const note = entry.note ?? "";

  if (entry.abcObservations.length > 0 || /\bABC:|antecedent|behavior=|consequence\b/i.test(note)) {
    return "Continue collecting A-B-C data for documented behavior observations.";
  }

  if (/\btransition|transitions|routine change\b/i.test(note)) {
    return "Monitor transition tolerance.";
  }

  if (/\breinforce|reinforcement|reinforcer\b/i.test(note)) {
    return "Continue the documented reinforcement schedule.";
  }

  if (/\bprompt|prompting|cue|cues\b/i.test(note) || entry.items.some((item) => (item.supportLevel ?? 0) >= 7)) {
    return "Continue current prompting hierarchy.";
  }

  if (entry.items.some((item) => normalizedPercent(item) !== null)) {
    return "Continue current data collection for documented targets.";
  }

  return "Continue documenting measurable targets when available.";
}

function documentedAbc(note: string) {
  if (!/\bABC:|antecedent|behavior=|consequence\b/i.test(note)) {
    return null;
  }

  const antecedent = extractLabeledValue(note, "Antecedent");
  const behavior = extractLabeledValue(note, "Behavior");
  const consequence = extractLabeledValue(note, "Consequence");
  const parts = [
    antecedent ? `antecedent ${antecedent}` : null,
    behavior ? `behavior ${behavior}` : null,
    consequence ? `consequence ${consequence}` : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return `A-B-C observation documented ${parts.join(", ")}.`;
  }

  return "A-B-C observation data were documented in the provider note.";
}

function extractLabeledValue(note: string, label: "Antecedent" | "Behavior" | "Consequence") {
  const match = note.match(new RegExp(`${label}\\s*=\\s*([^|.\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function normalizedPercent(item: {
  metricType: MetricType;
  target: string;
  goal: string;
  score: number | null;
  rawValue: number | null;
  goalDefinition: {
    metricType: MetricType;
    targetValue: number | null;
    comparison: "LessThan" | "GreaterThan" | "Equal" | null;
    weight: number;
  } | null;
}) {
  const normalized = normalizeItem(
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

  return normalized === null ? null : normalized * 100;
}

function measurementLabel(items: ReflectionItem[]) {
  const types = new Set(items.map((item) => item.metricType));
  if (types.size === 1) {
    const type = items[0]?.metricType;
    if (type === MetricType.Percentage) return "percentage target";
    if (type === MetricType.Frequency) return "frequency target";
    if (type === MetricType.Duration) return "duration target";
    if (type === MetricType.Subjective) return "subjective rating";
  }

  return "target";
}

function roleSessionLabel(role: string) {
  switch (role) {
    case "BehaviorTherapist":
      return "behavior therapy";
    case "SpeechPathologist":
      return "speech-language";
    case "OccupationalTherapist":
      return "occupational therapy";
    case "Educator":
      return "educational";
    case "Caregiver":
      return "caregiver";
    case "Supervisor":
      return "supervisory";
    default:
      return "provider";
  }
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
