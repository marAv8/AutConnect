import type {
  AttentionEvent,
  AttentionLevel,
  SupervisorDirective,
} from "@/app/libs/clinicalAttention";
import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";
import type { GatewayContext } from "./types";

export type ClinicalHandoffEvent = {
  id: string;
  title: string;
  summary: string;
  source: "attention_event" | "clinical_event" | "supervisor_directive";
  level: AttentionLevel | "routine" | "important" | "critical";
  providerRole: string;
  clinicalEventIds: string[];
  attentionEventId?: string;
  directiveId?: string;
  rationale?: string;
};

export type CareTeamConnection = {
  id: string;
  summary: string;
  providerRoles: string[];
  clinicalEventIds: string[];
  connectionType:
    | "shared_target"
    | "shared_category"
    | "caregiver_context"
    | "team_focus_alignment";
};

export type WatchItem = {
  id: string;
  title: string;
  reason: string;
  source: "attention_event" | "team_focus" | "historical_pattern";
  level: AttentionLevel | "important";
  clinicalEventIds: string[];
  attentionEventIds?: string[];
  directiveIds?: string[];
};

export type CarryForwardItem = {
  id: string;
  title: string;
  detail: string;
  source: "team_focus" | "attention_event" | "session_observation" | "clinical_event";
  clinicalEventIds: string[];
  attentionEventIds?: string[];
  directiveIds?: string[];
};

export type ClinicalHandoff = {
  summary: string;
  importantEvents: ClinicalHandoffEvent[];
  careTeamConnections: CareTeamConnection[];
  watchItems: WatchItem[];
  carryForwardItems: CarryForwardItem[];
  confidence: "low" | "medium" | "high";
};

const MAX_SUMMARY_SENTENCES = 5;
const MAX_IMPORTANT_EVENTS = 6;
const MAX_CONNECTIONS = 4;
const MAX_WATCH_ITEMS = 5;
const MAX_CARRY_FORWARD_ITEMS = 5;

const attentionLevelWeight: Record<Exclude<AttentionLevel, "none">, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function generateClinicalHandoff(context: GatewayContext): ClinicalHandoff {
  const importantEvents = buildImportantEvents(context);
  const careTeamConnections = buildCareTeamConnections(context);
  const watchItems = buildWatchItems(context);
  const carryForwardItems = buildCarryForwardItems(context);
  const confidence = calculateConfidence(context, {
    importantEvents,
    careTeamConnections,
    watchItems,
  });

  return {
    summary: buildSummary(context, {
      importantEvents,
      careTeamConnections,
      watchItems,
      carryForwardItems,
    }),
    importantEvents,
    careTeamConnections,
    watchItems,
    carryForwardItems,
    confidence,
  };
}

function buildImportantEvents(context: GatewayContext): ClinicalHandoffEvent[] {
  const fromAttention = [...context.attentionEvents]
    .sort(compareAttentionEvents)
    .map((event) => ({
      id: event.id,
      title: event.title,
      summary: event.summary,
      source: "attention_event" as const,
      level: event.level,
      providerRole: event.source.providerRole,
      clinicalEventIds: event.clinicalEventIds,
      attentionEventId: event.id,
      rationale: event.rationale,
    }));

  const attentionClinicalEventIds = new Set(
    context.attentionEvents.flatMap((event) => event.clinicalEventIds)
  );
  const fromClinicalEvents = context.clinicalEvents
    .filter((event) => isMeaningfulClinicalEvent(event))
    .filter((event) => !attentionClinicalEventIds.has(event.id))
    .sort(compareClinicalEvents)
    .map((event) => ({
      id: event.id,
      title: event.title,
      summary: event.summary,
      source: "clinical_event" as const,
      level: event.significance ?? "important",
      providerRole: event.source.providerRole,
      clinicalEventIds: [event.id],
    }));

  const fromDirectives = context.activeTeamFocus
    ? [directiveToImportantEvent(context.activeTeamFocus)]
    : [];

  return dedupeById([...fromDirectives, ...fromAttention, ...fromClinicalEvents]).slice(
    0,
    MAX_IMPORTANT_EVENTS
  );
}

