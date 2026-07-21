import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";
import type {
  AttentionEvent,
  AttentionGenerationInput,
  AttentionType,
  SupervisorDirective,
} from "./types";
import { determineAudience, supervisorDirectiveAudience } from "./audience";
import {
  attentionId,
  includesAny,
  recentComparableEvent,
  sourceFromEvent,
} from "./helpers";

function createAttentionEvent(
  event: ClinicalEvent,
  input: AttentionGenerationInput,
  type: AttentionType,
  options: {
    level: AttentionEvent["level"];
    title: string;
    summary: string;
    rationale: string;
    metadata?: Record<string, unknown>;
  }
): AttentionEvent {
  return {
    id: attentionId("attention", event.id, type),
    clientId: event.clientId,
    createdAt: event.occurredAt,
    clinicalEventIds: [event.id],
    source: sourceFromEvent(event),
    attentionType: type,
    level: options.level,
    title: options.title,
    summary: options.summary,
    rationale: options.rationale,
    audience: determineAudience(type, event, input.providerAssignments),
    metadata: options.metadata,
  };
}

export function attentionEventsForClinicalEvent(
  event: ClinicalEvent,
  input: AttentionGenerationInput
): AttentionEvent[] {
  const events: AttentionEvent[] = [];
  const historicalEvents = input.historicalEvents ?? [];

  if (event.category === "team_focus") {
    return [];
  }

  if (
    event.eventType === "caregiver_sleep_context" &&
    includesAny(event, /\b(poor|restless|woke early)\b/i)
  ) {
    events.push(
      createAttentionEvent(event, input, "caregiver_context", {
        level: "medium",
        title: "Poor sleep reported",
        summary: event.summary,
        rationale: "Sleep context can affect regulation, transitions, attention, and therapy participation.",
      })
    );
  }

  if (event.category === "abc_observation" && includesAny(event, /\b(elopement|self[-\s]?injury|aggression|property destruction|hit|bite|kick|safety)\b/i)) {
    events.push(
      createAttentionEvent(event, input, "safety_concern", {
        level: "high",
        title: "Safety-related A-B-C observation",
        summary: event.summary,
        rationale: "A-B-C data includes behavior language associated with safety risk.",
        metadata: event.details,
      })
    );
  }

  if (event.category === "sensory_observation") {
    const seenBefore = historicalEvents.some(
      (historical) =>
        historical.category === "sensory_observation" &&
        historical.title.toLowerCase() === event.title.toLowerCase()
    );
    if (!seenBefore) {
      events.push(
        createAttentionEvent(event, input, "sensory_concern", {
          level: "medium",
          title: "New sensory observation",
          summary: event.summary,
          rationale: "This sensory category was not present in recent historical clinical events.",
          metadata: event.details,
        })
      );
    }
  }

  if (event.category === "communication_observation") {
    events.push(
      createAttentionEvent(event, input, "communication_update", {
        level: "medium",
        title: "Communication update",
        summary: event.summary,
        rationale: "Communication observations may affect prompting, classroom participation, and team strategies.",
        metadata: event.details,
      })
    );
  }

  if (event.category === "reinforcer" || includesAny(event, /\b(reinforcer|reinforcement|preferred item|motivator)\b/i)) {
    events.push(
      createAttentionEvent(event, input, "new_reinforcer", {
        level: "medium",
        title: "Reinforcer documented",
        summary: event.summary,
        rationale: "New reinforcement information can help other providers support engagement and replacement behavior.",
      })
    );
  }

  if (
    event.eventType === "target_mastered" ||
    event.details?.isMastered === true ||
    includesAny(event, /\b(mastered|mastery)\b/i)
  ) {
    events.push(
      createAttentionEvent(event, input, "mastery", {
        level: "medium",
        title: "Target mastered",
        summary: event.summary,
        rationale: "Mastery affects care-team planning, maintenance, and future target selection.",
        metadata: {
          target: event.target?.target,
          goalId: event.target?.goalId ?? null,
        },
      })
    );
  }

  if (
    event.category === "target_progress" &&
    event.target?.measurementProfile === "PromptLevel" &&
    typeof event.measurement?.score === "number"
  ) {
    const previous = recentComparableEvent(event, historicalEvents);
    if (
      previous?.target?.measurementProfile === "PromptLevel" &&
      typeof previous.measurement?.score === "number" &&
      event.measurement.score < previous.measurement.score
    ) {
      events.push(
        createAttentionEvent(event, input, "increased_support", {
          level: "medium",
          title: "Prompting increased",
          summary: event.summary,
          rationale: "Current prompt level indicates more support than the recent comparable event.",
          metadata: {
            priorScore: previous.measurement.score,
            currentScore: event.measurement.score,
            target: event.target?.target,
          },
        })
      );
    }
  }

  if (
    event.category === "target_progress" &&
    event.target?.measurementProfile === "Independence" &&
    typeof event.measurement?.score === "number"
  ) {
    const previous = recentComparableEvent(event, historicalEvents);
    if (
      previous?.target?.measurementProfile === "Independence" &&
      typeof previous.measurement?.score === "number" &&
      event.measurement.score < previous.measurement.score
    ) {
      events.push(
        createAttentionEvent(event, input, "reduced_independence", {
          level: "medium",
          title: "Independence decreased",
          summary: event.summary,
          rationale: "Current independence score is lower than the recent comparable event.",
          metadata: {
            priorScore: previous.measurement.score,
            currentScore: event.measurement.score,
            target: event.target?.target,
          },
        })
      );
    }
  }

  if (event.category === "abc_observation") {
    const antecedent = typeof event.details?.antecedent === "string" ? event.details.antecedent : "";
    const matchingAntecedents = historicalEvents.filter(
      (historical) =>
        historical.category === "abc_observation" &&
        typeof historical.details?.antecedent === "string" &&
        historical.details.antecedent.toLowerCase() === antecedent.toLowerCase()
    );
    if (antecedent && matchingAntecedents.length > 0) {
      events.push(
        createAttentionEvent(event, input, "abc_pattern", {
          level: "medium",
          title: "Recurring A-B-C antecedent",
          summary: event.summary,
          rationale: "The same antecedent appears in recent historical A-B-C clinical events.",
          metadata: {
            antecedent,
            priorEventIds: matchingAntecedents.map((item) => item.id),
          },
        })
      );
    }
  }

  return dedupeAttentionEvents(events);
}

export function supervisorDirectiveForClinicalEvent(event: ClinicalEvent): SupervisorDirective | null {
  if (event.category !== "team_focus") {
    return null;
  }

  return {
    id: attentionId("directive", event.id, "team-focus"),
    clientId: event.clientId,
    createdAt: event.occurredAt,
    clinicalEventIds: [event.id],
    source: sourceFromEvent(event),
    directiveType: "team_focus",
    level: "important",
    title: event.title,
    summary: event.summary,
    rationale: "Team Focus is supervisory direction and persists until replaced rather than expiring like ordinary attention.",
    audience: supervisorDirectiveAudience(),
    status: {
      lifecycle: "active_until_replaced",
    },
    metadata: event.details,
  };
}

function dedupeAttentionEvents(events: AttentionEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.clinicalEventIds.join("|")}|${event.attentionType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
