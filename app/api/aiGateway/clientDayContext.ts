import type { AttentionEvent, AttentionLevel, SupervisorDirective } from "@/app/libs/clinicalAttention";
import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";
import type {
  ClientDayContext,
  ClientDayContextInput,
  ClientDayEntryRef,
  ClientDaySourceCategory,
  ClientDaySourceItem,
  ClientDaySourceReference,
} from "./types";

const attentionLevelWeight: Record<Exclude<AttentionLevel, "none">, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function createClientDayContext(input: ClientDayContextInput): ClientDayContext {
  const completedEntries = sortCompletedEntries(dedupeById(input.completedEntries, "entryId"));
  const completedEntryIds = new Set(completedEntries.map((entry) => entry.entryId));
  const clinicalEvents = sortClinicalEvents(
    dedupeById(input.clinicalEvents, "id").filter((event) =>
      event.source.entryId ? completedEntryIds.has(event.source.entryId) : event.category === "team_focus"
    )
  );
  const clinicalEventIds = new Set(clinicalEvents.map((event) => event.id));
  const attentionEvents = sortAttentionEvents(
    dedupeById(input.attentionEvents, "id").filter((event) =>
      event.clinicalEventIds.some((clinicalEventId) => clinicalEventIds.has(clinicalEventId))
    )
  );
  const supervisorDirectives = sortSupervisorDirectives(
    dedupeById(input.supervisorDirectives, "id").filter((directive) =>
      directive.clinicalEventIds.some((clinicalEventId) => clinicalEventIds.has(clinicalEventId))
    )
  );
  const sourceReferences = buildSourceReferences({
    entries: completedEntries,
    clinicalEvents,
    attentionEvents,
    supervisorDirectives,
  });
  const sourceItems = sourceReferences.map(sourceReferenceToItem);
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return {
    client: input.client,
    date: input.date,
    status: input.status,
    completedEntries,
    clinicalEvents,
    attentionEvents,
    caregiverContext: sourceItems.filter((item) => item.sourceCategory === "caregiver_context"),
    reinforcerObservations: sourceItems.filter((item) => item.sourceCategory === "reinforcer"),
    teamFocus: sourceItems.find((item) => item.sourceCategory === "team_focus") ?? null,
    supervisorDirectives: sourceItems.filter(
      (item) => item.sourceCategory === "supervisor_directive"
    ),
    sessionObservations: sourceItems.filter(
      (item) => item.sourceCategory === "session_observation"
    ),
    sourceReferences,
    highestAttentionLevel: highestAttentionLevel(attentionEvents),
    meaningfulEventCount: clinicalEvents.filter(isMeaningfulClinicalEvent).length,
    routineEventCount: clinicalEvents.filter((event) => !isMeaningfulClinicalEvent(event)).length,
    completedEntryCount: completedEntries.length,
    contributingProviderRoles: uniqueValues(
      completedEntries.map((entry) => entry.providerRole)
    ).sort(),
    generatedAt,
    lastUpdatedAt: lastUpdatedAt(completedEntries, clinicalEvents, supervisorDirectives) ?? generatedAt,
  };
}

function buildSourceReferences(input: {
  entries: ClientDayEntryRef[];
  clinicalEvents: ClinicalEvent[];
  attentionEvents: AttentionEvent[];
  supervisorDirectives: SupervisorDirective[];
}): ClientDaySourceReference[] {
  const entryById = new Map(input.entries.map((entry) => [entry.entryId, entry]));
  const references: ClientDaySourceReference[] = [];

  for (const entry of input.entries) {
    const observation = entry.sessionObservation?.trim();
    if (!observation) continue;

    references.push({
      id: sourceReferenceId("entry-note", entry.entryId),
      clientId: entry.clientId,
      entryId: entry.entryId,
      providerId: entry.providerId,
      providerName: entry.providerName,
      providerRole: entry.providerRole,
      clinicalDate: entry.clinicalDate,
      completedAt: entry.completedAt,
      sourceCategory: "session_observation",
      sourceItemId: entry.entryId,
      sectionKey: "session-observation",
      label: "Session Observation",
      snippet: observation,
      clinicalEventIds: input.clinicalEvents
        .filter((event) => event.source.entryId === entry.entryId)
        .map((event) => event.id),
    });
  }

  for (const event of input.clinicalEvents) {
    const entry = event.source.entryId ? entryById.get(event.source.entryId) : null;
    references.push(clinicalEventToSourceReference(event, entry));
  }

  for (const event of input.attentionEvents) {
    const sourceEvent = input.clinicalEvents.find((item) =>
      event.clinicalEventIds.includes(item.id)
    );
    const entry = sourceEvent?.source.entryId ? entryById.get(sourceEvent.source.entryId) : null;
    references.push(attentionEventToSourceReference(event, sourceEvent, entry));
  }

  for (const directive of input.supervisorDirectives) {
    const sourceEvent = input.clinicalEvents.find((item) =>
      directive.clinicalEventIds.includes(item.id)
    );
    references.push(supervisorDirectiveToSourceReference(directive, sourceEvent));
  }

  return sortSourceReferences(dedupeSourceReferences(references));
}

