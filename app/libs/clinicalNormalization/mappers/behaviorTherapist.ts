import type { ClinicalEvent, NormalizableEntry } from "../types";
import {
  baseSource,
  eventId,
  hasSafetyLanguage,
  isoDate,
  providerName,
  targetProgressEvent,
} from "../helpers";

export function mapBehaviorTherapistEntry(entry: NormalizableEntry): ClinicalEvent[] {
  const targetEvents = (entry.items ?? [])
    .map((item, index) =>
      targetProgressEvent(entry, item, index, {
        eventType: "behavior_therapy_target_progress",
        titlePrefix: "Behavior Therapy Progress",
        tags: ["behavior_therapy", item.domain ?? "unspecified"],
        significance: hasSafetyLanguage(item.target, item.goal) ? "important" : "routine",
      })
    )
    .filter((event): event is ClinicalEvent => event !== null);

  const abcEvents = (entry.abcObservations ?? []).map((observation, index) => ({
    id: eventId(entry.id, observation.id ?? index, "abc-observation"),
    clientId: entry.clientId,
    occurredAt: isoDate(entry.date),
    source: {
      ...baseSource(entry, "abc_observation"),
      itemId: observation.id ?? undefined,
    },
    category: "abc_observation" as const,
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: `${providerName(entry.provider)} documented ${observation.behavior} after ${observation.antecedent}.`,
    details: {
      antecedent: observation.antecedent,
      behavior: observation.behavior,
      consequence: observation.consequence,
    },
    significance: hasSafetyLanguage(observation.behavior)
      ? ("important" as const)
      : ("routine" as const),
    tags: ["behavior_therapy", "abc", "behavior"],
  }));

  return [...targetEvents, ...abcEvents];
}
