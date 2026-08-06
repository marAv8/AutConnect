import type {
  ClinicalEvent,
  ClinicalSignificance,
  NormalizableAssessmentItem,
  NormalizableEntry,
  NormalizableProvider,
} from "./types";

export function providerName(provider: NormalizableProvider) {
  return `${provider.firstName} ${provider.lastName}`.trim();
}

export function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function baseSource(entry: NormalizableEntry, sourceType: ClinicalEvent["source"]["sourceType"]) {
  return {
    sourceType,
    entryId: entry.id,
    providerId: entry.providerId,
    providerName: providerName(entry.provider),
    providerRole: entry.provider.role,
    entryKind: entry.kind,
  };
}

export function eventId(...parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .map((part) => `${part}`.replace(/[^a-zA-Z0-9_-]+/g, "-"))
    .join(":");
}

export function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function contextObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function nonEmptyContextEntries(value: unknown) {
  const data = contextObject(value);
  const entries = Array.isArray(data.entries) ? data.entries : [];

  return entries
    .map((entry) => {
      const item = contextObject(entry);
      return {
        key: trimString(item.key),
        label: trimString(item.label),
        value: trimString(item.value),
      };
    })
    .filter((entry) => entry.key && entry.label && entry.value);
}

export function observationItems(value: unknown) {
  const data = contextObject(value);
  const observations = Array.isArray(data.observations) ? data.observations : [];

  return observations
    .map((observation) => {
      const item = contextObject(observation);
      return {
        category: trimString(item.category),
        observation: trimString(item.observation),
        recommendation: trimString(item.recommendation),
        note: trimString(item.note),
      };
    })
    .filter((item) => item.category && item.observation);
}

export function measurementProfileForItem(item: NormalizableAssessmentItem) {
  return item.goalDefinition?.measurementProfile ?? null;
}

export function measurementLabel(item: NormalizableAssessmentItem) {
  const profile = measurementProfileForItem(item);
  if (profile) return profile;
  if (item.metricType === "Subjective" && typeof item.score === "number") {
    return `${item.score}`;
  }
  if (typeof item.rawValue === "number") {
    return `${item.rawValue}`;
  }
  return null;
}

export function measurementUnit(item: NormalizableAssessmentItem) {
  if (item.metricType === "Percentage") return "percent";
  if (item.metricType === "Duration") return "seconds";
  if (item.metricType === "Frequency") return "count";
  return null;
}

export function targetProgressEvent(
  entry: NormalizableEntry,
  item: NormalizableAssessmentItem,
  index: number,
  options: {
    eventType: string;
    titlePrefix: string;
    tags: string[];
    significance?: ClinicalSignificance;
    summary?: string;
  }
): ClinicalEvent | null {
  if (!item.target.trim() || !item.goal.trim()) {
    return null;
  }

  const profile = measurementProfileForItem(item);

  return {
    id: eventId(entry.id, item.id ?? index, options.eventType),
    clientId: entry.clientId,
    occurredAt: isoDate(entry.date),
    source: {
      ...baseSource(entry, "assessment_item"),
      itemId: item.id ?? undefined,
    },
    category: "target_progress",
    eventType: options.eventType,
    title: `${options.titlePrefix}: ${item.target}`,
    summary:
      options.summary ??
      `${providerName(entry.provider)} documented ${item.target}: ${item.goal}.`,
    target: {
      goalId: item.goalId ?? null,
      target: item.target,
      goal: item.goal,
      domain: item.domain ?? null,
      measurementProfile: profile,
    },
    measurement: {
      metricType: item.metricType,
      rawValue: item.rawValue ?? null,
      score: item.score ?? null,
      label: measurementLabel(item),
      unit: measurementUnit(item),
      direction: "descriptive",
    },
    details: item.observation?.trim()
      ? {
          observation: item.observation.trim(),
        }
      : undefined,
    significance: options.significance ?? "routine",
    tags: options.tags,
  };
}

export function hasSafetyLanguage(...values: string[]) {
  return /\b(elopement|self[-\s]?injury|aggression|property destruction|hit|bite|kick|safety)\b/i.test(
    values.join(" ")
  );
}
