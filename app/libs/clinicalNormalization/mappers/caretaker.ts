import type { ClinicalEvent, NormalizableEntry } from "../types";
import {
  baseSource,
  eventId,
  isoDate,
  nonEmptyContextEntries,
  providerName,
  trimString,
} from "../helpers";

function caregiverEventType(key: string) {
  switch (key) {
    case "sleep":
      return "caregiver_sleep_context";
    case "medication":
      return "caregiver_medication_context";
    case "schoolTransition":
      return "caregiver_transition_context";
    case "homeRoutine":
      return "caregiver_home_routine_context";
    default:
      return "caregiver_context_documented";
  }
}

function caregiverSignificance(key: string, value: string): ClinicalEvent["significance"] {
  if (key === "medication" && /not given|not sure/i.test(value)) return "important";
  if (key === "sleep" && /restless|poor|woke early/i.test(value)) return "important";
  if (/difficult|hard/i.test(value)) return "important";
  return "routine";
}

export function mapCaretakerEntry(entry: NormalizableEntry): ClinicalEvent[] {
  const contextEvents = nonEmptyContextEntries(entry.contextData).map((item) => ({
    id: eventId(entry.id, item.key),
    clientId: entry.clientId,
    occurredAt: isoDate(entry.date),
    source: baseSource(entry, "context_data"),
    category: "caregiver_context" as const,
    eventType: caregiverEventType(item.key),
    title: item.label,
    summary: `${providerName(entry.provider)} reported ${item.label.toLowerCase()}: ${item.value}.`,
    details: {
      key: item.key,
      label: item.label,
      value: item.value,
    },
    significance: caregiverSignificance(item.key, item.value),
    tags: ["caregiver", "context", item.key],
  }));

  const comment = trimString((entry.contextData as { comment?: unknown } | null)?.comment);
  if (!comment) {
    return contextEvents;
  }

  return [
    ...contextEvents,
    {
      id: eventId(entry.id, "caregiver-comment"),
      clientId: entry.clientId,
      occurredAt: isoDate(entry.date),
      source: baseSource(entry, "context_data"),
      category: "caregiver_context",
      eventType: "caregiver_comment",
      title: "Caregiver Comment",
      summary: comment,
      details: { comment },
      significance: "important",
      tags: ["caregiver", "comment"],
    },
  ];
}
