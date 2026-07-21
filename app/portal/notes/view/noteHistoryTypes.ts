/**
 * Shared read-model types for the provider note history UI.
 *
 * These types describe the evidence returned by the View Notes server route.
 * Keeping them separate lets the carousel, dropdown sections, and formatting
 * rules share one contract without coupling those concerns to one component.
 */

export type NoteHistoryEntry = {
  id: string;
  kind?:
    | "SessionNote"
    | "MorningContext"
    | "EveningContext"
    | "SupervisorObservation"
    | "ClinicalNote"
    | "SensoryObservation"
    | "SpeechProgress"
    | "CommunicationObservation";
  status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | string;
  note: string;
  clinicalReflection: string | null;
  contextData?: unknown;
  date: string;
  completedAt?: string;
  finalScore: number | null;
  providerName: string;
  providerRole: string;
  items: NoteHistoryItem[];
  abcObservations: Array<{
    id: string;
    antecedent: string;
    behavior: string;
    consequence: string;
  }>;
  sensoryObservations?: SensoryObservation[];
  communicationObservations?: SensoryObservation[];
};

export type NoteHistoryItem = {
  target: string;
  goal: string;
  score: number | null;
  metricType: "Percentage" | "Frequency" | "Duration" | "Subjective" | null;
  domain:
    | "Behavior"
    | "SkillAcquisition"
    | "Communication"
    | "Adaptive"
    | "Regulation"
    | "Other"
    | null;
  rawValue: number | null;
  supportLevel: number | null;
  goalDefinition: {
    targetValue: number | null;
    comparison: "LessThan" | "GreaterThan" | "Equal" | null;
    measurementProfile: string | null;
  } | null;
};

export type SensoryObservation = {
  category: string;
  observation: string;
  recommendation: string;
  timestamp?: string;
  author?: string;
};

export type SupervisorObservation = {
  category: string;
  observation: string;
  timestamp?: string;
  author?: string;
};
