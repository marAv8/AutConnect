import type { AttentionEvent } from "@/app/libs/clinicalAttention";
import type {
  ClientDailyHandoff,
  ClientDailyHandoffItem,
  ClientDayContext,
  ClientDaySourceReference,
} from "./types";

const MAX_OVERVIEW_SENTENCES = 4;
const MAX_KEY_EVENTS = 5;
const MAX_CONSIDERATIONS = 4;
const MAX_POSITIVE_DEVELOPMENTS = 4;

export function generateClientDailyHandoff(context: ClientDayContext): ClientDailyHandoff {
  const keyEvents = buildKeyEvents(context);
  const currentConsiderations = buildCurrentConsiderations(context);
  const positiveDevelopments = buildPositiveDevelopments(context, keyEvents);
  const hasVisibleMeaningfulEvents =
    keyEvents.length > 0 || currentConsiderations.length > 0 || positiveDevelopments.length > 0;
  const supportingReferenceIds = new Set(
    [...keyEvents, ...currentConsiderations, ...positiveDevelopments].flatMap(
      (item) => item.sourceReferenceIds
    )
  );
  const supportingReferences = context.sourceReferences.filter((reference) =>
    supportingReferenceIds.has(reference.id)
  );

  return {
    client: context.client,
    date: context.date,
    status: context.status,
    overview: buildOverview(context, {
      keyEvents,
      currentConsiderations,
      positiveDevelopments,
    }),
    keyEvents,
    currentConsiderations,
    positiveDevelopments,
    supportingReferences,
    highestAttentionLevel: context.highestAttentionLevel,
    hasMeaningfulEvents: hasVisibleMeaningfulEvents,
    completedEntryCount: context.completedEntryCount,
    contributingProviderRoles: context.contributingProviderRoles,
    generatedAt: context.generatedAt,
    lastUpdatedAt: context.lastUpdatedAt,
  };
}

function buildKeyEvents(context: ClientDayContext): ClientDailyHandoffItem[] {
  const items: ClientDailyHandoffItem[] = [];

  for (const attentionEvent of context.attentionEvents) {
    const references = referencesForAttention(context, attentionEvent);
    items.push({
      id: `key:${attentionEvent.id}`,
      title: attentionEvent.title,
      summary: attentionEvent.summary,
      providerRoles: uniqueValues([attentionEvent.source.providerRole]),
      sourceReferenceIds: references.map((reference) => reference.id),
      clinicalEventIds: attentionEvent.clinicalEventIds,
      attentionEventIds: [attentionEvent.id],
      level: attentionEvent.level,
    });
  }

  const attentionClinicalEventIds = new Set(
    context.attentionEvents.flatMap((event) => event.clinicalEventIds)
  );
  for (const reference of context.sourceReferences.filter(isMeaningfulSourceReference)) {
    if (reference.sourceCategory === "attention_event") continue;
    if (reference.sourceCategory === "team_focus") continue;
    if (reference.sourceCategory === "supervisor_directive") continue;
    if (reference.clinicalEventIds.some((eventId) => attentionClinicalEventIds.has(eventId))) {
      continue;
    }

    items.push({
      id: `key:${reference.id}`,
      title: reference.label,
      summary: reference.snippet,
      providerRoles: [reference.providerRole],
      sourceReferenceIds: [reference.id],
      clinicalEventIds: reference.clinicalEventIds,
      directiveIds: reference.directiveIds,
      level: levelForReference(reference),
    });
  }

  return dedupeHandoffItems(items)
    .sort(compareHandoffItems)
    .slice(0, MAX_KEY_EVENTS);
}

function buildCurrentConsiderations(context: ClientDayContext): ClientDailyHandoffItem[] {
  const items: ClientDailyHandoffItem[] = [];

  for (const event of context.attentionEvents.filter((event) => event.level !== "low")) {
    const references = referencesForAttention(context, event);
    items.push({
      id: `consideration:${event.id}`,
      title: event.title,
      summary: event.rationale,
      providerRoles: [event.source.providerRole],
      sourceReferenceIds: references.map((reference) => reference.id),
      clinicalEventIds: event.clinicalEventIds,
      attentionEventIds: [event.id],
      level: event.level,
    });
  }

  for (const item of context.caregiverContext) {
    items.push({
      id: `consideration:${item.id}`,
      title: item.label,
      summary: item.snippet,
      providerRoles: [item.providerRole],
      sourceReferenceIds: [item.id],
      clinicalEventIds: item.clinicalEventIds,
      level: "important",
    });
  }

  return dedupeHandoffItems(items)
    .sort(compareHandoffItems)
    .slice(0, MAX_CONSIDERATIONS);
}

