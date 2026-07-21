/**
 * Provider-note parsing and display formatting rules.
 *
 * NoteHistoryViewer controls navigation and section visibility. This module
 * translates stored measurements and legacy note shapes into human-readable
 * values for those sections, without owning any React UI.
 */

import type {
  NoteHistoryEntry,
  NoteHistoryItem,
  SupervisorObservation,
} from "./noteHistoryTypes";

export function entryKindTitle(kind: NoteHistoryEntry["kind"]) {
  switch (kind) {
    case "SupervisorObservation":
      return "Observation";
    case "ClinicalNote":
      return "Clinical Note";
    case "SensoryObservation":
      return "Sensory Observation Summary";
    case "CommunicationObservation":
      return "Communication Observations";
    case "SpeechProgress":
      return "Speech Progress";
    case "MorningContext":
      return "Morning Context";
    case "EveningContext":
      return "Evening Context";
    case "SessionNote":
    default:
      return "Provider Note";
  }
}

export function parseSupervisorObservation(
  value: unknown,
  note: string,
  date: string,
  author: string
): SupervisorObservation | null {
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    const category =
      typeof data.observationCategory === "string" ? data.observationCategory.trim() : "";
    const observation =
      typeof data.observation === "string" ? data.observation.trim() : "";

    if (category || observation) {
      return {
        category: category || "Observation",
        observation,
        timestamp: date,
        author,
      };
    }
  }

  const categoryMatch = note.match(/^Observation Category:\s*(.+)$/m);
  const observationMatch = note.match(/^Observation:\s*([\s\S]+)$/m);
  const observation = observationMatch?.[1]?.trim() ?? note.trim();

  if (!observation) {
    return null;
  }

  return {
    category: categoryMatch?.[1]?.trim() || "Observation",
    observation,
    timestamp: date,
    author,
  };
}

export function getItemPercent(item: NoteHistoryItem) {
  if (item.metricType === "Percentage" && typeof item.rawValue === "number") {
    return clampPercent(item.rawValue);
  }

  if (item.metricType === "Subjective" && typeof item.score === "number") {
    return clampPercent(item.score * 10);
  }

  if (
    (item.metricType === "Frequency" || item.metricType === "Duration") &&
    typeof item.rawValue === "number" &&
    item.rawValue > 0 &&
    typeof item.goalDefinition?.targetValue === "number" &&
    item.goalDefinition.targetValue > 0
  ) {
    switch (item.goalDefinition.comparison) {
      case "LessThan":
        return clampPercent((item.goalDefinition.targetValue / item.rawValue) * 100);
      case "GreaterThan":
        return clampPercent((item.rawValue / item.goalDefinition.targetValue) * 100);
      case "Equal":
        return clampPercent(
          (1 -
            Math.abs(item.rawValue - item.goalDefinition.targetValue) /
              item.goalDefinition.targetValue) *
            100
        );
      default:
        return null;
    }
  }

  return null;
}

export function getDomainScores(items: NoteHistoryItem[]) {
  const groups = new Map<string, number[]>();

  for (const item of items) {
    if (!item.domain) {
      continue;
    }

    const percent = getItemPercent(item);
    if (percent === null) {
      continue;
    }

    const existing = groups.get(item.domain) ?? [];
    existing.push(percent);
    groups.set(item.domain, existing);
  }

  return Array.from(groups.entries()).map(([domain, scores]) => ({
    domain,
    percent: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
  }));
}

export function formatDomain(domain: string) {
  return domain === "SkillAcquisition" ? "Skill acquisition" : domain;
}

export function formatMetricValue(item: NoteHistoryItem, percent: number | null) {
  const rawValue =
    typeof item.rawValue === "number" && Number.isFinite(item.rawValue)
      ? `${item.rawValue}${item.metricType === "Percentage" ? "%" : ""}`
      : null;
  const score =
    typeof item.score === "number" && Number.isFinite(item.score)
      ? `${item.score}/10`
      : null;
  const support =
    typeof item.supportLevel === "number" && Number.isFinite(item.supportLevel)
      ? `Support ${item.supportLevel}/10`
      : null;
  const normalized = percent !== null ? `Normalized ${percent}%` : null;

  return [rawValue ?? score ?? item.metricType, normalized, support]
    .filter(Boolean)
    .join(" | ");
}

