import type { ClinicalEvent, NormalizableEntry } from "../types";
import { baseSource, eventId, isoDate, observationItems, targetProgressEvent } from "../helpers";

export function mapSpeechEntry(entry: NormalizableEntry): ClinicalEvent[] {
  const targetEvents = (entry.items ?? [])
    .map((item, index) =>
      targetProgressEvent(entry, item, index, {
        eventType: "speech_target_progress",
        titlePrefix: "Speech Progress",
        tags: ["speech", "communication", item.domain ?? "unspecified"],
      })
    )
    .filter((event): event is ClinicalEvent => event !== null);

  const observationEvents = observationItems(entry.contextData).map((observation, index) => ({
    id: eventId(entry.id, index, "communication-observation"),
    clientId: entry.clientId,
    occurredAt: isoDate(entry.date),
    source: baseSource(entry, "context_data"),
    category: "communication_observation" as const,
    eventType: "communication_observation_documented",
    title: observation.category,
    summary: observation.observation,
    details: observation,
    significance: "important" as const,
    tags: ["speech", "communication", observation.category],
  }));

  return [...targetEvents, ...observationEvents];
}
