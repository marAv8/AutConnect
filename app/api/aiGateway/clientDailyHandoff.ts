import type { AttentionEvent } from "@/app/libs/clinicalAttention";
import type {
  ClientDailyHandoff,
  ClientDailyHandoffItem,
  ClientDayContext,
  ClientDaySourceReference,
} from "./types";

const MAX_OVERVIEW_SENTENCES = 3;
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
  const referenceById = new Map(
    context.sourceReferences.map((reference) => [reference.id, reference])
  );
  const meaningfulSupportingReferences = Array.from(supportingReferenceIds)
    .map((referenceId) => referenceById.get(referenceId))
    .filter((reference): reference is ClientDaySourceReference => Boolean(reference));
  const supportingReferences =
    meaningfulSupportingReferences.length > 0
      ? meaningfulSupportingReferences
      : routineDocumentationReferences(context);

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
    inProgressEntryCount: context.inProgressEntryCount,
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

  for (const item of context.caregiverContext.filter(
    (item) => !isMedicationContext(item.label, item.snippet)
  )) {
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
  const inProgressEntryCount = context.inProgressEntryCount ?? 0;

  if (
    context.completedEntryCount === 0 &&
    inProgressEntryCount === 0
  ) {
    return `${dayLabel(context)} has no completed provider documentation yet. The client handoff will update after providers complete session notes.`;
  }

  const hasVisibleMeaningfulEvents =
    parts.keyEvents.length > 0 ||
    parts.currentConsiderations.length > 0 ||
    parts.positiveDevelopments.length > 0;

  if (!hasVisibleMeaningfulEvents) {
    if (inProgressEntryCount > 0) {
      return `${dayLabel(context)} provider documentation is still in progress. The handoff will refine as providers complete their notes.`;
    }

    const noteLabel =
      context.completedEntryCount === 1
        ? "1 completed provider note"
        : `${context.completedEntryCount} completed provider notes`;
    return `${dayLabel(context)} ${noteLabel} reflect routine session activity.`;
  }

  const sentences = uniqueSentences([
    inProgressEntryCount > 0
      ? "Live documentation is still in progress"
      : "",
    buildCaregiverContextSentence(context),
    buildBehaviorAndSupportSentence(context),
    buildAlliedHealthSentence(context),
    buildEffectiveStrategySentence(context),
  ]);

  const topItems = dedupeHandoffItems([
    ...parts.keyEvents,
    ...parts.currentConsiderations,
    ...parts.positiveDevelopments,
  ]);

  for (const item of topItems) {
    if (sentences.length >= MAX_OVERVIEW_SENTENCES) break;
    const sentence = toNaturalHandoffSentence(item);
    if (!isRepeatedSentence(sentence, sentences)) {
      sentences.push(sentence);
    }
  }

  if (sentences.length === 0) {
    sentences.push(
      `${dayLabel(context)} completed notes include information that may be useful to the care team.`
    );
  }

  return sentences.slice(0, MAX_OVERVIEW_SENTENCES).join(" ");
}

function toNaturalHandoffSentence(item: ClientDailyHandoffItem) {
  const summary = cleanClinicalText(item.summary);

  return summary
    ? ensureSentence(summary)
    : ensureSentence(`${simplifyTitle(item.title)} was noted`);
}

function buildCaregiverContextSentence(context: ClientDayContext) {
  const phrases = context.clinicalEvents
    .filter((event) => event.category === "caregiver_context")
    .sort(
      (first, second) =>
        caregiverContextPriority(first) - caregiverContextPriority(second) ||
        first.occurredAt.localeCompare(second.occurredAt) ||
        first.id.localeCompare(second.id)
    )
    .map(caregiverContextPhrase)
    .filter((phrase): phrase is string => Boolean(phrase));

  const uniquePhrases = uniqueValues(phrases).slice(0, 3);
  return uniquePhrases.length > 0
    ? ensureSentence(`The caregiver reported that ${formatCaregiverPhrases(uniquePhrases)}`)
    : "";
}