function buildCareTeamConnections(context: GatewayContext): CareTeamConnection[] {
  const attentionClinicalEventIds = new Set(
    context.attentionEvents.flatMap((event) => event.clinicalEventIds)
  );
  const currentEvents = context.clinicalEvents.filter(
    (event) =>
      isMeaningfulClinicalEvent(event) ||
      attentionClinicalEventIds.has(event.id) ||
      (context.activeTeamFocus && overlapsText(event, context.activeTeamFocus.summary))
  );
  const historicalEvents = context.previousSessions.flatMap((session) => session.clinicalEvents);
  const connections: CareTeamConnection[] = [];

  for (const event of currentEvents) {
    const sameTarget = historicalEvents.find(
      (historical) =>
        differentProviderRole(event, historical) &&
        event.target?.target &&
        event.target.target.toLowerCase() === historical.target?.target?.toLowerCase()
    );

    if (sameTarget) {
      connections.push({
        id: connectionId("shared-target", sameTarget.id, event.id),
        summary: `${sameTarget.source.providerRole} documented ${sameTarget.title}; ${event.source.providerRole} documented ${event.title} in the current session.`,
        providerRoles: uniqueValues([sameTarget.source.providerRole, event.source.providerRole]),
        clinicalEventIds: [sameTarget.id, event.id],
        connectionType: "shared_target",
      });
    }

    const caregiverContext = historicalEvents.find(
      (historical) =>
        historical.category === "caregiver_context" && differentProviderRole(event, historical)
    );

    if (caregiverContext && event.category !== "caregiver_context") {
      connections.push({
        id: connectionId("caregiver-context", caregiverContext.id, event.id),
        summary: `${caregiverContext.source.providerRole} documented ${caregiverContext.title}; ${event.source.providerRole} documented ${event.title} in the current session.`,
        providerRoles: uniqueValues([
          caregiverContext.source.providerRole,
          event.source.providerRole,
        ]),
        clinicalEventIds: [caregiverContext.id, event.id],
        connectionType: "caregiver_context",
      });
    }

    const sharedCategory = historicalEvents.find(
      (historical) =>
        differentProviderRole(event, historical) &&
        event.category === historical.category &&
        event.category !== "target_progress"
    );

    if (sharedCategory) {
      connections.push({
        id: connectionId("shared-category", sharedCategory.id, event.id),
        summary: `${sharedCategory.source.providerRole} and ${event.source.providerRole} both documented ${event.category.replaceAll("_", " ")} information.`,
        providerRoles: uniqueValues([
          sharedCategory.source.providerRole,
          event.source.providerRole,
        ]),
        clinicalEventIds: [sharedCategory.id, event.id],
        connectionType: "shared_category",
      });
    }
  }

  if (context.activeTeamFocus) {
    const focusConnections = currentEvents
      .filter((event) => overlapsText(event, context.activeTeamFocus?.summary ?? ""))
      .map((event) => ({
        id: connectionId("team-focus", context.activeTeamFocus?.id, event.id),
        summary: `${event.source.providerRole} documented ${event.title}, which shares documented language with the active Team Focus.`,
        providerRoles: uniqueValues([
          context.activeTeamFocus?.source.providerRole ?? "Supervisor",
          event.source.providerRole,
        ]),
        clinicalEventIds: [...context.activeTeamFocus!.clinicalEventIds, event.id],
        connectionType: "team_focus_alignment" as const,
      }));

    connections.push(...focusConnections);
  }

  return dedupeConnections(connections).slice(0, MAX_CONNECTIONS);
}

