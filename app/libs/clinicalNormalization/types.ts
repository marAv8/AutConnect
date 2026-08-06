export type ClinicalSignificance = "routine" | "important" | "critical";

export type ClinicalEventCategory =
  | "target_progress"
  | "measurement"
  | "abc_observation"
  | "caregiver_context"
  | "environmental_context"
  | "communication_observation"
  | "sensory_observation"
  | "provider_observation"
  | "supervisor_observation"
  | "clinical_reflection"
  | "recommendation"
  | "reinforcer"
  | "team_focus";

export type ClinicalEventSourceType =
  | "entry"
  | "assessment_item"
  | "abc_observation"
  | "team_focus"
  | "context_data";

export type ClinicalEvent = {
  id: string;
  clientId: string;
  occurredAt: string;
  source: {
    sourceType: ClinicalEventSourceType;
    entryId?: string;
    itemId?: string;
    providerId: string;
    providerName: string;
    providerRole: string;
    entryKind?: NormalizableEntryKind;
  };
  category: ClinicalEventCategory;
  eventType: string;
  title: string;
  summary: string;
  target?: {
    goalId?: string | null;
    target?: string;
    goal?: string;
    domain?: string | null;
    measurementProfile?: string | null;
  };
  measurement?: {
    metricType?: NormalizableMetricType;
    rawValue?: number | null;
    score?: number | null;
    label?: string | null;
    unit?: string | null;
    direction?: "higher_is_better" | "lower_is_better" | "descriptive";
  };
  details?: Record<string, unknown>;
  significance?: ClinicalSignificance;
  tags: string[];
};

export type NormalizableProviderRole =
  | "Supervisor"
  | "Educator"
  | "SpeechPathologist"
  | "Caregiver"
  | "BehaviorTherapist"
  | "OccupationalTherapist"
  | string;

export type NormalizableEntryKind =
  | "SessionNote"
  | "MorningContext"
  | "EveningContext"
  | "SupervisorObservation"
  | "ClinicalNote"
  | "SensoryObservation"
  | "SpeechProgress"
  | "CommunicationObservation"
  | string;

export type NormalizableMetricType =
  | "Percentage"
  | "Frequency"
  | "Duration"
  | "Subjective"
  | string;

export type NormalizableAssessmentItem = {
  id?: string | null;
  goalId?: string | null;
  target: string;
  goal: string;
  score?: number | null;
  metricType: NormalizableMetricType;
  domain?: string | null;
  rawValue?: number | null;
  supportLevel?: number | null;
  observation?: string | null;
  goalDefinition?: {
    measurementProfile?: string | null;
    targetValue?: number | null;
    comparison?: string | null;
  } | null;
};

export type NormalizableAbcObservation = {
  id?: string | null;
  antecedent: string;
  behavior: string;
  consequence: string;
};

export type NormalizableProvider = {
  id: string;
  firstName: string;
  lastName: string;
  role: NormalizableProviderRole;
};

export type NormalizableEntry = {
  id: string;
  clientId: string;
  date: Date | string;
  kind: NormalizableEntryKind;
  note?: string | null;
  clinicalReflection?: string | null;
  contextData?: unknown;
  providerId: string;
  provider: NormalizableProvider;
  items?: NormalizableAssessmentItem[];
  abcObservations?: NormalizableAbcObservation[];
};

export type NormalizableTeamFocus = {
  id: string;
  clientId: string;
  title?: string | null;
  content: string;
  updatedAt: Date | string;
  authorId: string;
  author: NormalizableProvider;
};

export type ClinicalNormalizationInput = {
  entries?: NormalizableEntry[];
  teamFocusItems?: NormalizableTeamFocus[];
};

export type ProviderClinicalEventMapper = (
  entry: NormalizableEntry
) => ClinicalEvent[];
