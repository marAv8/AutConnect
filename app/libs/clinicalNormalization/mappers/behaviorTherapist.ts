import type { ClinicalEvent, NormalizableEntry } from "../types";
import {
  baseSource,
  eventId,
  hasSafetyLanguage,
  isoDate,
  providerName,
  targetProgressEvent,
} from "../helpers";

export function mapBehaviorTherapistEntry(entry: NormalizableEntry): ClinicalEvent[] {
  const targetEvents = (entry.items ?? [])
    .map((item, index) =>
      targetProgressEvent(entry, item, index, {
        eventType: "behavior_therapy_target_progress",
        titlePrefix: "Behavior Therapy Progress",
        tags: ["behavior_therapy", item.domain ?? "unspecified"],
        significance: hasSafetyLanguage(item.target, item.goal) ? "important" : "routine",
      })
    )
    .filter((event): event is ClinicalEvent => event !== null);

  const abcEvents = (entry.abcObservations ?? []).map((observation, index) => ({
    id: eventId(entry.id, observation.id ?? index, "abc-observation"),
    clientId: entry.clientId,
    occurredAt: isoDate(entry.date),
    source: {
      ...baseSource(entry, "abc_observation"),
      itemId: observation.id ?? undefined,
    },
    category: "abc_observation" as const,
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: `${providerName(entry.provider)} documented ${observation.behavior} after ${observation.antecedent}.`,
    details: {
      antecedent: observation.antecedent,
      behavior: observation.behavior,
      consequence: observation.consequence,
    },
    significance: hasSafetyLanguage(observation.behavior)
      ? ("important" as const)
      : ("routine" as const),
    tags: ["behavior_therapy", "abc", "behavior"],
  }));

  const positiveResponse = positiveResponseEvent(entry);

  return [...targetEvents, ...abcEvents, ...(positiveResponse ? [positiveResponse] : [])];
}

function positiveResponseEvent(entry: NormalizableEntry): ClinicalEvent | null {
  const note = [
    entry.note?.trim(),
    ...(entry.items ?? []).map((item) => item.observation?.trim()).filter(Boolean),
  ]
    .filter(Boolean)
    .join(" ");
  if (!note) return null;

  const nonNegatedNote = note
    .replace(
      /\b(?:not|was not|wasn't|did not appear|didn't appear)\s+(?:happy|calm|engaged|communicative)\b/gi,
      ""
    )
    .replace(/\b(?:no|without)\s+(?:expressive|verbal)\s+language\b/gi, "");
  const positiveEngagement =
    /\b(happy|calm|smil(?:e|ed|ing)|laugh(?:ed|ing)?|giggl(?:e|ed|ing)|engag(?:e|ed|ing)|enjoy(?:ed|ing)?)\b/i.test(
      nonNegatedNote
    );
  const expressiveCommunication =
    /\b(expressive language|verbal language|spontaneous(?:ly)?\s+(?:said|stated|spoke|communicated)|client\b[^.!?]{0,120}\b(?:said|stated|spoke|communicated|verbalized)\b)/i.test(
      nonNegatedNote
    );

  if (!positiveEngagement && !expressiveCommunication) return null;

  const transitionContext = /\b(transition|prompt|support|guided|assisted)\b/i.test(note);
  const observedResponse =
    positiveEngagement && expressiveCommunication
      ? "positive engagement and expressive language"
      : positiveEngagement
        ? "positive engagement"
        : "expressive language";
  const contextPhrase = transitionContext
    ? " following the documented support"
    : " during the session";

  return {
    id: eventId(entry.id, "positive-response-observed"),
    clientId: entry.clientId,
    occurredAt: isoDate(entry.date),
    source: baseSource(entry, "entry"),
    category: "provider_observation",
    eventType: "positive_response_observed",
    title: "Positive response observed",
    summary: `Behavior therapy observed ${observedResponse}${contextPhrase}.`,
    details: {
      positiveEngagement,
      expressiveCommunication,
      transitionContext,
    },
    significance: "important",
    tags: [
      "behavior_therapy",
      "positive_response",
      ...(positiveEngagement ? ["engagement"] : []),
      ...(expressiveCommunication ? ["communication"] : []),
    ],
  };
}
