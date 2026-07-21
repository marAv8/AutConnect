import type { ClinicalEvent, NormalizableEntry } from "../types";
import { baseSource, eventId, isoDate, observationItems, targetProgressEvent } from "../helpers";

export function mapOccupationalTherapyEntry(entry: NormalizableEntry): ClinicalEvent[] {
  const targetEvents = (entry.items ?? [])
    .map((item, index) =>
      targetProgressEvent(entry, item, index, {
        eventType: "occupational_therapy_target_progress",
        titlePrefix: "Therapy Progress",
        tags: ["occupational_therapy", item.domain ?? "unspecified"],
      })
    )
    .filter((event): event is ClinicalEvent => event !== null);

  const sensoryEvents = observationItems(entry.contextData).map((observation, index) => ({
    id: eventId(entry.id, index, "sensory-observation"),
    clientId: entry.clientId,
    occurredAt: isoDate(entry.date),
    source: baseSource(entry, "context_data"),
    category: "sensory_observation" as const,
    eventType: "sensory_observation_documented",
    title: observation.category,
    summary: observation.observation,
    details: observation,
    significance: "important" as const,
    tags: ["occupational_therapy", "sensory", observation.category],
  }));

  return [...targetEvents, ...sensoryEvents];
}
