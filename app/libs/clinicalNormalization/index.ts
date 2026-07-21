export type {
  ClinicalEvent,
  ClinicalEventCategory,
  ClinicalEventSourceType,
  ClinicalNormalizationInput,
  ClinicalSignificance,
  NormalizableAbcObservation,
  NormalizableAssessmentItem,
  NormalizableEntry,
  NormalizableEntryKind,
  NormalizableMetricType,
  NormalizableProvider,
  NormalizableProviderRole,
  NormalizableTeamFocus,
  ProviderClinicalEventMapper,
} from "./types";
export { normalizeEntry } from "./normalizeEntry";
export { normalizeTeamFocus } from "./teamFocus";

import type { ClinicalEvent, ClinicalNormalizationInput } from "./types";
import { normalizeEntry } from "./normalizeEntry";
import { normalizeTeamFocus } from "./teamFocus";

export function normalizeClinicalEvents(input: ClinicalNormalizationInput): ClinicalEvent[] {
  return [
    ...(input.entries ?? []).flatMap(normalizeEntry),
    ...(input.teamFocusItems ?? []).flatMap(normalizeTeamFocus),
  ].sort((first, second) => first.occurredAt.localeCompare(second.occurredAt));
}
