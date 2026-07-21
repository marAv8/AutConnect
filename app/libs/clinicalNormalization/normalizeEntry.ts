import type { ClinicalEvent, NormalizableEntry, ProviderClinicalEventMapper } from "./types";
import { mapBehaviorTherapistEntry } from "./mappers/behaviorTherapist";
import { mapCaretakerEntry } from "./mappers/caretaker";
import { mapEducatorEntry } from "./mappers/educator";
import { mapOccupationalTherapyEntry } from "./mappers/occupationalTherapy";
import { mapSpeechEntry } from "./mappers/speech";
import { mapSupervisorEntry } from "./mappers/supervisor";

const providerMappers: Record<string, ProviderClinicalEventMapper> = {
  BehaviorTherapist: mapBehaviorTherapistEntry,
  Caregiver: mapCaretakerEntry,
  Educator: mapEducatorEntry,
  OccupationalTherapist: mapOccupationalTherapyEntry,
  SpeechPathologist: mapSpeechEntry,
  Supervisor: mapSupervisorEntry,
};

export function normalizeEntry(entry: NormalizableEntry): ClinicalEvent[] {
  const mapper = providerMappers[entry.provider.role];
  if (!mapper) return [];

  return mapper(entry).filter(isValidClinicalEvent);
}

export function isValidClinicalEvent(event: ClinicalEvent) {
  return Boolean(
    event.id &&
      event.clientId &&
      event.occurredAt &&
      event.source.providerId &&
      event.source.providerName &&
      event.source.providerRole &&
      event.category &&
      event.eventType &&
      event.title &&
      event.summary &&
      event.tags.length > 0
  );
}