function buildPositiveDevelopments(
  context: ClientDayContext,
  keyEvents: ClientDailyHandoffItem[]
): ClientDailyHandoffItem[] {
  const items: ClientDailyHandoffItem[] = [];
  const keyReferenceIds = new Set(keyEvents.flatMap((item) => item.sourceReferenceIds));

  for (const attentionEvent of context.attentionEvents.filter(isPositiveAttention)) {
    const references = referencesForAttention(context, attentionEvent);
    items.push({
      id: `positive:${attentionEvent.id}`,
      title: attentionEvent.title,
      summary: attentionEvent.summary,
      providerRoles: [attentionEvent.source.providerRole],
      sourceReferenceIds: references.map((reference) => reference.id),
      clinicalEventIds: attentionEvent.clinicalEventIds,
      attentionEventIds: [attentionEvent.id],
      level: attentionEvent.level,
    });
  }

  for (const reference of context.sourceReferences.filter(isPositiveSourceReference)) {
    if (keyReferenceIds.has(reference.id)) continue;

    items.push({
      id: `positive:${reference.id}`,
      title: reference.label,
      summary: reference.snippet,
      providerRoles: [reference.providerRole],
      sourceReferenceIds: [reference.id],
      clinicalEventIds: reference.clinicalEventIds,
      attentionEventIds: reference.attentionEventIds,
      directiveIds: reference.directiveIds,
      level: levelForReference(reference),
    });
  }

  return dedupeHandoffItems(items).sort(compareHandoffItems).slice(0, MAX_POSITIVE_DEVELOPMENTS);
}

function buildOverview(
  context: ClientDayContext,
  parts: {
    keyEvents: ClientDailyHandoffItem[];
    currentConsiderations: ClientDailyHandoffItem[];
    positiveDevelopments: ClientDailyHandoffItem[];
  }
) {
  if (context.completedEntryCount === 0) {
    return `${dayLabel(context)} has no completed provider documentation yet. The client handoff will update after providers complete session notes.`;
  }

  const hasVisibleMeaningfulEvents =
    parts.keyEvents.length > 0 ||
    parts.currentConsiderations.length > 0 ||
    parts.positiveDevelopments.length > 0;

  if (!hasVisibleMeaningfulEvents) {
    return `${dayLabel(context)} documentation is consistent with routine session activity. No clinically significant changes requiring team awareness were identified. Provider notes remain available for session-specific details.`;
  }

  const sentences: string[] = [];

  const topItems = dedupeHandoffItems([
    ...parts.keyEvents,
    ...parts.positiveDevelopments,
  ]).slice(0, 3);

  for (const item of topItems) {
    sentences.push(toNaturalHandoffSentence(item));
  }

  if (sentences.length === 0) {
    sentences.push(
      `${dayLabel(context)} included meaningful documentation from ${formatRoleList(
        context.contributingProviderRoles
      )}. Provider notes remain available for supporting details.`
    );
  }

  return sentences.slice(0, MAX_OVERVIEW_SENTENCES).join(" ");
}

function toNaturalHandoffSentence(item: ClientDailyHandoffItem) {
  const title = simplifyTitle(item.title);
  const summary = cleanClinicalText(item.summary);

  if (!summary) {
    return ensureSentence(`${title} was noted`);
  }

  if (isGenericTitle(title)) {
    return ensureSentence(summary);
  }

  if (summary.toLowerCase().startsWith(title.toLowerCase())) {
    return ensureSentence(summary);
  }

  return ensureSentence(`${title}; ${lowercaseFirst(summary)}`);
}

function simplifyTitle(value: string) {
  return cleanClinicalText(value)
    .replace(/^therapy progress:\s*/i, "")
    .replace(/^speech progress:\s*/i, "")
    .replace(/^academic progress:\s*/i, "")
    .replace(/^behavior therapy progress:\s*/i, "")
    .replace(/\s+documented$/i, "")
    .trim();
}

