export type NoteEntryKind =
  | "SessionNote"
  | "SupervisorObservation"
  | "ClinicalNote"
  | "SensoryObservation"
  | "SpeechProgress"
  | "CommunicationObservation";

export type DashboardEntryKind =
  | NoteEntryKind
  | "MorningContext"
  | "EveningContext";

export function parseNoteEntryKind(value: string | null): NoteEntryKind {
  if (
    value === "SupervisorObservation" ||
    value === "ClinicalNote" ||
    value === "SensoryObservation" ||
    value === "SpeechProgress" ||
    value === "CommunicationObservation" ||
    value === "SessionNote"
  ) {
    return value;
  }

  return "SessionNote";
}

export function noteEntryKindLabel(kind: NoteEntryKind) {
  switch (kind) {
    case "SupervisorObservation":
      return "Observation";
    case "ClinicalNote":
      return "Clinical Note";
    case "SensoryObservation":
      return "Sensory Observation";
    case "SpeechProgress":
      return "Speech Progress";
    case "CommunicationObservation":
      return "Communication Observation";
    case "SessionNote":
    default:
      return "Session Note";
  }
}