function formatCaregiverPhrases(phrases: string[]) {
  const [first, ...remaining] = phrases;
  return formatNaturalList([
    first,
    ...remaining.map((phrase) => phrase.replace(/^the client\s+/i, "")),
  ]);
}

function caregiverContextPriority(event: ClientDayContext["clinicalEvents"][number]) {
  const key = typeof event.details?.key === "string" ? event.details.key : "";
  return ["sleep", "breakfast", "schoolTransition"].indexOf(key) + 1 || 5;
}

function caregiverContextPhrase(event: ClientDayContext["clinicalEvents"][number]) {
  const key = typeof event.details?.key === "string" ? event.details.key : "";
  const value = typeof event.details?.value === "string" ? event.details.value.trim() : "";
  const normalized = value.toLowerCase();

  if (!value) {
    return event.eventType === "caregiver_comment" ? cleanClinicalText(event.summary) : "";
  }

  if (key === "sleep") {
    if (normalized === "good") return "the client slept well";
    if (normalized === "restless") return "the client had restless sleep";
    if (normalized === "poor") return "the client slept poorly";
    if (normalized === "woke early") return "the client woke early";
  }

  if (key === "breakfast") {
    if (normalized === "ate well") return "the client ate breakfast well";
    if (normalized === "ate some") return "the client ate some breakfast";
    if (normalized === "skipped") return "the client skipped breakfast";
    if (normalized === "not sure") return "breakfast intake was uncertain";
  }

  if (key === "medication") return "";

  if (key === "schoolTransition") {
    if (normalized === "smooth") return "the transition to school was smooth";
    if (normalized === "slow") return "the transition to school was slow";
    if (normalized === "difficult") return "the transition to school was difficult";
  }

  if (event.significance === "important" || event.significance === "critical") {
    return `${event.title.toLowerCase()} was reported as ${normalized}`;
  }

  return "";
}

function buildBehaviorAndSupportSentence(context: ClientDayContext) {
  const abcEvent = context.clinicalEvents
    .filter((event) => event.category === "abc_observation")
    .sort(
      (first, second) =>
        significanceWeight(second.significance) - significanceWeight(first.significance)
    )[0];
  const fullSupportTargets = uniqueValues(
    context.clinicalEvents
      .filter((event) => {
        const profile = event.target?.measurementProfile;
        return (
          event.category === "target_progress" &&
          typeof event.measurement?.score === "number" &&
          event.measurement.score <= 1 &&
          ["PromptLevel", "SupportLevel", "Independence", "AssistanceLevel"].includes(
            profile ?? ""
          )
        );
      })
      .map((event) => event.target?.target?.trim() ?? "")
      .filter(Boolean)
  ).slice(0, 2);
  const positiveResponse = context.clinicalEvents.find(
    (event) =>
      event.category === "provider_observation" &&
      event.eventType === "positive_response_observed"
  );

  if (!abcEvent && fullSupportTargets.length === 0 && !positiveResponse) return "";

  const abcClause = abcEvent ? abcOverviewClause(abcEvent) : "";
  const positiveClause = positiveResponse
    ? positiveResponseOverviewClause(positiveResponse)
    : "";
  const supportTargets =
    fullSupportTargets.length > 0
      ? formatNaturalList(
          fullSupportTargets.map((target) => target.toLowerCase())
        )
      : "";

  if (abcClause && positiveClause) {
    return ensureSentence(`${abcClause}, and ${lowercaseFirst(positiveClause)}`);
  }

  if (abcClause && supportTargets) {
    return ensureSentence(`${abcClause} and full support required for ${supportTargets}`);
  }

  return ensureSentence(
    abcClause ||
      positiveClause ||
      (supportTargets ? `Full support was required for ${supportTargets}` : "")
  );
}