function buildWatchItems(context: GatewayContext): WatchItem[] {
  const items: WatchItem[] = [];

  if (context.activeTeamFocus) {
    items.push({
      id: `watch:${context.activeTeamFocus.id}`,
      title: context.activeTeamFocus.title,
      reason: "Active Team Focus should remain visible across provider sessions.",
      source: "team_focus",
      level: "important",
      clinicalEventIds: context.activeTeamFocus.clinicalEventIds,
      directiveIds: [context.activeTeamFocus.id],
    });
  }

  for (const event of context.attentionEvents.filter((event) => event.level !== "low")) {
    items.push({
      id: `watch:${event.id}`,
      title: event.title,
      reason: event.rationale,
      source: "attention_event",
      level: event.level,
      clinicalEventIds: event.clinicalEventIds,
      attentionEventIds: [event.id],
    });
  }

  for (const pattern of context.historicalPatterns.recurringAntecedents) {
    items.push({
      id: `watch:recurring-antecedent:${stableText(pattern.value)}`,
      title: `Recurring antecedent: ${pattern.value}`,
      reason: `${pattern.value} appears in ${pattern.count} documented A-B-C events.`,
      source: "historical_pattern",
      level: "important",
      clinicalEventIds: pattern.clinicalEventIds,
    });
  }

  return dedupeById(items).slice(0, MAX_WATCH_ITEMS);
}

function buildCarryForwardItems(context: GatewayContext): CarryForwardItem[] {
  const items: CarryForwardItem[] = [];

  if (context.activeTeamFocus) {
    items.push({
      id: `carry:${context.activeTeamFocus.id}`,
      title: context.activeTeamFocus.title,
      detail: context.activeTeamFocus.summary,
      source: "team_focus",
      clinicalEventIds: context.activeTeamFocus.clinicalEventIds,
      directiveIds: [context.activeTeamFocus.id],
    });
  }

  for (const event of context.attentionEvents.filter(isCarryForwardAttention)) {
    items.push({
      id: `carry:${event.id}`,
      title: event.title,
      detail: event.summary,
      source: "attention_event",
      clinicalEventIds: event.clinicalEventIds,
      attentionEventIds: [event.id],
    });
  }

  if (context.sessionObservation) {
    items.push({
      id: `carry:session-observation:${context.session.entryId}`,
      title: "Session observation",
      detail: context.sessionObservation,
      source: "session_observation",
      clinicalEventIds: context.clinicalEvents.map((event) => event.id),
    });
  }

  for (const event of context.clinicalEvents.filter(isCarryForwardClinicalEvent)) {
    items.push({
      id: `carry:${event.id}`,
      title: event.title,
      detail: event.summary,
      source: "clinical_event",
      clinicalEventIds: [event.id],
    });
  }

  return dedupeById(items).slice(0, MAX_CARRY_FORWARD_ITEMS);
}

function buildSummary(
  context: GatewayContext,
  handoffParts: {
    importantEvents: ClinicalHandoffEvent[];
    careTeamConnections: CareTeamConnection[];
    watchItems: WatchItem[];
    carryForwardItems: CarryForwardItem[];
  }
) {
  const sentences: string[] = [];

  if (context.activeTeamFocus) {
    sentences.push(`Active Team Focus: ${context.activeTeamFocus.summary}`);
  }

  const topAttention = [...context.attentionEvents].sort(compareAttentionEvents)[0];
  if (topAttention) {
    sentences.push(`${topAttention.title}: ${topAttention.summary}`);
  } else if (handoffParts.importantEvents[0]) {
    sentences.push(
      `${handoffParts.importantEvents[0].title}: ${handoffParts.importantEvents[0].summary}`
    );
  }

  if (context.sessionObservation) {
    sentences.push(`Session observation: ${context.sessionObservation}`);
  }

  const topConnection = handoffParts.careTeamConnections[0];
  if (topConnection) {
    sentences.push(`Care team connection: ${topConnection.summary}`);
  }

  const topWatchItem = handoffParts.watchItems.find((item) => item.source !== "team_focus");
  if (topWatchItem) {
    sentences.push(`Watch item: ${topWatchItem.title}.`);
  } else if (handoffParts.carryForwardItems[0]) {
    sentences.push(`Carry forward: ${handoffParts.carryForwardItems[0].title}.`);
  }

  if (sentences.length === 0) {
    sentences.push(
      `${context.provider.role} documented the current session without generated attention events.`
    );
  }

  return sentences.slice(0, MAX_SUMMARY_SENTENCES).join(" ");
}