function cleanClinicalText(value: string) {
  return value
    .replace(/^Caregiver reported sleep:\s*poor\.?$/i, "Poor sleep was reported")
    .replace(/^Caregiver reported sleep:\s*well\.?$/i, "Sleep was reported as stable")
    .replace(/^Caregiver reported\s+/i, "The caregiver reported ")
    .replace(/\b(?:BehaviorTherapist|SpeechPathologist|OccupationalTherapist)\b\s+documented\s+/gi, "")
    .replace(/\b(?:Behavior Therapist|Speech Pathologist|Occupational Therapist)\b\s+documented\s+/gi, "")
    .replace(/\b(?:Educator|Caregiver|Supervisor)\b\s+documented\s+/gi, "")
    .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+documented\s+/g, "")
    .replace(/\bClients\b/g, "Client")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericTitle(value: string) {
  return /\b(update|documented|reported|progress|reinforcer)\b/i.test(value);
}

function lowercaseFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function ensureSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function referencesForAttention(context: ClientDayContext, event: AttentionEvent) {
  const directAttentionReference = context.sourceReferences.find((reference) =>
    reference.attentionEventIds?.includes(event.id)
  );
  const clinicalReferences = context.sourceReferences.filter((reference) =>
    reference.clinicalEventIds.some((eventId) => event.clinicalEventIds.includes(eventId))
  );

  return dedupeReferences([
    ...(directAttentionReference ? [directAttentionReference] : []),
    ...clinicalReferences,
  ]);
}

function isMeaningfulSourceReference(reference: ClientDaySourceReference) {
  return [
    "attention_event",
    "caregiver_context",
    "reinforcer",
    "team_focus",
    "supervisor_directive",
    "communication_observation",
    "sensory_observation",
    "abc_observation",
    "provider_observation",
    "clinical_reflection",
  ].includes(reference.sourceCategory);
}

function isPositiveAttention(event: AttentionEvent) {
  return ["improvement", "mastery", "new_reinforcer", "communication_update"].includes(
    event.attentionType
  );
}

function isPositiveSourceReference(reference: ClientDaySourceReference) {
  if (reference.sourceCategory === "reinforcer") return true;
  if (reference.sourceCategory === "communication_observation") {
    return /\b(increased|improved|independent|spontaneous|initiated|requested)\b/i.test(
      `${reference.label} ${reference.snippet}`
    );
  }
  return /\b(improved|mastered|effective|independent|spontaneous|successful)\b/i.test(
    `${reference.label} ${reference.snippet}`
  );
}

function levelForReference(reference: ClientDaySourceReference) {
  if (reference.sourceCategory === "team_focus") return "important";
  if (reference.sourceCategory === "attention_event") return "important";
  if (reference.sourceCategory === "caregiver_context") return "important";
  if (reference.sourceCategory === "reinforcer") return "important";
  if (reference.sourceCategory === "abc_observation") return "important";
  return "routine";
}

function compareHandoffItems(first: ClientDailyHandoffItem, second: ClientDailyHandoffItem) {
  const levelDelta = itemWeight(second) - itemWeight(first);
  if (levelDelta !== 0) return levelDelta;
  return first.id.localeCompare(second.id);
}

function itemWeight(item: ClientDailyHandoffItem) {
  if (item.level === "critical") return 5;
  if (item.level === "high") return 4;
  if (item.level === "important" || item.level === "medium") return 3;
  if (item.level === "low") return 2;
  return 1;
}

function dedupeHandoffItems(items: ClientDailyHandoffItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [
      item.title.toLowerCase(),
      item.sourceReferenceIds.join("|"),
      item.clinicalEventIds.join("|"),
      item.attentionEventIds?.join("|") ?? "",
      item.directiveIds?.join("|") ?? "",
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeReferences(references: ClientDaySourceReference[]) {
  return Array.from(new Map(references.map((reference) => [reference.id, reference])).values());
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatRoleList(roles: string[]) {
  if (roles.length === 0) return "provider";
  if (roles.length === 1) return roles[0];
  if (roles.length === 2) return `${roles[0]} and ${roles[1]}`;
  return `${roles.slice(0, -1).join(", ")}, and ${roles[roles.length - 1]}`;
}

function dayLabel(context: ClientDayContext) {
  return context.status === "FINALIZED" ? "The completed day" : "Today's";
}