function positiveResponseOverviewClause(
  event: ClientDayContext["clinicalEvents"][number]
) {
  const positiveEngagement = event.details?.positiveEngagement === true;
  const expressiveCommunication = event.details?.expressiveCommunication === true;
  const transitionContext = event.details?.transitionContext === true;
  const response =
    positiveEngagement && expressiveCommunication
      ? "positive engagement and expressive language"
      : positiveEngagement
        ? "positive engagement"
        : "expressive language";

  return `Behavior therapy later observed ${response}${
    transitionContext ? " following the documented support" : ""
  }`;
}

function abcOverviewClause(event: ClientDayContext["clinicalEvents"][number]) {
  const antecedent =
    typeof event.details?.antecedent === "string" ? event.details.antecedent.trim() : "";
  const behavior =
    typeof event.details?.behavior === "string" ? event.details.behavior.trim() : "";
  const consequence =
    typeof event.details?.consequence === "string" ? event.details.consequence.trim() : "";
  const behaviorPhrase =
    /\b(?:dropped|fell|lowered)\b[^.!?]{0,80}\bfloor\b[^.!?]{0,80}\bresist(?:ed|ance|ing)?\b/i.test(
      behavior
    ) && /\btransition\b/i.test(behavior)
      ? "the client resisted the transition"
      : compactPhrase(
          behavior
            .replace(/^client\s+/i, "the client ")
            .replace(/,\s+and\b/gi, " and"),
          96
        );
  const contextPhrase = abcContextPhrase(antecedent);
  const reinforcementPhrase = /\b(mand|request|communicat).*\b(reinforc|prompt)|\b(reinforc|prompt).*\b(mand|request|communicat)/i.test(
    consequence
  )
    ? "functional communication prompted and reinforced in response"
    : "";

  const observation = behaviorPhrase
    ? `Behavior therapy observed that ${lowercaseFirst(behaviorPhrase)}${contextPhrase}`
    : "Behavior therapy recorded an A-B-C observation";

  return reinforcementPhrase ? `${observation}, with ${reinforcementPhrase}` : observation;
}

function abcContextPhrase(antecedent: string) {
  if (!antecedent) return "";
  if (/\b(dropped off|drop[-\s]?off|front of (?:the )?school|school arrival|arrival)\b/i.test(antecedent)) {
    return " during school arrival";
  }
  if (/\b(transition|routine|unpack|line|classroom|teacher arriv)/i.test(antecedent)) {
    return " during a classroom transition";
  }
  if (/\b(task|work|demand|worksheet|instruction)/i.test(antecedent)) {
    return " during a task demand";
  }
  if (/\bwait|waiting/i.test(antecedent)) {
    return " while waiting";
  }
  return ` after ${lowercaseFirst(compactPhrase(antecedent, 72))}`;
}

function buildAlliedHealthSentence(context: ClientDayContext) {
  const speechFocuses = observationFocuses(context, "communication_observation");
  const occupationalFocuses = observationFocuses(context, "sensory_observation");

  if (speechFocuses.length > 0 && occupationalFocuses.length > 0) {
    return ensureSentence(
      `Speech and occupational therapy identified emerging priorities in ${formatNaturalList([
        ...speechFocuses,
        ...occupationalFocuses,
      ].slice(0, 3))} for team follow-up`
    );
  }

  if (speechFocuses.length > 0) {
    return ensureSentence(
      `Speech therapy identified ${formatNaturalList(speechFocuses)} for continued observation`
    );
  }

  if (occupationalFocuses.length > 0) {
    return ensureSentence(
      `Occupational therapy identified ${formatNaturalList(
        occupationalFocuses
      )} for continued observation`
    );
  }

  return "";
}