function clinicalEventToSourceReference(
  event: ClinicalEvent,
  entry: ClientDayEntryRef | null | undefined
): ClientDaySourceReference {
  return {
    id: sourceReferenceId("clinical-event", event.id),
    clientId: event.clientId,
    entryId: event.source.entryId,
    providerId: event.source.providerId,
    providerName: event.source.providerName,
    providerRole: event.source.providerRole,
    clinicalDate: entry?.clinicalDate ?? event.occurredAt.slice(0, 10),
    completedAt: entry?.completedAt,
    sourceCategory: sourceCategoryForClinicalEvent(event),
    sourceItemId: event.source.itemId ?? event.id,
    sectionKey: sectionKeyForClinicalEvent(event),
    label: event.title,
    snippet: event.summary,
    clinicalEventIds: [event.id],
  };
}

function attentionEventToSourceReference(
  event: AttentionEvent,
  sourceEvent: ClinicalEvent | undefined,
  entry: ClientDayEntryRef | null | undefined
): ClientDaySourceReference {
  return {
    id: sourceReferenceId("attention-event", event.id),
    clientId: event.clientId,
    entryId: sourceEvent?.source.entryId,
    providerId: event.source.providerId,
    providerName: event.source.providerName,
    providerRole: event.source.providerRole,
    clinicalDate: entry?.clinicalDate ?? event.createdAt.slice(0, 10),
    completedAt: entry?.completedAt,
    sourceCategory: "attention_event",
    sourceItemId: event.id,
    sectionKey: sourceEvent ? sectionKeyForClinicalEvent(sourceEvent) : "attention",
    label: event.title,
    snippet: event.summary,
    clinicalEventIds: event.clinicalEventIds,
    attentionEventIds: [event.id],
  };
}

function supervisorDirectiveToSourceReference(
  directive: SupervisorDirective,
  sourceEvent: ClinicalEvent | undefined
): ClientDaySourceReference {
  return {
    id: sourceReferenceId("supervisor-directive", directive.id),
    clientId: directive.clientId,
    entryId: sourceEvent?.source.entryId,
    providerId: directive.source.providerId,
    providerName: directive.source.providerName,
    providerRole: directive.source.providerRole,
    clinicalDate: directive.createdAt.slice(0, 10),
    sourceCategory: "supervisor_directive",
    sourceItemId: directive.id,
    sectionKey: "team-focus",
    label: directive.title,
    snippet: directive.summary,
    clinicalEventIds: directive.clinicalEventIds,
    directiveIds: [directive.id],
  };
}

function sourceReferenceToItem(reference: ClientDaySourceReference): ClientDaySourceItem {
  return {
    id: reference.id,
    clientId: reference.clientId,
    entryId: reference.entryId,
    providerId: reference.providerId,
    providerName: reference.providerName,
    providerRole: reference.providerRole,
    clinicalDate: reference.clinicalDate,
    occurredAt: reference.completedAt ?? reference.clinicalDate,
    completedAt: reference.completedAt,
    sourceCategory: reference.sourceCategory,
    sourceItemId: reference.sourceItemId,
    sectionKey: reference.sectionKey,
    label: reference.label,
    snippet: reference.snippet,
    clinicalEventIds: reference.clinicalEventIds,
    attentionEventIds: reference.attentionEventIds,
    directiveIds: reference.directiveIds,
  };
}

function sourceCategoryForClinicalEvent(event: ClinicalEvent): ClientDaySourceCategory {
  if (event.category === "caregiver_context") return "caregiver_context";
  if (event.category === "reinforcer") return "reinforcer";
  if (event.category === "team_focus") return "team_focus";
  if (event.category === "communication_observation") return "communication_observation";
  if (event.category === "sensory_observation") return "sensory_observation";
  if (event.category === "abc_observation") return "abc_observation";
  if (event.category === "supervisor_observation") return "provider_observation";
  if (event.category === "clinical_reflection") return "clinical_reflection";
  return "target_progress";
}

