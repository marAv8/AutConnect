import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";
import type { AttentionAudience, AttentionEvent, AttentionLevel, ProviderAssignment } from "./types";

const levelWeight: Record<AttentionLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function attentionId(...parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .map((part) => `${part}`.replace(/[^a-zA-Z0-9_-]+/g, "-"))
    .join(":");
}

export function textOf(event: ClinicalEvent) {
  return [
    event.title,
    event.summary,
    event.eventType,
    event.category,
    ...(event.tags ?? []),
    ...Object.values(event.details ?? {}).map((value) => String(value ?? "")),
    event.target?.target,
    event.target?.goal,
    event.target?.measurementProfile,
  ]
    .filter(Boolean)
    .join(" ");
}

export function includesAny(event: ClinicalEvent, pattern: RegExp) {
  return pattern.test(textOf(event));
}

export function sourceFromEvent(event: ClinicalEvent) {
  return {
    providerId: event.source.providerId,
    providerName: event.source.providerName,
    providerRole: event.source.providerRole,
  };
}

export function entireTeamAudience(): AttentionAudience {
  return {
    scope: "entire_team",
    includeAuthor: true,
  };
}

export function assignedTodayAudience(assignments: ProviderAssignment[] = []): AttentionAudience {
  const providerIds = assignments
    .filter((assignment) => assignment.assignedToday)
    .map((assignment) => assignment.providerId);

  return {
    scope: "assigned_today",
    providerIds: providerIds.length ? providerIds : undefined,
    includeAuthor: true,
  };
}

export function roleBasedAudience(roles: string[]): AttentionAudience {
  return {
    scope: "role_based",
    roles,
    includeAuthor: true,
  };
}

export function rankAttentionEvents(events: AttentionEvent[]) {
  return [...events].sort((first, second) => {
    const levelDelta = levelWeight[second.level] - levelWeight[first.level];
    if (levelDelta !== 0) return levelDelta;
    return second.createdAt.localeCompare(first.createdAt);
  });
}

export function highestAttentionLevel(events: AttentionEvent[]): AttentionLevel {
  return events.reduce<AttentionLevel>(
    (highest, event) => (levelWeight[event.level] > levelWeight[highest] ? event.level : highest),
    "none"
  );
}

export function sameTarget(first: ClinicalEvent, second: ClinicalEvent) {
  const firstGoalId = first.target?.goalId;
  const secondGoalId = second.target?.goalId;
  if (firstGoalId && secondGoalId && firstGoalId === secondGoalId) return true;

  return Boolean(
    first.target?.target &&
      first.target?.goal &&
      first.target.target.toLowerCase() === second.target?.target?.toLowerCase() &&
      first.target.goal.toLowerCase() === second.target?.goal?.toLowerCase()
  );
}

export function recentComparableEvent(
  current: ClinicalEvent,
  historicalEvents: ClinicalEvent[]
) {
  return [...historicalEvents]
    .filter((event) => sameTarget(current, event))
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))[0];
}
