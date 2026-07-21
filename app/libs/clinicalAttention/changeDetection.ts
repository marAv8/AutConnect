import type { AttentionGenerationInput, AttentionGenerationResult } from "./types";
import { highestAttentionLevel, rankAttentionEvents } from "./helpers";
import { attentionEventsForClinicalEvent, supervisorDirectiveForClinicalEvent } from "./rules";

export function generateAttention(input: AttentionGenerationInput): AttentionGenerationResult {
  const attentionEvents = input.currentEvents.flatMap((event) =>
    attentionEventsForClinicalEvent(event, input)
  );
  const supervisorDirectives = input.currentEvents
    .map(supervisorDirectiveForClinicalEvent)
    .filter((directive): directive is NonNullable<typeof directive> => directive !== null);
  const rankedEvents = rankAttentionEvents(attentionEvents);

  return {
    attentionEvents: rankedEvents,
    supervisorDirectives,
    summary: {
      clientId:
        input.currentEvents[0]?.clientId ??
        input.historicalEvents?.[0]?.clientId ??
        null,
      highestLevel: highestAttentionLevel(rankedEvents),
      activeCount: rankedEvents.length,
      directiveCount: supervisorDirectives.length,
      attentionEventIds: rankedEvents.map((event) => event.id),
      supervisorDirectiveIds: supervisorDirectives.map((directive) => directive.id),
      topEvents: rankedEvents.slice(0, 3),
    },
  };
}