function calculateConfidence(
  context: GatewayContext,
  handoffParts: {
    importantEvents: ClinicalHandoffEvent[];
    careTeamConnections: CareTeamConnection[];
    watchItems: WatchItem[];
  }
): ClinicalHandoff["confidence"] {
  const providerRoles = new Set([
    ...context.clinicalEvents.map((event) => event.source.providerRole),
    ...context.previousSessions
      .flatMap((session) => session.clinicalEvents)
      .map((event) => event.source.providerRole),
  ]);
  const hasStrongAttention = context.attentionEvents.some(
    (event) => event.level === "high" || event.level === "critical"
  );
  const hasRepeatedPatterns =
    context.historicalPatterns.recurringAntecedents.length > 0 ||
    context.historicalPatterns.recurringTargets.length > 0 ||
    context.historicalPatterns.repeatedAttentionEvents.length > 0;

  if (hasStrongAttention) {
    return "high";
  }

  if (
    providerRoles.size >= 2 &&
    (hasRepeatedPatterns || handoffParts.careTeamConnections.length > 0)
  ) {
    return "high";
  }

  if (
    handoffParts.importantEvents.length > 0 ||
    handoffParts.watchItems.length > 0 ||
    context.clinicalEvents.length >= 2
  ) {
    return "medium";
  }

  return "low";
}

function directiveToImportantEvent(directive: SupervisorDirective): ClinicalHandoffEvent {
  return {
    id: directive.id,
    title: directive.title,
    summary: directive.summary,
    source: "supervisor_directive",
    level: directive.level,
    providerRole: directive.source.providerRole,
    clinicalEventIds: directive.clinicalEventIds,
    directiveId: directive.id,
    rationale: directive.rationale,
  };
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
    ].includes(event.category)
  );
}

function isCarryForwardAttention(event: AttentionEvent) {
  return [
    "caregiver_context",
    "communication_update",
    "sensory_concern",
    "new_reinforcer",
    "new_intervention",
    "environmental_trigger",
    "abc_pattern",
    "safety_concern",
  ].includes(event.attentionType);
}

function isCarryForwardClinicalEvent(event: ClinicalEvent) {
  return (
    event.category === "reinforcer" ||
    event.category === "communication_observation" ||
    event.category === "sensory_observation" ||
    event.category === "caregiver_context"
  );
}

function compareAttentionEvents(first: AttentionEvent, second: AttentionEvent) {
  const levelDelta = attentionLevelWeight[second.level] - attentionLevelWeight[first.level];
  if (levelDelta !== 0) return levelDelta;
  return second.createdAt.localeCompare(first.createdAt);
}

function compareClinicalEvents(first: ClinicalEvent, second: ClinicalEvent) {
  const significanceDelta = significanceWeight(second) - significanceWeight(first);
  if (significanceDelta !== 0) return significanceDelta;
  return second.occurredAt.localeCompare(first.occurredAt);
}

function significanceWeight(event: ClinicalEvent) {
  if (event.significance === "critical") return 3;
  if (event.significance === "important") return 2;
  return 1;
}

function differentProviderRole(first: ClinicalEvent, second: ClinicalEvent) {
  return first.source.providerRole !== second.source.providerRole;
}

function overlapsText(event: ClinicalEvent, text: string) {
  const eventWords = meaningfulWords(
    [event.title, event.summary, event.target?.target, event.target?.goal, ...event.tags].join(" ")
  );
  const textWords = meaningfulWords(text);

  return eventWords.some((word) => textWords.includes(word));
}

function meaningfulWords(value: string) {
  const stopWords = new Set([
    "and",
    "the",
    "for",
    "with",
    "this",
    "that",
    "documented",
    "provider",
    "session",
    "current",
    "focus",
  ]);

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word));
}

function dedupeConnections(connections: CareTeamConnection[]) {
  return dedupeById(connections).filter(
    (connection, index, allConnections) =>
      allConnections.findIndex((item) => sameEventSet(item.clinicalEventIds, connection.clinicalEventIds)) ===
      index
  );
}

function sameEventSet(first: string[], second: string[]) {
  if (first.length !== second.length) return false;

  const firstSet = new Set(first);
  return second.every((value) => firstSet.has(value));
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function connectionId(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(":");
}

function stableText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
