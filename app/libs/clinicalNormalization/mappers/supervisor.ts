import type { ClinicalEvent, NormalizableEntry } from "../types";
import { baseSource, contextObject, eventId, isoDate, observationItems, trimString } from "../helpers";

export function mapSupervisorEntry(entry: NormalizableEntry): ClinicalEvent[] {
  if (entry.kind === "ClinicalNote") {
    const note = trimString(entry.note);
    if (!note) return [];

    return [
      {
        id: eventId(entry.id, "clinical-note"),
        clientId: entry.clientId,
        occurredAt: isoDate(entry.date),
        source: baseSource(entry, "entry"),
        category: "clinical_reflection",
        eventType: "clinical_note_documented",
        title: "Clinical Note",
        summary: note,
        details: { note },
        significance: "important",
        tags: ["supervisor", "clinical_reflection"],
      },
    ];
  }

  const structuredObservations = observationItems(entry.contextData);
  if (structuredObservations.length > 0) {
    return structuredObservations.map((observation, index) => ({
      id: eventId(entry.id, index, "supervisor-observation"),
      clientId: entry.clientId,
      occurredAt: isoDate(entry.date),
      source: baseSource(entry, "context_data"),
      category: "supervisor_observation",
      eventType: "supervisor_observation_documented",
      title: observation.category,
      summary: observation.observation,
      details: observation,
      significance: "important",
      tags: ["supervisor", "observation", observation.category],
    }));
  }

  const context = contextObject(entry.contextData);
  const category = trimString(context.observationCategory);
  const observation = trimString(context.observation);
  const note = trimString(entry.note);
  const summary = observation || note;

  if (!summary) return [];

  return [
    {
      id: eventId(entry.id, "supervisor-observation"),
      clientId: entry.clientId,
      occurredAt: isoDate(entry.date),
      source: baseSource(entry, category || observation ? "context_data" : "entry"),
      category: "supervisor_observation",
      eventType: "supervisor_observation_documented",
      title: category || "Supervisor Observation",
      summary,
      details: { category, observation, note },
      significance: "important",
      tags: ["supervisor", "observation"],
    },
  ];
}
