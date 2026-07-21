import type {
  AttentionEvent,
  SupervisorDirective,
} from "@/app/libs/clinicalAttention";
import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";
import type {
  GatewayAttentionPattern,
  GatewayClient,
  GatewayContext,
  GatewayHistoricalPattern,
  GatewayHistoricalPatterns,
  GatewayPreviousSession,
  GatewayProvider,
  GatewaySession,
} from "./types";

type GatewayContextInput = {
  client: GatewayClient;
  session: GatewaySession;
  provider: GatewayProvider;
  clinicalEvents: ClinicalEvent[];
  attentionEvents: AttentionEvent[];
  supervisorDirectives: SupervisorDirective[];
  sessionObservation: string | null;
  previousSessions: GatewayPreviousSession[];
  providerHistory: ClinicalEvent[];
  historicalAttentionEvents: AttentionEvent[];
  patternLimit: number;
};

export function createGatewayContext(input: GatewayContextInput): GatewayContext {
  return {
    client: input.client,
    session: input.session,
    provider: input.provider,
    clinicalEvents: input.clinicalEvents,
    attentionEvents: input.attentionEvents,
    supervisorDirectives: input.supervisorDirectives,
    activeTeamFocus:
      input.supervisorDirectives.find((directive) => directive.directiveType === "team_focus") ??
      null,
    sessionObservation: input.sessionObservation,
    previousSessions: input.previousSessions,
    providerHistory: input.providerHistory,
    historicalPatterns: buildHistoricalPatterns({
      historicalEvents: input.previousSessions.flatMap((session) => session.clinicalEvents),
      historicalAttentionEvents: input.historicalAttentionEvents,
      patternLimit: input.patternLimit,
    }),
  };
}

function buildHistoricalPatterns(input: {
  historicalEvents: ClinicalEvent[];
  historicalAttentionEvents: AttentionEvent[];
  patternLimit: number;
}): GatewayHistoricalPatterns {
  return {
    recurringAntecedents: recurringEventValues(
      input.historicalEvents,
      (event) =>
        event.category === "abc_observation" && typeof event.details?.antecedent === "string"
          ? event.details.antecedent
          : null,
      input.patternLimit
    ),
    recurringTargets: recurringEventValues(
      input.historicalEvents,
      (event) => event.target?.target ?? null,
      input.patternLimit
    ),
    repeatedAttentionEvents: recurringAttentionValues(
      input.historicalAttentionEvents,
      input.patternLimit
    ),
    recentProviderObservations: recurringEventValues(
      input.historicalEvents.filter((event) =>
        [
          "caregiver_context",
          "communication_observation",
          "sensory_observation",
          "supervisor_observation",
          "clinical_reflection",
        ].includes(event.category)
      ),
      (event) => event.title || event.summary,
      input.patternLimit
    ),
  };
}

function recurringEventValues(
  events: ClinicalEvent[],
  valueForEvent: (event: ClinicalEvent) => string | null | undefined,
  limit: number
): GatewayHistoricalPattern[] {
  const groups = new Map<
    string,
    {
      value: string;
      events: ClinicalEvent[];
    }
  >();

  for (const event of events) {
    const value = valueForEvent(event)?.trim();
    if (!value) continue;

    const key = value.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
      continue;
    }

    groups.set(key, { value, events: [event] });
  }

  return Array.from(groups.values())
    .filter((group) => group.events.length > 1)
    .map((group) => {
      const sortedEvents = [...group.events].sort((first, second) =>
        second.occurredAt.localeCompare(first.occurredAt)
      );

      return {
        value: group.value,
        count: group.events.length,
        clinicalEventIds: group.events.map((event) => event.id),
        lastObservedAt: sortedEvents[0]?.occurredAt ?? "",
        sourceProviderRoles: Array.from(
          new Set(group.events.map((event) => event.source.providerRole))
        ),
      };
    })
    .sort((first, second) => {
      const countDelta = second.count - first.count;
      if (countDelta !== 0) return countDelta;
      return second.lastObservedAt.localeCompare(first.lastObservedAt);
    })
    .slice(0, limit);
}

function recurringAttentionValues(
  events: AttentionEvent[],
  limit: number
): GatewayAttentionPattern[] {
  const groups = new Map<AttentionEvent["attentionType"], AttentionEvent[]>();

  for (const event of events) {
    groups.set(event.attentionType, [...(groups.get(event.attentionType) ?? []), event]);
  }

  return Array.from(groups.entries())
    .filter(([, groupedEvents]) => groupedEvents.length > 1)
    .map(([attentionType, groupedEvents]) => {
      const sortedEvents = [...groupedEvents].sort((first, second) =>
        second.createdAt.localeCompare(first.createdAt)
      );

      return {
        attentionType,
        count: groupedEvents.length,
        attentionEventIds: groupedEvents.map((event) => event.id),
        lastObservedAt: sortedEvents[0]?.createdAt ?? "",
        levels: Array.from(new Set(groupedEvents.map((event) => event.level))),
      };
    })
    .sort((first, second) => {
      const countDelta = second.count - first.count;
      if (countDelta !== 0) return countDelta;
      return second.lastObservedAt.localeCompare(first.lastObservedAt);
    })
    .slice(0, limit);
}
