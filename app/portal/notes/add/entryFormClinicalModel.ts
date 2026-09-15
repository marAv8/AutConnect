/**
 * Pure data translators used by the provider documentation UI.
 *
 * EntryForm owns the interactive screens. This module converts those screen
 * values into caretaker, supervisor, observation, and target payloads without
 * depending on React or persistence. Keeping these rules here makes the UI
 * component easier to review and lets future tests exercise clinical mappings
 * independently from rendering.
 */

import type {
  CaretakerContextCard,
  CaretakerContextData,
  CaretakerContextKind,
} from "@/app/libs/caretakerContext";
import type { NoteEntryKind } from "@/app/libs/entryKinds";
import { MetricType, type EntryItemDraft } from "./entryFormHelpers";
import {
  educatorResponseProfiles,
  type EducatorMeasurementProfile,
} from "./entryFormConfig";

export type ObservationItemDraft = {
  category: string;
  observation: string;
  recommendation?: string;
  note?: string;
};

export function buildContextData(
  kind: CaretakerContextKind,
  cards: CaretakerContextCard[],
  values: Record<string, string>,
  comment: string
): CaretakerContextData {
  return {
    kind,
    entries: cards
      .filter((card) => card.kind !== "comment")
      .map((card) => ({
        key: card.key,
        label: card.label,
        value: values[card.key]?.trim() ?? "",
      }))
      .filter((entry) => entry.value.length > 0),
    comment: comment.trim(),
  };
}

export function noteFromContextData(contextData: CaretakerContextData) {
  const lines = contextData.entries.map(
    (entry) => `${entry.label}: ${entry.value}`
  );

  if (contextData.comment) {
    lines.push(`Comment: ${contextData.comment}`);
  }

  return lines.join("\n");
}

type SupervisorNoteData =
  | {
      kind: "SupervisorObservation";
      observationCategory: string;
      observation: string;
    }
  | {
      kind: "ClinicalNote";
      clinicalReflection: string;
    };

export function buildSupervisorNoteData(
  noteKind: NoteEntryKind,
  values: Record<string, string>
): SupervisorNoteData | null {
  if (noteKind === "SupervisorObservation") {
    return {
      kind: noteKind,
      observationCategory: values.observationCategory?.trim() ?? "",
      observation: values.observation?.trim() ?? "",
    };
  }

  if (noteKind === "ClinicalNote") {
    return {
      kind: noteKind,
      clinicalReflection: values.clinicalReflection?.trim() ?? "",
    };
  }

  return null;
}

export function isCompleteSupervisorNote(data: SupervisorNoteData) {
  if (data.kind === "SupervisorObservation") {
    return data.observationCategory.length > 0 && data.observation.length > 0;
  }

  return data.clinicalReflection.length > 0;
}

export function supervisorNoteText(data: SupervisorNoteData) {
  if (data.kind === "SupervisorObservation") {
    return [
      `Observation Category: ${data.observationCategory}`,
      `Observation: ${data.observation}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return `Clinical Reflection: ${data.clinicalReflection}`;
}

export function parseObservationItems(value: string | undefined): ObservationItemDraft[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        category:
          typeof item === "object" &&
          item !== null &&
          "category" in item &&
          typeof item.category === "string"
            ? item.category
            : "",
        observation:
          typeof item === "object" &&
          item !== null &&
          "observation" in item &&
          typeof item.observation === "string"
            ? item.observation
            : "",
        recommendation:
          typeof item === "object" &&
          item !== null &&
          "recommendation" in item &&
          typeof item.recommendation === "string"
            ? item.recommendation
            : "",
        note:
          typeof item === "object" &&
          item !== null &&
          "note" in item &&
          typeof item.note === "string"
            ? item.note
            : "",
      }))
      .filter((item) => item.category && item.observation);
  } catch {
    return [];
  }
}

export function educatorDefaultProfileForTarget(target: string): EducatorMeasurementProfile {
  const normalized = target.toLowerCase();

  if (normalized.includes("peer") || normalized.includes("group") || normalized.includes("participation")) {
    return "Participation";
  }

  if (normalized.includes("assignment") || normalized.includes("completion")) {
    return "Completion";
  }

  if (normalized.includes("independent") || normalized.includes("direction")) {
    return "Independence";
  }

  return "SupportLevel";
}

export function isEducatorMeasurementProfile(
  value: string | null | undefined
): value is EducatorMeasurementProfile {
  return (
    value === "Participation" ||
    value === "SupportLevel" ||
    value === "Completion" ||
    value === "Independence" ||
    value === "Frequency" ||
    value === "PromptLevel" ||
    value === "Duration" ||
    value === "Latency" ||
    value === "Accuracy" ||
    value === "CueingLevel" ||
    value === "AssistanceLevel"
  );
}

export function educatorProfileForItem(item: EntryItemDraft): EducatorMeasurementProfile {
  if (isEducatorMeasurementProfile(item.measurementProfile)) {
    return item.measurementProfile;
  }

  if (item.metricType === MetricType.Frequency) {
    return "Frequency";
  }

  return educatorDefaultProfileForTarget(item.target);
}

export function prepareEducatorItemsForSave(
  items: EntryItemDraft[],
  responses: Record<
    string,
    {
      score: string;
      rawValue: string;
      measurementProfile: EducatorMeasurementProfile;
    }
  >,
  responseProfiles: typeof educatorResponseProfiles = educatorResponseProfiles
) {
  return items.map((item) => {
    const pending = item.goalId ? responses[item.goalId] : null;
    const profile = pending?.measurementProfile ?? educatorProfileForItem(item);
    const response = responseProfiles[profile];

    return {
      ...item,
      metricType: response.metricType,
      measurementProfile: profile,
      score: response.field === "score" ? pending?.score ?? item.score : "",
      rawValue: response.field === "rawValue" ? pending?.rawValue ?? item.rawValue : "",
    };
  });
}

export function observationSessionText(data: {
  observations: ObservationItemDraft[];
  overallComment: string;
}) {
  const lines = data.observations.flatMap((item) => {
    const itemLines = [`${item.category}:`, item.observation];

    if (item.recommendation) {
      itemLines.push("Recommendation:", item.recommendation);
    }

    if (item.note) {
      itemLines.push("Note:", item.note);
    }

    return itemLines;
  });

  if (data.overallComment) {
    lines.push("Overall Comment:", data.overallComment);
  }

  return lines.join("\n");
}