function sectionKeyForClinicalEvent(event: ClinicalEvent) {
  if (event.category === "target_progress") return "targets";
  if (event.category === "caregiver_context") return "caregiver-context";
  if (event.category === "reinforcer") return "reinforcers";
  if (event.category === "team_focus") return "team-focus";
  if (event.category === "communication_observation") return "communication-observations";
  if (event.category === "sensory_observation") return "sensory-observations";
  if (event.category === "abc_observation") return "abc";
  if (event.category === "clinical_reflection") return "clinical-reflection";
  return "observations";
}

function isMeaningfulClinicalEvent(event: ClinicalEvent) {
  return (
    event.significance === "important" ||
    event.significance === "critical" ||
    [
      "abc_observation",
      "caregiver_context",
      "communication_observation",
      "sensory_observation",
      "supervisor_observation",
      "clinical_reflection",
      "reinforcer",
      "recommendation",
      "team_focus",
    ].includes(event.category)
  );
}

function highestAttentionLevel(events: AttentionEvent[]): AttentionLevel | null {
  return events.reduce<AttentionLevel | null>((highest, event) => {
    if (!highest) return event.level;
    return attentionWeight(event.level) > attentionWeight(highest) ? event.level : highest;
  }, null);
}

function attentionWeight(level: AttentionLevel) {
  if (level === "none") return 0;
  return attentionLevelWeight[level];
}

function sortCompletedEntries(entries: ClientDayEntryRef[]) {
  return [...entries].sort((first, second) => {
    const timeDelta = first.completedAt.localeCompare(second.completedAt);
    if (timeDelta !== 0) return timeDelta;
    return first.entryId.localeCompare(second.entryId);
  });
}

function sortClinicalEvents(events: ClinicalEvent[]) {
  return [...events].sort((first, second) => {
    const timeDelta = first.occurredAt.localeCompare(second.occurredAt);
    if (timeDelta !== 0) return timeDelta;
    return first.id.localeCompare(second.id);
  });
}

function sortAttentionEvents(events: AttentionEvent[]) {
  return [...events].sort((first, second) => {
    const levelDelta = attentionLevelWeight[second.level] - attentionLevelWeight[first.level];
    if (levelDelta !== 0) return levelDelta;
    const timeDelta = first.createdAt.localeCompare(second.createdAt);
    if (timeDelta !== 0) return timeDelta;
    return first.id.localeCompare(second.id);
  });
}

function sortSupervisorDirectives(directives: SupervisorDirective[]) {
  return [...directives].sort((first, second) => {
    const timeDelta = first.createdAt.localeCompare(second.createdAt);
    if (timeDelta !== 0) return timeDelta;
    return first.id.localeCompare(second.id);
  });
}

function sortSourceReferences(references: ClientDaySourceReference[]) {
  return [...references].sort((first, second) => {
    const firstTime = first.completedAt ?? first.clinicalDate;
    const secondTime = second.completedAt ?? second.clinicalDate;
    const timeDelta = firstTime.localeCompare(secondTime);
    if (timeDelta !== 0) return timeDelta;
    return first.id.localeCompare(second.id);
  });
}

function dedupeSourceReferences(references: ClientDaySourceReference[]) {
  const seen = new Set<string>();

  return references.filter((reference) => {
    const key = [
      reference.sourceCategory,
      reference.entryId ?? "",
      reference.sourceItemId ?? "",
      reference.clinicalEventIds.join("|"),
      reference.attentionEventIds?.join("|") ?? "",
      reference.directiveIds?.join("|") ?? "",
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeById<T extends Record<TKey, string>, TKey extends keyof T>(items: T[], key: TKey) {
  return Array.from(new Map(items.map((item) => [item[key], item])).values());
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function sourceReferenceId(...parts: string[]) {
  return parts.filter(Boolean).join(":");
}

function lastUpdatedAt(
  entries: ClientDayEntryRef[],
  clinicalEvents: ClinicalEvent[],
  supervisorDirectives: SupervisorDirective[]
) {
  return [
    ...entries.map((entry) => entry.completedAt),
    ...clinicalEvents.map((event) => event.occurredAt),
    ...supervisorDirectives.map((directive) => directive.createdAt),
  ].sort()[entries.length + clinicalEvents.length + supervisorDirectives.length - 1];
}
