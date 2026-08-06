/**
 * Serialization boundary for EntryForm autosave state.
 *
 * Drafts may outlive a browser session or an earlier UI version, so every value
 * is normalized before it reaches React state. This module deliberately contains
 * no rendering or database calls; EntryForm uses it to restore exactly what the
 * provider had entered while rejecting malformed persisted values.
 */

import {
  AssessmentDomain,
  MetricType,
  type EntryItemDraft,
} from "./entryFormHelpers";
import {
  behaviorTherapistFallbackTargetOptions,
  educatorFallbackTargetOptions,
  otFallbackTargetOptions,
  speechFallbackTargetOptions,
  type EducatorMeasurementProfile,
} from "./entryFormConfig";
import {
  isEducatorMeasurementProfile,
  type ObservationItemDraft,
} from "./entryFormClinicalModel";

export type DocumentationDraftData = {
  note: string;
  items: EntryItemDraft[];
  contextValues: Record<string, string>;
  contextComment: string;
  observationItems: ObservationItemDraft[];
  overallObservationComment: string;
  isAddingObservation: boolean;
  editingObservationIndex: number | null;
  draftObservationCategory: string;
  draftObservationText: string;
  draftObservationRecommendation: string;
  draftObservationNote: string;
  activeIndex: number;
  visibility: "Private" | "Shared";
  educatorView: "list" | "target" | "observation" | "reflection";
  selectedEducatorTargetIndex: number;
  targetDraft: {
    target: string;
    customTarget: string;
    goal: string;
    measurementProfile: EducatorMeasurementProfile;
  };
  targetEditDraft: {
    target: string;
    customTarget: string;
    goal: string;
    measurementProfile: EducatorMeasurementProfile;
  };
  isEditingEducatorTarget: boolean;
  educatorResponses: Record<
    string,
    {
      score: string;
      rawValue: string;
      measurementProfile: EducatorMeasurementProfile;
    }
  >;
};

export function buildDocumentationDraftData(
  data: DocumentationDraftData
): DocumentationDraftData {
  return data;
}

export function normalizeDocumentationDraft(value: unknown): DocumentationDraftData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  return {
    note: stringField(data.note),
    items: Array.isArray(data.items)
      ? data.items.map(normalizeDraftItem).filter((item): item is EntryItemDraft => item !== null)
      : [],
    contextValues: recordOfStrings(data.contextValues),
    contextComment: stringField(data.contextComment),
    observationItems: Array.isArray(data.observationItems)
      ? data.observationItems
          .map(normalizeDraftObservation)
          .filter((item): item is ObservationItemDraft => item !== null)
      : [],
    overallObservationComment: stringField(data.overallObservationComment),
    isAddingObservation: booleanField(data.isAddingObservation),
    editingObservationIndex:
      typeof data.editingObservationIndex === "number" ? data.editingObservationIndex : null,
    draftObservationCategory: stringField(data.draftObservationCategory),
    draftObservationText: stringField(data.draftObservationText),
    draftObservationRecommendation: stringField(data.draftObservationRecommendation),
    draftObservationNote: stringField(data.draftObservationNote),
    activeIndex: nonNegativeInteger(data.activeIndex),
    visibility: data.visibility === "Shared" ? "Shared" : "Private",
    educatorView:
      data.educatorView === "target" ||
      data.educatorView === "observation" ||
      data.educatorView === "reflection"
        ? data.educatorView
        : "list",
    selectedEducatorTargetIndex: nonNegativeInteger(data.selectedEducatorTargetIndex),
    targetDraft: normalizeTargetDraft(data.targetDraft),
    targetEditDraft: normalizeTargetDraft(data.targetEditDraft),
    isEditingEducatorTarget: booleanField(data.isEditingEducatorTarget),
    educatorResponses: normalizeEducatorResponses(data.educatorResponses),
  };
}

/**
 * Drafts preserve in-progress responses, but the database remains authoritative
 * for which targets are currently active and for their editable definitions.
 */
export function reconcileTargetProgressDraftItems(
  activeItems: EntryItemDraft[],
  draftItems: EntryItemDraft[]
): EntryItemDraft[] {
  const draftByTarget = new Map(
    draftItems.map((item) => [targetDraftIdentity(item), item])
  );

  return activeItems.map((activeItem) => {
    const draftItem = draftByTarget.get(targetDraftIdentity(activeItem));
    if (!draftItem) {
      return activeItem;
    }

    const sameMeasurement =
      (activeItem.measurementProfile ?? "") ===
        (draftItem.measurementProfile ?? "") &&
      activeItem.metricType === draftItem.metricType;

    return {
      ...activeItem,
      score: sameMeasurement ? draftItem.score : activeItem.score,
      rawValue: sameMeasurement ? draftItem.rawValue : activeItem.rawValue,
      supportLevel: sameMeasurement
        ? draftItem.supportLevel
        : activeItem.supportLevel,
      observation: draftItem.observation ?? activeItem.observation,
      measurementType: sameMeasurement
        ? draftItem.measurementType ?? activeItem.measurementType
        : activeItem.measurementType,
    };
  });
}