function observationFocuses(
  context: ClientDayContext,
  category: "communication_observation" | "sensory_observation"
) {
  return uniqueValues(
    context.clinicalEvents
      .filter((event) => event.category === category)
      .map((event) =>
        simplifyTitle(event.title)
          .replace(/\bobservation(s)?\b/gi, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
      )
      .filter((value) => value && !/^(communication|sensory|update)$/i.test(value))
  ).slice(0, 2);
}

function buildEffectiveStrategySentence(context: ClientDayContext) {
  const strategy = context.clinicalEvents.find(
    (event) =>
      event.category === "reinforcer" ||
      /\b(effective reinforcer|reinforcer.*effective|highly motivated|motivating)\b/i.test(
        `${event.title} ${event.summary}`
      )
  );

  return strategy ? ensureSentence(cleanClinicalText(strategy.summary)) : "";
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
    .replace(
      /\b[A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*){0,2}\s+(?:documented|reported)\s+/gi,
      ""
    )
    .replace(/\bClients\b/g, "Client")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
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
  const clinicalReferences = context.sourceReferences.filter((reference) =>
    reference.sourceCategory !== "attention_event" &&
    reference.clinicalEventIds.some((eventId) => event.clinicalEventIds.includes(eventId))
  );

  return dedupeReferences(clinicalReferences);
}

function routineDocumentationReferences(context: ClientDayContext) {
  return context.sourceReferences.filter(
    (reference) =>
      Boolean(reference.entryId) &&
      !isMedicationReference(reference) &&
      ![
        "attention_event",
        "team_focus",
        "supervisor_directive",
      ].includes(reference.sourceCategory) &&
      reference.sectionKey !== "team-focus"
  );
}

function isMeaningfulSourceReference(reference: ClientDaySourceReference) {
  if (isMedicationReference(reference)) return false;

  if (reference.sourceCategory === "session_observation") {
    return /\b(abc|concern|difficult|elop|prompt|reinforc|recommend|support|tantrum|transition)\b/i.test(
      `${reference.label} ${reference.snippet}`
    );
  }

  if (
    reference.sourceCategory === "provider_observation" &&
    isPositiveSourceReference(reference)
  ) {
    return false;
  }

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
  ].includes(reference.sourceCategory);
}

function isPositiveAttention(event: AttentionEvent) {
  return ["improvement", "mastery", "new_reinforcer", "communication_update"].includes(
    event.attentionType
  );
}

function isPositiveSourceReference(reference: ClientDaySourceReference) {
  if (reference.sourceCategory === "reinforcer") return true;
  if (
    reference.sourceCategory === "provider_observation" &&
    /\bpositive response observed\b/i.test(reference.label)
  ) {
    return true;
  }
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

function isMedicationReference(reference: ClientDaySourceReference) {
  return (
    reference.sourceCategory === "caregiver_context" &&
    isMedicationContext(reference.label, reference.snippet)
  );
}

function isMedicationContext(label: string, snippet: string) {
  return /\bmedication\b/i.test(`${label} ${snippet}`);
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
    const eventKey = [...item.clinicalEventIds].sort().join("|");
    const key = eventKey
      ? `events:${eventKey}`
      : `text:${semanticTextKey(item.summary)}:${[...item.providerRoles].sort().join("|")}`;
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

function formatNaturalList(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function compactPhrase(value: string, maxLength: number) {
  const cleaned = cleanClinicalText(value).replace(/[.!?]+$/, "");
  if (cleaned.length <= maxLength) return cleaned;
  const shortened = cleaned.slice(0, maxLength + 1);
  const boundary = Math.max(shortened.lastIndexOf(","), shortened.lastIndexOf(" "));
  return shortened.slice(0, boundary > maxLength * 0.6 ? boundary : maxLength).trim();
}

function semanticTextKey(value: string) {
  return cleanClinicalText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueSentences(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value) return false;
    const key = semanticTextKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRepeatedSentence(candidate: string, existing: string[]) {
  const candidateKey = semanticTextKey(candidate);
  return existing.some((sentence) => {
    const sentenceKey = semanticTextKey(sentence);
    return (
      sentenceKey === candidateKey ||
      sentenceKey.includes(candidateKey) ||
      candidateKey.includes(sentenceKey)
    );
  });
}

function significanceWeight(
  significance: ClientDayContext["clinicalEvents"][number]["significance"]
) {
  if (significance === "critical") return 3;
  if (significance === "important") return 2;
  return 1;
}

function dayLabel(context: ClientDayContext) {
  return context.status === "FINALIZED" ? "The completed day" : "Today's";
}