export function formatEducatorResponse(
  item: NoteHistoryItem,
  isOtProgress = false,
  isSpeechProgress = false,
  isBehaviorTechnicianProgress = false
) {
  const profile = educatorProfileForHistoryItem(item);

  if (profile === "Frequency") {
    if (
      (isOtProgress || isSpeechProgress || isBehaviorTechnicianProgress) &&
      typeof item.score === "number"
    ) {
      return (
        {
          1: "Never",
          2: "Rarely",
          3: "Sometimes",
          4: "Frequently",
        }[item.score] ?? `${item.score}/10`
      );
    }

    return typeof item.rawValue === "number" ? `${item.rawValue}` : "Not recorded";
  }

  if (typeof item.score !== "number") {
    return "Not recorded";
  }

  const educatorLabels: Record<string, Record<number, string>> = {
    Participation: {
      1: "Avoided",
      2: "Participated with Frequent Support",
      3: "Participated with Some Support",
      4: "Independent",
    },
    SupportLevel: {
      1: "Required Full Support",
      2: "Required Some Support",
      3: "Mostly Independent",
      4: "Independent",
    },
    Completion: {
      1: "Did Not Attempt",
      2: "Partial Completion",
      3: "Completed with Support",
      4: "Completed Independently",
    },
    Independence: {
      1: "Required Full Support",
      2: "Required Some Support",
      3: "Mostly Independent",
      4: "Independent",
    },
    Accuracy: {
      1: "Not Yet Accurate",
      2: "Emerging Accuracy",
      3: "Mostly Accurate",
      4: "Consistently Accurate",
    },
  };

  const otLabels: Record<string, Record<number, string>> = {
    Participation: {
      1: "Refused",
      2: "Limited Participation",
      3: "Participated With Prompts",
      4: "Fully Participated",
    },
    SupportLevel: {
      1: "Maximum Assistance",
      2: "Moderate Assistance",
      3: "Minimal Assistance",
      4: "Independent",
    },
    AssistanceLevel: {
      1: "Maximum Assistance",
      2: "Moderate Assistance",
      3: "Minimal Assistance",
      4: "Independent",
    },
    Completion: educatorLabels.Completion,
    Independence: {
      1: "Fully Dependent",
      2: "Needs Frequent Prompts",
      3: "Needs Occasional Prompts",
      4: "Independent",
    },
    Accuracy: educatorLabels.Accuracy,
  };

  const speechLabels: Record<string, Record<number, string>> = {
    Participation: {
      1: "Did Not Participate",
      2: "Participated with Support",
      3: "Participated Consistently",
      4: "Fully Engaged",
    },
    SupportLevel: {
      1: "Maximum Cueing",
      2: "Moderate Cueing",
      3: "Minimal Cueing",
      4: "Independent",
    },
    CueingLevel: {
      1: "Maximum Cueing",
      2: "Moderate Cueing",
      3: "Minimal Cueing",
      4: "Independent",
    },
    Accuracy: educatorLabels.Accuracy,
    Completion: educatorLabels.Completion,
    Independence: otLabels.Independence,
  };

  const behaviorTechnicianLabels: Record<string, Record<number, string>> = {
    ...speechLabels,
    SupportLevel: {
      1: "Maximum Prompting",
      2: "Moderate Prompting",
      3: "Minimal Prompting",
      4: "Independent",
    },
    PromptLevel: {
      1: "Maximum Prompting",
      2: "Moderate Prompting",
      3: "Minimal Prompting",
      4: "Independent",
    },
    Accuracy: educatorLabels.Accuracy,
    Duration: {
      1: "Very Brief",
      2: "Brief",
      3: "Sustained",
      4: "Extended",
    },
    Latency: {
      1: "Long Delay",
      2: "Moderate Delay",
      3: "Brief Delay",
      4: "Immediate",
    },
  };

  const labels = isBehaviorTechnicianProgress
    ? behaviorTechnicianLabels
    : isSpeechProgress
      ? speechLabels
      : isOtProgress
        ? otLabels
        : educatorLabels;

  return labels[profile]?.[item.score] ?? `${item.score}/10`;
}

export function parseSensoryObservations(value: unknown) {
  if (!value || typeof value !== "object" || !("observations" in value)) {
    return [];
  }

  const observations = (value as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations
    .map((item) => ({
      category:
        typeof item === "object" &&
        item !== null &&
        "category" in item &&
        typeof item.category === "string"
          ? item.category
          : "",
      observation:
        typeof item === "object" &&
        item !== null &&
        "observation" in item &&
        typeof item.observation === "string"
          ? item.observation
          : "",
      recommendation:
        typeof item === "object" &&
        item !== null &&
        "recommendation" in item &&
        typeof item.recommendation === "string"
          ? item.recommendation
          : "",
    }))
    .filter((item) => item.category && item.observation);
}

export function getAbcObservation(note: string) {
  if (!/\bABC:|antecedent|behavior=|consequence\b/i.test(note)) {
    return null;
  }

  return note
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => /\bABC:|antecedent|behavior=|consequence\b/i.test(line)) ??
    "A-B-C data documented.";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function educatorProfileForHistoryItem(item: NoteHistoryItem) {
  const profile = item.goalDefinition?.measurementProfile;
  if (
    profile === "Participation" ||
    profile === "SupportLevel" ||
    profile === "Completion" ||
    profile === "Independence" ||
    profile === "Frequency" ||
    profile === "PromptLevel" ||
    profile === "Duration" ||
    profile === "Latency" ||
    profile === "Accuracy" ||
    profile === "CueingLevel" ||
    profile === "AssistanceLevel"
  ) {
    return profile;
  }

  if (item.metricType === "Frequency") {
    return "Frequency";
  }

  const normalized = item.target.toLowerCase();
  if (normalized.includes("peer") || normalized.includes("group") || normalized.includes("participation")) {
    return "Participation";
  }

  if (normalized.includes("assignment") || normalized.includes("completion")) {
    return "Completion";
  }

  if (normalized.includes("independent") || normalized.includes("direction")) {
    return "Independence";
  }

  return "SupportLevel";
}