export function isMeaningfulDocumentationDraft(data: DocumentationDraftData) {
  return (
    data.note.trim().length > 0 ||
    data.contextComment.trim().length > 0 ||
    Object.values(data.contextValues).some((value) => value.trim().length > 0) ||
    data.observationItems.length > 0 ||
    data.overallObservationComment.trim().length > 0 ||
    data.draftObservationCategory.trim().length > 0 ||
    data.draftObservationText.trim().length > 0 ||
    data.draftObservationRecommendation.trim().length > 0 ||
    data.draftObservationNote.trim().length > 0 ||
    data.targetDraft.goal.trim().length > 0 ||
    data.targetDraft.customTarget.trim().length > 0 ||
    Object.values(data.educatorResponses).some(
      (response) => response.score.trim().length > 0 || response.rawValue.trim().length > 0
    ) ||
    data.items.some(
      (item) =>
        item.score.trim().length > 0 ||
        item.rawValue.trim().length > 0 ||
        (item.isNewDraft === true &&
          (item.target.trim().length > 0 || item.goal.trim().length > 0))
    )
  );
}

export function defaultTargetDraftForRole(
  role: string,
  measurementProfile: EducatorMeasurementProfile
) {
  return {
    target:
      role === "OccupationalTherapist"
        ? otFallbackTargetOptions[0]
        : role === "SpeechPathologist"
          ? speechFallbackTargetOptions[0]
          : role === "BehaviorTherapist"
            ? behaviorTherapistFallbackTargetOptions[0]
            : educatorFallbackTargetOptions[0],
    customTarget: "",
    goal: "",
    measurementProfile,
  };
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function targetDraftIdentity(item: EntryItemDraft) {
  const goalId = item.goalId.trim();
  return goalId
    ? `goal:${goalId}`
    : `legacy:${item.target.trim()}\u0000${item.goal.trim()}`;
}

function booleanField(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function recordOfStrings(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => typeof fieldValue === "string")
      .map(([key, fieldValue]) => [key, fieldValue as string])
  );
}

function normalizeDraftItem(value: unknown): EntryItemDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const metricType = stringField(item.metricType);
  const domain = stringField(item.domain);
  return {
    goalId: stringField(item.goalId),
    target: stringField(item.target),
    goal: stringField(item.goal),
    metricType: isMetricType(metricType) ? metricType : "",
    domain: isAssessmentDomain(domain) ? domain : "",
    score: stringField(item.score),
    rawValue: stringField(item.rawValue),
    supportLevel: stringField(item.supportLevel),
    observation: stringField(item.observation),
    measurementType: stringField(item.measurementType) || undefined,
    measurementProfile: stringField(item.measurementProfile) || null,
    isNewDraft: typeof item.isNewDraft === "boolean" ? item.isNewDraft : undefined,
  };
}

function normalizeDraftObservation(value: unknown): ObservationItemDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const category = stringField(item.category);
  const observation = stringField(item.observation);

  if (!category && !observation) {
    return null;
  }

  return {
    category,
    observation,
    recommendation: stringField(item.recommendation),
    note: stringField(item.note),
  };
}

function normalizeTargetDraft(value: unknown): DocumentationDraftData["targetDraft"] {
  if (!value || typeof value !== "object") {
    return {
      target: "",
      customTarget: "",
      goal: "",
      measurementProfile: "Participation",
    };
  }

  const draft = value as Record<string, unknown>;
  const measurementProfile = stringField(draft.measurementProfile);

  return {
    target: stringField(draft.target),
    customTarget: stringField(draft.customTarget),
    goal: stringField(draft.goal),
    measurementProfile: isEducatorMeasurementProfile(measurementProfile)
      ? measurementProfile
      : "Participation",
  };
}

function normalizeEducatorResponses(value: unknown): DocumentationDraftData["educatorResponses"] {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, response]) => {
        if (!response || typeof response !== "object") {
          return null;
        }

        const data = response as Record<string, unknown>;
        const measurementProfile = stringField(data.measurementProfile);
        return [
          key,
          {
            score: stringField(data.score),
            rawValue: stringField(data.rawValue),
            measurementProfile: isEducatorMeasurementProfile(measurementProfile)
              ? measurementProfile
              : "Participation",
          },
        ] as const;
      })
      .filter((entry): entry is readonly [
        string,
        {
          score: string;
          rawValue: string;
          measurementProfile: EducatorMeasurementProfile;
        },
      ] => entry !== null)
  );
}

function isMetricType(value: string): value is MetricType {
  return (
    value === MetricType.Percentage ||
    value === MetricType.Frequency ||
    value === MetricType.Duration ||
    value === MetricType.Subjective
  );
}

function isAssessmentDomain(value: string): value is AssessmentDomain {
  return (
    value === AssessmentDomain.Behavior ||
    value === AssessmentDomain.SkillAcquisition ||
    value === AssessmentDomain.Communication ||
    value === AssessmentDomain.Adaptive ||
    value === AssessmentDomain.Regulation ||
    value === AssessmentDomain.Other
  );
}
