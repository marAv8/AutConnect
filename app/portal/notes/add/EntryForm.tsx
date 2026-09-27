"use client";

/**
 * Interactive documentation workspace opened from a provider's dashboard badge.
 *
 * This component coordinates role-specific screens, autosaved drafts, subsection
 * data, and final session completion. Clinical labels and response scales live in
 * entryFormConfig.ts; server persistence remains in app/actions.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEducatorTarget,
  updateEducatorTarget,
} from "@/app/actions/createEducatorTarget";
import { deleteSupervisorEntry } from "@/app/actions/deleteSupervisorEntry";
import {
  clearDocumentationDraft,
  saveDocumentationDraft,
} from "@/app/actions/documentationDrafts";
import { removeGoalDefinition } from "@/app/actions/removeGoalDefinition";
import { updateEntryVisibility } from "@/app/actions/updateEntryVisibility";
import {
  CUSTOM_OBSERVABLE_SKILL_TARGET,
  getProfessionTemplate,
  type ProfessionMeasurementOption,
} from "@/app/libs/professionTemplates";
import { getClinicalHelpContent } from "@/app/libs/clinicalHelp";
import { ContextualHelp } from "@/components/ContextualHelp";
import { Button } from "@/components/ui/button";
import { ChevronControl } from "@/components/ui/ChevronControl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { Textarea } from "@/components/ui/textarea";
import { useGuardedSwipe } from "@/components/useGuardedSwipe";
import {
  traceDashboardInteractionHandled,
  traceDashboardInteractionState,
} from "@/app/dashboard/dashboardInteractionTraceClient";
import {
  createEmptyItem,
  formatDurationForEntryInput,
  MetricType,
  normalizeEntryDurationInput,
  type EntryItemDraft,
} from "./entryFormHelpers";
import { useEntrySubmit } from "./useEntrySubmit";
import type {
  CaretakerContextCard,
  CaretakerContextKind,
} from "@/app/libs/caretakerContext";
import type { NoteEntryKind } from "@/app/libs/entryKinds";
import {
  behaviorTherapistFallbackTargetOptions,
  behaviorTherapistMeasurementProfiles,
  behaviorTherapistResponseProfiles,
  educatorFallbackTargetOptions,
  educatorMeasurementProfiles,
  educatorResponseProfiles,
  fallbackMeasurementOptions,
  otFallbackTargetOptions,
  otMeasurementProfiles,
  otResponseProfiles,
  speechFallbackTargetOptions,
  speechMeasurementProfiles,
  speechResponseProfiles,
  type EducatorMeasurementProfile,
} from "./entryFormConfig";
import {
  buildContextData,
  buildSupervisorNoteData,
  educatorDefaultProfileForTarget,
  isCompleteSupervisorNote,
  isEducatorMeasurementProfile,
  noteFromContextData,
  observationSessionText,
  parseObservationItems,
  prepareEducatorItemsForSave,
  supervisorNoteText,
  type ObservationItemDraft,
} from "./entryFormClinicalModel";
import {
  buildDocumentationDraftData,
  defaultTargetDraftForRole,
  isMeaningfulDocumentationDraft,
  normalizeDocumentationDraft,
  reconcileTargetProgressDraftItems,
} from "./entryFormDraftModel";
import {
  CaretakerContextEntryForm,
  ClinicalReflectionEntryForm,
} from "./EntrySpecializedForms";
import { ObservationEntryForm } from "./ObservationEntryForm";
import targetStyles from "./TargetWorkflow.module.css";

type Props = {
  clientId: string;
  providerId: string;
  role: string;
  mode?: "create" | "edit";
  clientName: string;
  providerName: string;
  providerRole: string;
  todayLabel: string;
  initialValues?: {
    note: string;
    items: EntryItemDraft[];
    visibility?: "Private" | "Shared";
    contextValues?: Record<string, string>;
    contextComment?: string;
  };
  draft?: {
    data: unknown;
    updatedAt: string;
  } | null;
  draftWorkflowKey?: string;
  targetOptions?: TargetOption[];
  noteKind?: NoteEntryKind;
  contextKind?: CaretakerContextKind;
  contextCards?: CaretakerContextCard[];
  educatorMode?: "classroomProgress" | "addTarget";
  onSubmitted?: () => void;
  onSaved?: (
    entryId: string,
    visibility?: "Private" | "Shared",
    status?: string
  ) => void;
  onCancelToProgress?: () => void;
};

type TargetOption = {
  value: string;
  label: string;
  recommendedMetricType: MetricType;
  defaultDomain:
    | "Behavior"
    | "SkillAcquisition"
    | "Communication"
    | "Adaptive"
    | "Regulation"
    | "Other";
  group?: string;
  recommendedMeasurementProfile?: string;
  direction?: "higherIsBetter" | "lowerIsBetter" | "goalDependent";
  description?: string;
  tags?: string[];
};

const fieldInputStyle = {
  border: "none",
  boxSizing: "border-box" as const,
};

export default function EntryForm({
  clientId,
  role,
  mode = "create",
  clientName,
  providerName,
  providerRole,
  todayLabel,
  initialValues,
  targetOptions = [],
  noteKind = "SessionNote",
  contextKind,
  contextCards = [],
  educatorMode,
  draft,
  draftWorkflowKey: draftWorkflowKeyProp,
  onSubmitted,
  onSaved,
  onCancelToProgress,
}: Props) {
  const { handleSubmit: submitEntry } = useEntrySubmit();
  const router = useRouter();
  const restoredDraft = normalizeDocumentationDraft(draft?.data);
  const draftWorkflowKey = draftWorkflowKeyProp ?? (
    educatorMode === "addTarget"
      ? `${contextKind ?? noteKind}:addTarget`
      : contextKind ?? noteKind
  );
  const isEditMode = mode === "edit";
  const isCreationMode = !isEditMode;
  const canSubmitCommentOnly = role === "Supervisor" || role === "Caregiver";
  const isContextMode = !!contextKind;
  const isSupervisorNoteMode =
    noteKind === "SupervisorObservation" ||
    noteKind === "ClinicalNote" ||
    noteKind === "SensoryObservation" ||
    noteKind === "CommunicationObservation";
  const isSupervisorVisibilityMode =
    noteKind === "SupervisorObservation" || noteKind === "ClinicalNote";
  const isTargetProgressProvider =
    role === "BehaviorTherapist" ||
    role === "Educator" ||
    role === "OccupationalTherapist" ||
    role === "SpeechPathologist";
  const targetSaveInFlightRef = useRef(false);
  const [returnToProgressAfterTargetSave, setReturnToProgressAfterTargetSave] =
    useState(false);
  const isEducatorSessionMode =
    (isTargetProgressProvider || educatorMode === "classroomProgress") &&
    (noteKind === "SessionNote" || noteKind === "SpeechProgress") &&
    !contextKind &&
    !isSupervisorNoteMode &&
    (educatorMode !== "addTarget" || returnToProgressAfterTargetSave);
  const isOccupationalTherapist = role === "OccupationalTherapist";
  const isSpeechPathologist = role === "SpeechPathologist";
  const isBehaviorTherapist = role === "BehaviorTherapist";
  const isEducatorAddTargetMode =
    educatorMode === "addTarget" && !returnToProgressAfterTargetSave;
  const progressTitle = isSpeechPathologist
    ? "Speech Progress"
    : isOccupationalTherapist
      ? "Therapy Progress"
      : isBehaviorTherapist
        ? "Session Progress"
        : "Classroom Progress";
  const progressEmptyText = "Add a target before recording progress.";
  const targetSelectTitle = "Target";
  const targetGoalPlaceholder = isOccupationalTherapist
    ? "Button jacket independently."
    : isSpeechPathologist
      ? "Uses 3-word requests independently."
      : isBehaviorTherapist
        ? "Requests preferred items independently."
      : "Remain seated during independent work for 10 minutes.";
  const activeResponseProfiles = isBehaviorTherapist
    ? behaviorTherapistResponseProfiles
    : isSpeechPathologist
    ? speechResponseProfiles
    : isOccupationalTherapist
      ? otResponseProfiles
      : educatorResponseProfiles;
  const activeMeasurementProfiles = isBehaviorTherapist
    ? behaviorTherapistMeasurementProfiles
    : isSpeechPathologist
      ? speechMeasurementProfiles
      : isOccupationalTherapist
        ? otMeasurementProfiles
        : educatorMeasurementProfiles;
  const defaultMeasurementProfile =
    activeMeasurementProfiles[0]?.value ?? "Participation";
  const measurementProfileLabel = (profile: { label: string }) => profile.label;

  const serverItems = initialValues?.items ?? [createEmptyItem()];
  const shouldReconcileTargetDraft =
    isTargetProgressProvider &&
    (noteKind === "SessionNote" || noteKind === "SpeechProgress") &&
    !contextKind &&
    !isSupervisorNoteMode;
  const initialItems =
    restoredDraft && shouldReconcileTargetDraft
      ? reconcileTargetProgressDraftItems(serverItems, restoredDraft.items)
      : restoredDraft?.items ?? serverItems;

  const [note, setNote] = useState(restoredDraft?.note ?? initialValues?.note ?? "");
  const [items, setItems] = useState<EntryItemDraft[]>(initialItems);
  const [contextValues, setContextValues] = useState<Record<string, string>>(
    restoredDraft?.contextValues ?? initialValues?.contextValues ?? {}
  );
  const [contextComment, setContextComment] = useState(
    restoredDraft?.contextComment ?? initialValues?.contextComment ?? ""
  );
  const [observationItems, setObservationItems] = useState<ObservationItemDraft[]>(
    () =>
      restoredDraft?.observationItems ??
      parseObservationItems(initialValues?.contextValues?.observationItemsJson)
  );
  const [overallObservationComment, setOverallObservationComment] = useState(
    restoredDraft?.overallObservationComment ??
      initialValues?.contextValues?.overallComment ??
      ""
  );
  const [isAddingObservation, setIsAddingObservation] = useState(
    restoredDraft?.isAddingObservation ??
      (noteKind === "SensoryObservation" || noteKind === "CommunicationObservation")
  );
  const [editingObservationIndex, setEditingObservationIndex] = useState<number | null>(
    restoredDraft?.editingObservationIndex ?? null
  );
  const [draftObservationCategory, setDraftObservationCategory] = useState(
    restoredDraft?.draftObservationCategory ?? ""
  );
  const [draftObservationText, setDraftObservationText] = useState(
    restoredDraft?.draftObservationText ?? ""
  );
  const [draftObservationRecommendation, setDraftObservationRecommendation] = useState(
    restoredDraft?.draftObservationRecommendation ?? ""
  );
  const [draftObservationNote, setDraftObservationNote] = useState(
    restoredDraft?.draftObservationNote ?? ""
  );
  const [activeIndex, setActiveIndex] = useState(
    noteKind === "ClinicalNote" ? 0 : restoredDraft?.activeIndex ?? 0
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [visibility, setVisibility] = useState<"Private" | "Shared">(
    restoredDraft?.visibility ?? initialValues?.visibility ?? "Private"
  );
  useEffect(() => {
    if (!isSupervisorVisibilityMode) return;
    traceDashboardInteractionState(
      visibility === "Private" ? "visibility-private" : "visibility-team"
    );
  }, [isSupervisorVisibilityMode, visibility]);
  const [educatorView, setEducatorView] = useState<
    "list" | "target" | "observation" | "reflection"
  >("list");
  const [selectedEducatorTargetIndex, setSelectedEducatorTargetIndex] = useState(
    restoredDraft?.selectedEducatorTargetIndex ?? 0
  );
  const [targetDraft, setTargetDraft] = useState(restoredDraft?.targetDraft ?? {
    target: (role === "OccupationalTherapist"
      ? otFallbackTargetOptions[0]
      : role === "SpeechPathologist"
        ? speechFallbackTargetOptions[0]
      : role === "BehaviorTherapist"
        ? behaviorTherapistFallbackTargetOptions[0]
      : educatorFallbackTargetOptions[0]),
    customTarget: "",
    goal: "",
    measurementProfile: defaultMeasurementProfile,
  });
  const [isEditingEducatorTarget, setIsEditingEducatorTarget] = useState(
    restoredDraft?.isEditingEducatorTarget ?? false
  );
  const [targetEditDraft, setTargetEditDraft] = useState(restoredDraft?.targetEditDraft ?? {
    target: (role === "OccupationalTherapist"
      ? otFallbackTargetOptions[0]
      : role === "SpeechPathologist"
        ? speechFallbackTargetOptions[0]
      : role === "BehaviorTherapist"
        ? behaviorTherapistFallbackTargetOptions[0]
      : educatorFallbackTargetOptions[0]),
    customTarget: "",
    goal: "",
    measurementProfile: defaultMeasurementProfile,
  });
  const [educatorResponses, setEducatorResponses] = useState<
    Record<
      string,
      {
        score: string;
        rawValue: string;
        measurementProfile: EducatorMeasurementProfile;
      }
    >
  >(restoredDraft?.educatorResponses ?? {});
  const [targetSaveError, setTargetSaveError] = useState("");
  const educatorResponseRef = useRef<
    Record<
      string,
      {
        score: string;
        rawValue: string;
        measurementProfile: EducatorMeasurementProfile;
      }
    >
  >(restoredDraft?.educatorResponses ?? {});
  const newDraftReturnIndexRef = useRef<number | null>(null);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const lastDraftPayloadRef = useRef("");
  const didHydrateDraftRef = useRef(false);
  const contextValuesRef = useRef(contextValues);
  const sharedContextCommentRef = useRef(initialValues?.contextComment ?? "");
  const caregiverPublishChainRef = useRef<Promise<void>>(Promise.resolve());
  const didRestoreCaregiverContextRef = useRef(false);
  const caregiverContextPublisherRef = useRef<
    (values: Record<string, string>) => void
  >(() => undefined);
  const targetListId = useId();
  const professionTemplate = getProfessionTemplate(role);
  const measurementOptions =
    professionTemplate?.measurements.length ? professionTemplate.measurements : fallbackMeasurementOptions;

  const measurementOptionByValue = useMemo(() => {
    const map = new Map<string, ProfessionMeasurementOption>();
    for (const option of measurementOptions) {
      map.set(option.value, option);
    }
    return map;
  }, [measurementOptions]);

  const measurementOptionForMetric = (metricType: MetricType | "") => {
    if (!metricType) {
      return measurementOptions[0] ?? fallbackMeasurementOptions[0];
    }

    return (
      measurementOptions.find((option) => option.metricType === metricType) ??
      fallbackMeasurementOptions.find((option) => option.metricType === metricType) ??
      measurementOptions[0] ??
      fallbackMeasurementOptions[0]
    );
  };

  const measurementOptionForItem = (item: EntryItemDraft) =>
    (item.measurementType ? measurementOptionByValue.get(item.measurementType) : null) ??
    measurementOptionForMetric(item.metricType);

  const buildCurrentDocumentationDraft = () =>
    buildDocumentationDraftData({
      note,
      items,
      contextValues,
      contextComment,
      observationItems,
      overallObservationComment,
      isAddingObservation,
      editingObservationIndex,
      draftObservationCategory,
      draftObservationText,
      draftObservationRecommendation,
      draftObservationNote,
      activeIndex,
      visibility,
      educatorView,
      selectedEducatorTargetIndex,
      targetDraft,
      targetEditDraft,
      isEditingEducatorTarget,
      educatorResponses,
    });

  const saveCurrentDocumentationDraftNow = async () => {
    const payload = buildCurrentDocumentationDraft();
    if (!isMeaningfulDocumentationDraft(payload)) {
      return true;
    }

    const serialized = JSON.stringify(payload);
    if (serialized === lastDraftPayloadRef.current) {
      return true;
    }

    if (draftSaveTimeoutRef.current !== null) {
      window.clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("workflowKey", draftWorkflowKey);
    formData.append("data", serialized);

    const result = await saveDocumentationDraft(formData);
    if (result.ok) {
      lastDraftPayloadRef.current = serialized;
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (saveStatus !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveStatus("idle");
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [saveStatus]);

  useEffect(() => {
    return () => {
      if (draftSaveTimeoutRef.current !== null) {
        window.clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const payload = buildDocumentationDraftData({
      note,
      items,
      contextValues,
      contextComment,
      observationItems,
      overallObservationComment,
      isAddingObservation,
      editingObservationIndex,
      draftObservationCategory,
      draftObservationText,
      draftObservationRecommendation,
      draftObservationNote,
      activeIndex,
      visibility,
      educatorView,
      selectedEducatorTargetIndex,
      targetDraft,
      targetEditDraft,
      isEditingEducatorTarget,
      educatorResponses,
    });

    const serialized = JSON.stringify(payload);
    if (!didHydrateDraftRef.current) {
      didHydrateDraftRef.current = true;
      if (isMeaningfulDocumentationDraft(payload)) {
        lastDraftPayloadRef.current = serialized;
      }
      return;
    }

    if (!isMeaningfulDocumentationDraft(payload)) {
      return;
    }

    if (serialized === lastDraftPayloadRef.current) {
      return;
    }

    if (draftSaveTimeoutRef.current !== null) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = window.setTimeout(() => {
      const formData = new FormData();
      formData.append("clientId", clientId);
      formData.append("workflowKey", draftWorkflowKey);
      formData.append("data", serialized);

      void saveDocumentationDraft(formData).then((result) => {
        if (result.ok && result.updatedAt) {
          lastDraftPayloadRef.current = serialized;
          return;
        }
      });
    }, 450);
  }, [
    activeIndex,
    clientId,
    contextComment,
    contextValues,
    draft,
    draftObservationCategory,
    draftObservationNote,
    draftObservationRecommendation,
    draftObservationText,
    draftWorkflowKey,
    editingObservationIndex,
    educatorResponses,
    educatorView,
    isAddingObservation,
    isEditingEducatorTarget,
    items,
    note,
    observationItems,
    overallObservationComment,
    selectedEducatorTargetIndex,
    targetDraft,
    targetEditDraft,
    visibility,
  ]);

  const hasItems = items.length > 0;
  const supervisorCardCount = noteKind === "ClinicalNote" ? 1 : 2;
  const activeItem = useMemo(
    () => (hasItems ? items[Math.min(activeIndex, items.length - 1)] : null),
    [activeIndex, hasItems, items]
  );
  const activeItemUsesCreationUI = activeItem?.isNewDraft === true;
  const educatorTargets = useMemo(
    () =>
      items.filter(
        (item) =>
          item.goalId.trim().length > 0 &&
          item.target.trim().length > 0 &&
          item.goal.trim().length > 0
      ),
    [items]
  );
  const selectedEducatorTarget =
    educatorTargets[Math.min(selectedEducatorTargetIndex, educatorTargets.length - 1)] ??
    null;
  const renderMeasurementHelpLabel = (profile: {
    value: EducatorMeasurementProfile;
    label: string;
  }) => {
    const label = measurementProfileLabel(profile);
    const helpContent = getClinicalHelpContent(profile.value);

    if (!helpContent) {
      return label;
    }

    return <ContextualHelp {...helpContent} label={label} />;
  };
  const renderMeasurementHelpForOption = (
    option: Pick<ProfessionMeasurementOption, "value" | "label">
  ) => {
    const helpContent = getClinicalHelpContent(option.value) ?? getClinicalHelpContent(option.label);

    if (!helpContent) {
      return option.label;
    }

    return <ContextualHelp {...helpContent} label={option.label} />;
  };
  const renderCurrentResponsePrompt = (
    profile: EducatorMeasurementProfile,
    label: string
  ) => {
    const helpContent = getClinicalHelpContent(profile);

    if (!helpContent) {
      return label;
    }

    return <ContextualHelp {...helpContent} label={label} />;
  };
  const supervisorVisibilityControl = isSupervisorVisibilityMode ? (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 6,
        width: "min(100%, 260px)",
        margin: "0 auto",
      }}
    >
      {(["Private", "Shared"] as const).map((option) => {
        const selected = visibility === option;
        return (
          <Button
            key={option}
            type="button"
            variant="ghost"
            className="clinical-selection-control visibility-selection-control"
            data-dashboard-trace-control={
              option === "Private" ? "visibility-private" : "visibility-team"
            }
            aria-pressed={selected}
            disabled={saveStatus === "saving"}
            onClick={() => {
              traceDashboardInteractionHandled(
                option === "Private" ? "visibility-private" : "visibility-team"
              );
              void requestVisibilityChange(option);
            }}
            style={{
              width: "100%",
              minWidth: 0,
              minHeight: 38,
              height: "auto",
              justifyContent: "center",
              borderRadius: 12,
              whiteSpace: "nowrap",
              textAlign: "center",
              lineHeight: 1.2,
              fontSize: 14,
              background: selected ? "rgb(0 0 0 / 9%)" : "var(--glass-strong)",
              boxShadow: selected ? "var(--inset-paper)" : "var(--shadow-soft)",
            }}
          >
            {option === "Private" ? "Private" : "Team"}
          </Button>
        );
      })}
    </div>
  ) : null;
  const availableEducatorTargets = useMemo(
    () => {
      if (targetOptions.length > 0) {
        const mappedTargets = targetOptions.map((option) => ({
          value: option.value,
          label: option.label,
          group: option.group,
          recommendedMeasurementProfile: option.recommendedMeasurementProfile,
          defaultDomain: option.defaultDomain,
        }));
        return mappedTargets;
      }

      return (isBehaviorTherapist
            ? behaviorTherapistFallbackTargetOptions
            : isSpeechPathologist
            ? speechFallbackTargetOptions
            : isOccupationalTherapist
              ? otFallbackTargetOptions
              : educatorFallbackTargetOptions
          ).map((option) => ({
            value: option,
            label: option,
            group: undefined,
            recommendedMeasurementProfile: undefined,
            defaultDomain: undefined,
          }));
    },
    [isBehaviorTherapist, isOccupationalTherapist, isSpeechPathologist, targetOptions]
  );
  const activeMeasurementProfileValues = useMemo(
    () => new Set(activeMeasurementProfiles.map((profile) => profile.value)),
    [activeMeasurementProfiles]
  );
  const normalizeMeasurementProfileForRole = (
    profile: string | null | undefined,
    target = ""
  ): EducatorMeasurementProfile => {
    const knownProfile =
      isEducatorMeasurementProfile(profile) ? profile : educatorDefaultProfileForTarget(target);

    if (knownProfile === "SupportLevel") {
      if (isBehaviorTherapist) return "PromptLevel";
      if (isSpeechPathologist) return "CueingLevel";
      if (isOccupationalTherapist) return "AssistanceLevel";
      return activeMeasurementProfileValues.has("Independence")
        ? "Independence"
        : defaultMeasurementProfile;
    }

    return activeMeasurementProfileValues.has(knownProfile)
      ? knownProfile
      : defaultMeasurementProfile;
  };
  const noteStageMaxWidth = 1080;
  const noteCardHeight = 320;
  const noteCardMaxWidth = noteStageMaxWidth;
  const commentMaxWidth = noteStageMaxWidth;

  const updateItem = (index: number, updater: (item: EntryItemDraft) => EntryItemDraft) => {
    setItems((previous) =>
      previous.map((item, itemIndex) => (itemIndex === index ? updater(item) : item))
    );
  };

  const addItem = () => {
    newDraftReturnIndexRef.current = activeIndex;
    setItems((previous) => {
      const next = [...previous, createEmptyItem()];
      setActiveIndex(next.length - 1);
      return next;
    });
  };

  const plusButton = (
    <Button
      type="button"
      onClick={addItem}
      aria-label="Add assessment item"
      className="add-note-plus-control"
      style={{
        width: 82,
        height: 82,
        borderRadius: "50%",
        border: "none",
        background: "var(--glass-strong)",
        color: "var(--foreground)",
        fontSize: 52,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      +
    </Button>
  );

  const removeActiveItem = async () => {
    if (!hasItems) {
      return;
    }

    const previousItems = items;
    const next = previousItems.filter((_, index) => index !== activeIndex);
    const nextActiveIndex =
      next.length === 0 ? 0 : Math.max(0, Math.min(activeIndex - 1, next.length - 1));

    setItems(next);
    setActiveIndex(nextActiveIndex);

    if (!isEditMode || activeItem?.isNewDraft) {
      if (!activeItem?.goalId) {
        return;
      }

      const formData = new FormData();
      formData.append("clientId", clientId);
      formData.append("goalId", activeItem.goalId);

      setSaveStatus("saving");
      const result = await removeGoalDefinition(formData);
      setSaveStatus(result.ok ? "saved" : "error");

      if (!result.ok) {
        setItems(previousItems);
        setActiveIndex(activeIndex);
      }

      return;
    }

    setSaveStatus("saving");
    const result = await saveItems(next);
    setSaveStatus(result.ok ? "saved" : "error");

    if (!result.ok) {
      setItems(previousItems);
      setActiveIndex(activeIndex);
    }
  };

  const prevItem = () => {
    const count = isContextMode
      ? contextCards.length
      : isSupervisorNoteMode
        ? supervisorCardCount
        : items.length;
    if (count === 0) {
      return;
    }

    setActiveIndex((currentIndex) => Math.max(0, currentIndex - 1));
  };

  const nextItem = () => {
    const count = isContextMode
      ? contextCards.length
      : isSupervisorNoteMode
        ? supervisorCardCount
        : items.length;
    if (count === 0) {
      return;
    }

    setActiveIndex((currentIndex) => Math.min(count - 1, currentIndex + 1));
  };

  const updateMetricValue = (
    index: number,
    value: string,
    field: "rawValue" | "score" = "rawValue"
  ) => {
    updateItem(index, (item) => ({
      ...item,
      [field]: value,
    }));
  };

  const itemCarouselCount = isContextMode
    ? contextCards.length
    : isSupervisorNoteMode
      ? supervisorCardCount
      : items.length;
  const itemSwipe = useGuardedSwipe({
    onSwipeLeft: nextItem,
    onSwipeRight: prevItem,
    canSwipeLeft: activeIndex < itemCarouselCount - 1,
    canSwipeRight: activeIndex > 0,
    disabled: itemCarouselCount < 2,
  });
  const targetSwipe = useGuardedSwipe({
    onSwipeLeft: () =>
      setActiveIndex((current) => Math.min(2, current + 1)),
    onSwipeRight: () =>
      setActiveIndex((current) => Math.max(0, current - 1)),
    canSwipeLeft: activeIndex < 2,
    canSwipeRight: activeIndex > 0,
    disabled: !isEducatorAddTargetMode,
  });

  const templateTargetByValue = useMemo(() => {
    const map = new Map<string, TargetOption>();
    for (const option of targetOptions) {
      map.set(option.value.toLowerCase(), option);
      map.set(option.label.toLowerCase(), option);
    }
    return map;
  }, [targetOptions]);

  const updateTargetValue = (index: number, value: string) => {
    const selectedTarget = templateTargetByValue.get(value.trim().toLowerCase());
    const recommendedMetricType = selectedTarget?.recommendedMetricType;

    updateItem(index, (item) => ({
      ...item,
      goalId: "",
      target: selectedTarget?.value ?? value,
      metricType: recommendedMetricType ?? item.metricType,
      measurementType: recommendedMetricType
        ? measurementOptionForMetric(recommendedMetricType).value
        : item.measurementType,
      domain: selectedTarget?.defaultDomain ?? item.domain,
    }));
  };

  const updateMeasurementType = (index: number, measurementValue: string) => {
    const selectedMeasurement = measurementOptionByValue.get(measurementValue);

    if (!selectedMeasurement) {
      return;
    }

    updateItem(index, (item) => ({
      ...item,
      goalId: "",
      measurementType: selectedMeasurement.value,
      metricType: selectedMeasurement.metricType,
      score:
        selectedMeasurement.metricType === MetricType.Duration ||
        selectedMeasurement.metricType === MetricType.Frequency ||
        selectedMeasurement.metricType === MetricType.Percentage
          ? ""
          : item.score,
      rawValue:
        selectedMeasurement.metricType === MetricType.Subjective ? "" : item.rawValue,
    }));
  };

  const saveItems = async (
    draftItems: EntryItemDraft[],
    redirectOnSuccess = false,
    contextSnapshot?: {
      values: Record<string, string>;
      comment: string;
    }
  ) => {
    const supervisorData = isSupervisorNoteMode
      ? buildSupervisorNoteData(noteKind, contextValues)
      : undefined;
    if (supervisorData && !isCompleteSupervisorNote(supervisorData)) {
      return {
        ok: false as const,
        reason: "invalid_data" as const,
        noteForSave: supervisorNoteText(supervisorData),
      };
    }

    const contextData = contextKind
      ? buildContextData(
          contextKind,
          contextCards,
          contextSnapshot?.values ?? contextValues,
          contextSnapshot?.comment ?? contextComment
        )
      : undefined;

    return submitEntry({
      clientId,
      note: supervisorData
        ? supervisorNoteText(supervisorData)
        : contextData
          ? noteFromContextData(contextData)
          : note,
      items:
        supervisorData || contextData
          ? []
          : isEducatorSessionMode
            ? prepareEducatorItemsForSave(
                draftItems,
                educatorResponseRef.current,
                activeResponseProfiles
              )
            : draftItems,
      canSubmitCommentOnly,
      kind: contextKind ?? noteKind,
      contextData: supervisorData ?? contextData,
      visibility: isSupervisorVisibilityMode ? visibility : "Shared",
      redirectOnSuccess,
    });
  };

  useEffect(() => {
    caregiverContextPublisherRef.current = (values) => {
      setSaveStatus("saving");
      caregiverPublishChainRef.current = caregiverPublishChainRef.current.then(
        async () => {
          try {
            const result = await saveItems(items, false, {
              values,
              // A partially typed optional comment remains only in the draft.
              comment: sharedContextCommentRef.current,
            });
            if (!result.ok) {
              setSaveStatus("error");
              return;
            }

            setNote(result.noteForSave);
            setSaveStatus("saved");
            router.refresh();
            if (result.entryId) {
              onSaved?.(result.entryId, result.visibility, result.status);
            }
          } catch {
            setSaveStatus("error");
          }
        }
      );
    };
  });

  useEffect(() => {
    if (
      didRestoreCaregiverContextRef.current ||
      !contextKind ||
      role !== "Caregiver"
    ) {
      return;
    }
    didRestoreCaregiverContextRef.current = true;

    const restoredValues = contextValuesRef.current;
    if (Object.values(restoredValues).some((value) => value.trim().length > 0)) {
      caregiverContextPublisherRef.current(restoredValues);
    }
  }, [contextKind, role]);

  const clearCurrentDraft = async () => {
    if (draftSaveTimeoutRef.current !== null) {
      window.clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("workflowKey", draftWorkflowKey);
    await clearDocumentationDraft(formData);
    lastDraftPayloadRef.current = "";
  };

  async function requestVisibilityChange(nextVisibility: "Private" | "Shared") {
    if (nextVisibility === visibility) {
      return;
    }

    const previousVisibility = visibility;
    if (
      visibility === "Private" &&
      nextVisibility === "Shared" &&
      !window.confirm(
        "Share with Team?\n\nThis note will become visible to all providers assigned to this client."
      )
    ) {
      return;
    }

    setVisibility(nextVisibility);
    setSaveStatus("idle");

    if (!isEditMode || !isSupervisorVisibilityMode) {
      return;
    }

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("kind", noteKind);
    formData.append("visibility", nextVisibility);

    setSaveStatus("saving");
    const result = await updateEntryVisibility(formData);
    if (result.ok) {
      router.refresh();
      if (result.entryId) {
        onSaved?.(result.entryId, result.visibility);
      }
      setSaveStatus("saved");
      return;
    }

    setVisibility(previousVisibility);
    setSaveStatus("error");
  }

  async function deleteSupervisorDocumentation() {
    if (
      !window.confirm("Delete this note?\n\nThis cannot be undone.")
    ) {
      return;
    }

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("kind", noteKind);
    setSaveStatus("saving");
    const result = await deleteSupervisorEntry(formData);
    if (result.ok) {
      router.refresh();
      onSubmitted?.();
      return;
    }

    setSaveStatus("error");
  }

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaveStatus("saving");
    const itemsForSave = isEducatorSessionMode
      ? items.filter((item) => !item.goalId || educatorTargetCompleted(item))
      : items;
    const shouldReturnAfterSavingDraft =
      isEditMode &&
      activeItem?.isNewDraft === true &&
      newDraftReturnIndexRef.current !== null;
    const result = await saveItems(itemsForSave, false);
    if (result.ok) {
      if (contextKind && role === "Caregiver") {
        sharedContextCommentRef.current = contextComment;
      }
      setNote(result.noteForSave);
      setItems((previous) =>
        previous.map((item) => ({ ...item, isNewDraft: false }))
      );
      if (shouldReturnAfterSavingDraft) {
        setActiveIndex(
          Math.max(0, Math.min(newDraftReturnIndexRef.current ?? 0, items.length - 1))
        );
      }
      newDraftReturnIndexRef.current = null;
      router.refresh();
      if (result.entryId) {
        onSaved?.(result.entryId, result.visibility, result.status);
      }
      await clearCurrentDraft();
      onSubmitted?.();
    }
    setSaveStatus(result.ok ? "saved" : "error");
  };

  const updateContextValue = (key: string, value: string) => {
    const previous = contextValuesRef.current;
    const next = {
      ...previous,
      [key]: previous[key] === value ? "" : value,
    };
    contextValuesRef.current = next;
    setContextValues(next);

    if (!contextKind || role !== "Caregiver") {
      return;
    }

    caregiverContextPublisherRef.current(next);
  };

  const setContextValue = (key: string, value: string) => {
    setContextValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const startNewObservation = () => {
    setDraftObservationCategory("");
    setDraftObservationText("");
    setDraftObservationRecommendation("");
    setDraftObservationNote("");
    setEditingObservationIndex(null);
    setActiveIndex(0);
    setIsAddingObservation(true);
    setSaveStatus("idle");
  };

  const startEditObservation = (index: number) => {
    const item = observationItems[index];
    if (!item) return;
    setDraftObservationCategory(item.category);
    setDraftObservationText(item.observation);
    setDraftObservationRecommendation(item.recommendation ?? "");
    setDraftObservationNote(item.note ?? "");
    setEditingObservationIndex(index);
    setActiveIndex(0);
    setIsAddingObservation(true);
    setSaveStatus("idle");
  };

  const saveDraftObservation = async () => {
    const isSensoryObservationMode = noteKind === "SensoryObservation";
    const isCommunicationObservationMode = noteKind === "CommunicationObservation";
    const isImmediateObservationMode =
      isSensoryObservationMode || isCommunicationObservationMode;
    const recommendation =
      draftObservationRecommendation === "Other"
        ? draftObservationNote.trim()
        : draftObservationRecommendation.trim();
    const nextItem = {
      category: draftObservationCategory.trim(),
      observation: draftObservationText.trim(),
      recommendation,
    };

    if (
      !nextItem.category ||
      !nextItem.observation ||
      (isImmediateObservationMode && !nextItem.recommendation)
    ) {
      if (!nextItem.category) {
        setActiveIndex(0);
      } else if (!nextItem.observation) {
        setActiveIndex(1);
      } else if (isImmediateObservationMode && !nextItem.recommendation) {
        setActiveIndex(2);
      }
      setSaveStatus("error");
      return;
    }

    const nextItems =
      editingObservationIndex === null
        ? [...observationItems, nextItem]
        : observationItems.map((item, index) =>
            index === editingObservationIndex ? nextItem : item
          );

    if (isImmediateObservationMode) {
      const sessionData = {
        kind: isCommunicationObservationMode
          ? ("CommunicationObservation" as const)
          : ("SensoryObservation" as const),
        observations: nextItems,
        overallComment: "",
      };

      setSaveStatus("saving");
      const result = await submitEntry({
        clientId,
        note: observationSessionText(sessionData),
        items: [],
        canSubmitCommentOnly,
        kind: sessionData.kind,
        contextData: sessionData,
      });

      if (!result.ok) {
        setSaveStatus("error");
        return;
      }

      setObservationItems(nextItems);
      setNote(result.noteForSave);
      router.refresh();
      if (result.entryId) {
        onSaved?.(result.entryId, result.visibility, result.status);
      }
      await clearCurrentDraft();
      onSubmitted?.();
      return;
    } else {
      setObservationItems(nextItems);
      setIsAddingObservation(false);
    }

    setEditingObservationIndex(null);
    setDraftObservationCategory("");
    setDraftObservationText("");
    setDraftObservationRecommendation("");
    setDraftObservationNote("");
    setActiveIndex(0);
    setIsAddingObservation(isImmediateObservationMode);
    setSaveStatus("idle");
  };

  const removeObservation = (index: number) => {
    setObservationItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const submitObservationSession = async (event: React.FormEvent) => {
    event.preventDefault();

    if (observationItems.length === 0) {
      setSaveStatus("error");
      return;
    }

    const sessionData = {
      kind:
        noteKind === "CommunicationObservation"
          ? ("CommunicationObservation" as const)
          : noteKind === "SensoryObservation"
            ? ("SensoryObservation" as const)
            : ("SupervisorObservation" as const),
      observations: observationItems,
      overallComment: overallObservationComment.trim(),
    };

    setSaveStatus("saving");
    const result = await submitEntry({
      clientId,
      note: observationSessionText(sessionData),
      items: [],
      canSubmitCommentOnly,
      kind: sessionData.kind,
      contextData: sessionData,
      visibility: isSupervisorVisibilityMode ? visibility : "Shared",
    });

    if (result.ok) {
      setNote(result.noteForSave);
      router.refresh();
      if (result.entryId) {
        onSaved?.(result.entryId, result.visibility, result.status);
      }
      await clearCurrentDraft();
      onSubmitted?.();
    }

    setSaveStatus(result.ok ? "saved" : "error");
  };

  const educatorTargetCompleted = (item: EntryItemDraft) => {
    const profile = normalizeMeasurementProfileForRole(item.measurementProfile, item.target);
    const response = activeResponseProfiles[profile];
    const pending = item.goalId ? educatorResponses[item.goalId] : null;
    return response.field === "score"
      ? (pending?.score ?? item.score).trim().length > 0
      : (pending?.rawValue ?? item.rawValue).trim().length > 0;
  };

  const completedEducatorTargetCount = educatorTargets.filter(educatorTargetCompleted).length;
  const hasAnyCompletedEducatorTarget = completedEducatorTargetCount > 0;

  const openEducatorTarget = (index: number) => {
    setSelectedEducatorTargetIndex(index);
    setEducatorView("target");
    setIsEditingEducatorTarget(false);
    setSaveStatus("idle");
  };

  const returnToEducatorTargetList = async () => {
    setEducatorView("list");
    setIsEditingEducatorTarget(false);
    setSaveStatus("idle");
    await saveCurrentDocumentationDraftNow();
  };

  const targetDraftFromItem = (item: EntryItemDraft) => {
    const matchedTarget = availableEducatorTargets.find(
      (option) => option.value.toLowerCase() === item.target.toLowerCase()
    );

    return {
      target: matchedTarget?.value ?? CUSTOM_OBSERVABLE_SKILL_TARGET,
      customTarget: matchedTarget ? "" : item.target,
      goal: item.goal,
      measurementProfile: normalizeMeasurementProfileForRole(item.measurementProfile, item.target),
    };
  };

  const startEditEducatorTarget = () => {
    if (!selectedEducatorTarget) return;

    setTargetEditDraft(targetDraftFromItem(selectedEducatorTarget));
    setIsEditingEducatorTarget(true);
    setSaveStatus("idle");
  };

  const saveEducatorTargetDetails = async () => {
    const selected = selectedEducatorTarget;
    if (!selected) return;

    const target =
      targetEditDraft.target === CUSTOM_OBSERVABLE_SKILL_TARGET
        ? targetEditDraft.customTarget.trim()
        : targetEditDraft.target.trim();
    const goal = targetEditDraft.goal.trim();

    if (!target || !goal) {
      setSaveStatus("error");
      return;
    }

    const nextResponse = activeResponseProfiles[targetEditDraft.measurementProfile];
    const previousProfile = normalizeMeasurementProfileForRole(
      selected.measurementProfile,
      selected.target
    );
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("goalId", selected.goalId);
    formData.append("target", target);
    formData.append("goal", goal);
    formData.append("measurementProfile", targetEditDraft.measurementProfile);
    setSaveStatus("saving");
    const result = await updateEducatorTarget(formData);

    if (result.ok) {
      delete educatorResponseRef.current[selected.goalId];
      setEducatorResponses((previous) => {
        const next = { ...previous };
        delete next[selected.goalId];
        return next;
      });
      setItems((previous) =>
        previous.map((item) => {
          if (item.goalId !== selected.goalId) {
            return item;
          }

          return {
            ...item,
            target,
            goal,
            metricType: nextResponse.metricType,
            measurementProfile: targetEditDraft.measurementProfile,
            score:
              previousProfile === targetEditDraft.measurementProfile &&
              nextResponse.field === "score"
                ? item.score
                : "",
            rawValue:
              previousProfile === targetEditDraft.measurementProfile &&
              nextResponse.field === "rawValue"
                ? item.rawValue
                : "",
          };
        })
      );
      setIsEditingEducatorTarget(false);
      router.refresh();
    }

    setSaveStatus(result.ok ? "saved" : "error");
  };

  const deleteSelectedEducatorTarget = async () => {
    const selected = selectedEducatorTarget;
    if (!selected) return;

    if (
      !window.confirm(
        "Remove this target from the active list?\n\nHistorical data already recorded for this target will be preserved."
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("goalId", selected.goalId);

    setSaveStatus("saving");
    const result = await removeGoalDefinition(formData);
    if (result.ok) {
      setItems((previous) =>
        previous.filter((item) => item.goalId !== selected.goalId)
      );
      setEducatorResponses((previous) => {
        const next = { ...previous };
        delete next[selected.goalId];
        return next;
      });
      delete educatorResponseRef.current[selected.goalId];
      setIsEditingEducatorTarget(false);
      setEducatorView("list");
      setSelectedEducatorTargetIndex(0);
      router.refresh();
    }

    setSaveStatus(result.ok ? "saved" : "error");
  };

  const updateEducatorTargetResponse = (value: string) => {
    const selected = selectedEducatorTarget;
    if (!selected) return;

    const profile = normalizeMeasurementProfileForRole(
      selected.measurementProfile,
      selected.target
    );
    const response = activeResponseProfiles[profile];
    const nextResponse = {
      score: response.field === "score" ? value : "",
      rawValue: response.field === "rawValue" ? value : "",
      measurementProfile: profile,
    };
    educatorResponseRef.current[selected.goalId] = nextResponse;
    setEducatorResponses((previous) => ({
      ...previous,
      [selected.goalId]: nextResponse,
    }));
    setItems((previous) =>
      previous.map((item) => {
        if (item.goalId !== selected.goalId) {
          return item;
        }

        return {
          ...item,
          metricType: response.metricType,
          measurementProfile: profile,
          score: response.field === "score" ? value : "",
          rawValue: response.field === "rawValue" ? value : "",
        };
      })
    );
  };

  const saveEducatorTargetResponse = () => {
    if (!selectedEducatorTarget) return;

    const pending = educatorResponseRef.current[selectedEducatorTarget.goalId];
    const latestTarget = items.find(
      (item) => item.goalId === selectedEducatorTarget.goalId
    );
    const targetForCompletion =
      latestTarget && pending
        ? {
            ...latestTarget,
            score: pending.score,
            rawValue: pending.rawValue,
            measurementProfile: pending.measurementProfile,
            metricType: activeResponseProfiles[pending.measurementProfile].metricType,
          }
        : latestTarget;
    if (!targetForCompletion || !educatorTargetCompleted(targetForCompletion)) {
      setSaveStatus("error");
      return;
    }

    if (pending) {
      setItems((previous) =>
        previous.map((item) =>
          item.goalId === selectedEducatorTarget.goalId
            ? {
                ...item,
                score: pending.score,
                rawValue: pending.rawValue,
                measurementProfile: pending.measurementProfile,
                metricType: activeResponseProfiles[pending.measurementProfile].metricType,
              }
            : item
        )
      );
    }

    setSaveStatus("idle");
    setEducatorView("observation");
  };

  const updateEducatorTargetObservation = (value: string) => {
    if (!selectedEducatorTarget) return;

    setItems((previous) =>
      previous.map((item) =>
        item.goalId === selectedEducatorTarget.goalId
          ? {
              ...item,
              observation: value,
            }
          : item
      )
    );
  };

  const saveEducatorTargetObservation = async () => {
    if (!selectedEducatorTarget) return;

    const targetItems = items.filter(
      (item) => !item.goalId || educatorTargetCompleted(item)
    );
    setSaveStatus("saving");
    const result = await saveItems(targetItems, false);

    if (result.ok) {
      setNote(result.noteForSave);
      setItems((previous) =>
        previous.map((item) => ({ ...item, isNewDraft: false }))
      );
      router.refresh();
      if (result.entryId) {
        onSaved?.(result.entryId, result.visibility, result.status);
      }
      setEducatorView("list");
    }

    setSaveStatus(result.ok ? "saved" : "error");
  };

  const submitEducatorTarget = async (event: React.FormEvent) => {
    event.preventDefault();
    if (activeIndex !== 2 || targetSaveInFlightRef.current) return;
    const target =
      targetDraft.target === CUSTOM_OBSERVABLE_SKILL_TARGET
        ? targetDraft.customTarget.trim()
        : targetDraft.target.trim();

    if (!target || !targetDraft.goal.trim()) {
      setActiveIndex(!target ? 0 : 1);
      setSaveStatus("error");
      return;
    }
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("target", target);
    formData.append("goal", targetDraft.goal.trim());
    formData.append("measurementProfile", targetDraft.measurementProfile);
    const targetDefinition = availableEducatorTargets.find(
      (option) => option.value === targetDraft.target
    );

    setSaveStatus("saving");
    setTargetSaveError("");
    targetSaveInFlightRef.current = true;
    let result;
    try {
      result = await createEducatorTarget(formData);
    } catch {
      targetSaveInFlightRef.current = false;
      setSaveStatus("error");
      return;
    }
    // Keep the successful submission consumed until this Add Target owner exits.
    if (!result.ok) targetSaveInFlightRef.current = false;
    setSaveStatus(result.ok ? "saved" : "error");
    if (!result.ok && result.reason === "duplicate_target") {
      setTargetSaveError("This target already exists.");
    }

    if (result.ok) {
      if (isTargetProgressProvider && result.goalId) {
        const profile = targetDraft.measurementProfile;
        const response = activeResponseProfiles[profile];
        setItems((previous) => [
          ...previous,
          {
            goalId: result.goalId,
            target,
            goal: targetDraft.goal.trim(),
            score: "",
            metricType: response.metricType,
            domain: targetDefinition?.defaultDomain ?? "Other",
            rawValue: "",
            supportLevel: "",
            observation: "",
            measurementProfile: profile,
          },
        ]);
        setSelectedEducatorTargetIndex(items.length);
        setEducatorView("list");
        setActiveIndex(0);
        setTargetDraft(defaultTargetDraftForRole(role, defaultMeasurementProfile));
        setReturnToProgressAfterTargetSave(true);
      }
      router.refresh();
      await clearCurrentDraft();
      if (!isTargetProgressProvider) {
        onSubmitted?.();
      }
    }
  };

  if (isEducatorAddTargetMode) {
    const targetCardCount = 3;
    const target = targetDraft.target === CUSTOM_OBSERVABLE_SKILL_TARGET
      ? targetDraft.customTarget.trim()
      : targetDraft.target;
    const targetReminder = target || "Selected target";

    return (
      <form
        className={`add-note-form add-target-form ${targetStyles.addTarget}`}
        onSubmit={submitEducatorTarget}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          className="add-note-header-text"
          style={{
            marginBottom: 14,
            opacity: 0.7,
          }}
        >
          <div>{clientName}</div>
          <div>{providerName} — Add Target</div>
          <div>{todayLabel}</div>
        </div>

        <div
          className="paper-surface add-target-card"
          style={{
            padding: "18px 22px 20px",
            maxWidth: noteCardMaxWidth,
            margin: "0 auto",
            height: noteCardHeight,
            boxSizing: "border-box",
            touchAction: "pan-y",
            transform: `translateX(${targetSwipe.dragOffset}px)`,
            transition: targetSwipe.dragOffset === 0 ? "transform 160ms ease-out" : "none",
          }}
          {...targetSwipe.swipeHandlers}
        >
          <div
            className="add-target-navigation"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 28,
              marginBottom: 12,
            }}
          >
            <ChevronControl
              direction="left"
              onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
              disabled={activeIndex === 0}
              aria-label="Previous target"
            />
            <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
              <div style={{ fontWeight: 600 }}>{activeIndex + 1} of {targetCardCount}</div>
            </div>
            <ChevronControl
              direction="right"
              onClick={() =>
                setActiveIndex((current) => Math.min(targetCardCount - 1, current + 1))
              }
              disabled={activeIndex === targetCardCount - 1}
              aria-label="Next target"
            />
          </div>

          <div
            className="add-target-card-content"
            style={{
              display: "grid",
              alignContent: "center",
              gap: 18,
              height: "calc(100% - 58px)",
              padding: "8px 18px 0",
              boxSizing: "border-box",
            }}
          >
            {activeIndex === 0 ? (
              <>
                <div
                  className="add-target-card-title"
                  style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}
                >
                  {targetSelectTitle}
                </div>
                <MaterialSelect
                  ariaLabel={targetSelectTitle}
                  value={targetDraft.target}
                  onValueChange={(value) =>
                    setTargetDraft((current) => {
                      const selected = availableEducatorTargets.find(
                        (option) => option.value === value
                      );
                      return {
                        ...current,
                        target: value,
                        measurementProfile: normalizeMeasurementProfileForRole(
                          selected?.recommendedMeasurementProfile ??
                            educatorDefaultProfileForTarget(value),
                          value
                        ),
                      };
                    })
                  }
                  options={availableEducatorTargets.map((option) => ({
                    value: option.value,
                    label: option.label,
                    group: option.group,
                  }))}
                  style={{
                    width: "100%",
                    minHeight: 44,
                  }}
                />
                {targetDraft.target === CUSTOM_OBSERVABLE_SKILL_TARGET ? (
                  <Input
                    value={targetDraft.customTarget}
                    onChange={(event) =>
                      setTargetDraft((current) => ({
                        ...current,
                        customTarget: event.target.value,
                      }))
                    }
                    placeholder="Target name"
                    style={{ minHeight: 44, padding: "10px 12px", ...fieldInputStyle }}
                  />
                ) : null}
              </>
            ) : null}

            {activeIndex === 1 ? (
              <>
                <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                  Goal
                </div>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 16,
                    fontWeight: 600,
                    opacity: 0.72,
                  }}
                >
                  {targetReminder}
                </div>
                <Textarea
                  value={targetDraft.goal}
                  onChange={(event) =>
                    setTargetDraft((current) => ({
                      ...current,
                      goal: event.target.value,
                    }))
                  }
                  placeholder={targetGoalPlaceholder}
                  style={{
                    minHeight: 122,
                    padding: "12px 14px",
                    resize: "none",
                    ...fieldInputStyle,
                  }}
                />
              </>
            ) : null}

            {activeIndex === 2 ? (
              <>
                <div
                  className="add-target-card-title"
                  style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}
                >
                  How will this be measured?
                </div>
                <div
                  className="add-target-measurement-options"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  {activeMeasurementProfiles.map((profile) => {
                    const selected = targetDraft.measurementProfile === profile.value;

                    return (
                      <Button
                        key={profile.value}
                        type="button"
                        variant="ghost"
                        className="target-option-control clinical-selection-control"
                        aria-pressed={selected}
                        onClick={() =>
                          setTargetDraft((current) => ({
                            ...current,
                            measurementProfile: profile.value,
                          }))
                        }
                        style={{
                          minHeight: 40,
                          padding: "9px 14px",
                          borderRadius: 12,
                          background: selected ? "rgb(0 0 0 / 9%)" : "var(--glass-strong)",
                          boxShadow: selected ? "var(--inset-paper)" : "var(--shadow-soft)",
                        }}
                      >
                        {renderMeasurementHelpLabel(profile)}
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div
          className="add-target-actions"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            minHeight: 44,
          }}
        >
          {activeIndex < targetCardCount - 1 ? (
            <Button
              key="continue-target"
              type="button"
              className="material-control action-positive"
              onClick={() =>
                setActiveIndex((current) => Math.min(targetCardCount - 1, current + 1))
              }
            >
              Continue
            </Button>
          ) : (
            <Button
              key="save-target"
              type="submit"
              className="material-control action-positive"
              disabled={saveStatus === "saving" || !target.trim() || !targetDraft.goal.trim()}
            >
              {saveStatus === "saving" ? "Saving..." : "Save Target"}
            </Button>
          )}
          {saveStatus === "error" ? (
            <span style={{ opacity: 0.72 }}>
              {targetSaveError || "Complete each card before saving."}
            </span>
          ) : null}
        </div>
      </form>
    );
  }

  if (isEducatorSessionMode) {
    const currentTarget = selectedEducatorTarget;
    const currentProfile = currentTarget
      ? normalizeMeasurementProfileForRole(currentTarget.measurementProfile, currentTarget.target)
      : defaultMeasurementProfile;
    const currentResponse = activeResponseProfiles[currentProfile];
    const currentResponsePrompt = isSpeechPathologist || isBehaviorTherapist
      ? "Today's Performance"
      : currentResponse.prompt;
    const currentValue =
      currentTarget && currentResponse.field === "score"
        ? currentTarget.score
        : currentTarget?.rawValue ?? "";
    const targetResponseSummary = (item: EntryItemDraft) => {
      const profile = normalizeMeasurementProfileForRole(
        item.measurementProfile,
        item.target
      );
      const response = activeResponseProfiles[profile];
      const value = response.field === "score" ? item.score : item.rawValue;
      return (
        response.options?.find((option) => option.value === value)?.label ??
        value
      );
    };

    return (
      <form
        className="add-note-form"
        onSubmit={handleFormSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          className="add-note-header-text"
          style={{
            marginBottom: 14,
            opacity: 0.7,
          }}
        >
          <div>{clientName}</div>
          <div>{providerName} — {progressTitle}</div>
          <div>{todayLabel}</div>
        </div>

        <div
          className={`paper-surface ${isEditingEducatorTarget ? targetStyles.editorStage : ""}`}
          style={{
            padding: "24px 28px",
            maxWidth: noteCardMaxWidth,
            margin: "0 auto",
            minHeight: 360,
            boxSizing: "border-box",
            display: "grid",
            alignContent: "center",
            gap: 18,
          }}
        >
          {educatorView === "list" ? (
            <>
              <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                Targets
              </div>
              <div style={{ display: "grid", gap: 10, maxWidth: 520, width: "100%", margin: "0 auto" }}>
                {educatorTargets.length === 0 ? (
                  <div style={{ textAlign: "center", opacity: 0.66 }}>
                    {progressEmptyText}
                  </div>
                ) : null}
                {educatorTargets.map((item, index) => (
                  <button
                    key={item.goalId}
                    type="button"
                    className="target-list-control"
                    onClick={() => openEducatorTarget(index)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      minHeight: 44,
                      border: "1px solid rgb(35 45 55 / 14%)",
                      borderRadius: 12,
                      background: "var(--surface)",
                      boxShadow: "none",
                      padding: "10px 14px",
                      textAlign: "center",
                      cursor: "pointer",
                      color: "var(--foreground)",
                      position: "relative",
                    }}
                  >
                    <span
                      className="target-state-indicator"
                    >
                      {educatorTargetCompleted(item) ? "✓" : ""}
                    </span>
                    <span style={{ display: "grid", gap: 3, minWidth: 0, padding: "0 30px" }}>
                      <span style={{ fontWeight: 600 }}>{item.target}</span>
                      {educatorTargetCompleted(item) ? (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 450,
                            opacity: 0.64,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {[
                            targetResponseSummary(item),
                            item.observation?.trim(),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
              {hasAnyCompletedEducatorTarget ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    type="button"
                    className="material-control action-positive"
                    onClick={() => setEducatorView("reflection")}
                  >
                    Continue to Session Note
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {educatorView === "target" && currentTarget ? (
            <>
              <button
                type="button"
                onClick={returnToEducatorTargetList}
                style={{
                  justifySelf: "start",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  padding: "4px 2px",
                  font: "inherit",
                  fontSize: 14,
                  fontWeight: 560,
                  opacity: 0.7,
                  cursor: "pointer",
                }}
              >
                ← Targets
              </button>
              {isEditingEducatorTarget ? (
                <>
                  <div style={{ display: "grid", gap: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 650 }}>Edit Target</div>
                  </div>

                  <div
                    className={targetStyles.editorFields}
                    style={{
                      display: "grid",
                      gap: 12,
                      maxWidth: 560,
                      width: "100%",
                      margin: "0 auto",
                    }}
                  >
                    <MaterialSelect
                      ariaLabel="Edit target"
                      value={targetEditDraft.target}
                      onValueChange={(value) =>
                        setTargetEditDraft((current) => {
                          const selected = availableEducatorTargets.find(
                            (option) => option.value === value
                          );
                          return {
                            ...current,
                            target: value,
                            measurementProfile: normalizeMeasurementProfileForRole(
                              selected?.recommendedMeasurementProfile ??
                                educatorDefaultProfileForTarget(value),
                              value
                            ),
                          };
                        })
                      }
                      options={availableEducatorTargets.map((option) => ({
                        value: option.value,
                        label: option.label,
                        group: option.group,
                      }))}
                      style={{
                        width: "100%",
                        minHeight: 44,
                      }}
                    />

                    {targetEditDraft.target === CUSTOM_OBSERVABLE_SKILL_TARGET ? (
                      <Input
                        value={targetEditDraft.customTarget}
                        onChange={(event) =>
                          setTargetEditDraft((current) => ({
                            ...current,
                            customTarget: event.target.value,
                          }))
                        }
                        placeholder="Target name"
                        style={{
                          minHeight: 44,
                          padding: "10px 12px",
                          ...fieldInputStyle,
                        }}
                      />
                    ) : null}

                    <Textarea
                      value={targetEditDraft.goal}
                      onChange={(event) =>
                        setTargetEditDraft((current) => ({
                          ...current,
                          goal: event.target.value,
                        }))
                      }
                      placeholder="Describe the goal."
                      style={{
                        minHeight: 92,
                        padding: "12px 14px",
                        resize: "none",
                        ...fieldInputStyle,
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      {activeMeasurementProfiles.map((profile) => {
                        const selected =
                          targetEditDraft.measurementProfile === profile.value;

                        return (
                          <Button
                            key={profile.value}
                            type="button"
                            variant="ghost"
                            className="target-option-control clinical-selection-control"
                            aria-pressed={selected}
                            onClick={() =>
                              setTargetEditDraft((current) => ({
                                ...current,
                                measurementProfile: profile.value,
                              }))
                            }
                            style={{
                              minHeight: 38,
                              padding: "8px 12px",
                              borderRadius: 12,
                              background: selected
                                ? "rgb(0 0 0 / 9%)"
                                : "var(--glass-strong)",
                              boxShadow: selected
                                ? "var(--inset-paper)"
                                : "var(--shadow-soft)",
                            }}
                          >
                            {renderMeasurementHelpLabel(profile)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={targetStyles.editorActions} style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="action-secondary"
                      onClick={() => {
                        setIsEditingEducatorTarget(false);
                        setSaveStatus("idle");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="material-control action-positive"
                      onClick={saveEducatorTargetDetails}
                      disabled={saveStatus === "saving"}
                    >
                      {saveStatus === "saving" ? "Saving..." : "Save Details"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="action-negative"
                      onClick={deleteSelectedEducatorTarget}
                      disabled={saveStatus === "saving"}
                    >
                      Remove Target
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gap: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 17, opacity: 0.72 }}>Target:</div>
                    <div style={{ fontSize: 24, fontWeight: 650 }}>
                      {currentTarget.target}
                    </div>
                    <div style={{ fontSize: 15, opacity: 0.62 }}>
                      {currentTarget.goal}
                    </div>
                    <button
                      type="button"
                      onClick={startEditEducatorTarget}
                      className="target-edit-details-link"
                      style={{
                        justifySelf: "center",
                        border: "none",
                        background: "transparent",
                        padding: "2px 4px",
                        font: "inherit",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Edit target details
                    </button>
                    <div
                      style={{
                        display: "inline-flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontSize: 17,
                        color: "var(--performance-prompt-text, rgb(0 0 0 / 74%))",
                      }}
                    >
                      {renderCurrentResponsePrompt(currentProfile, currentResponsePrompt)}
                    </div>
                  </div>

                  {currentResponse.options ? (
                    <div style={{ display: "grid", gap: 10, maxWidth: 520, width: "100%", margin: "0 auto" }}>
                      {currentResponse.options.map((option) => {
                        const selected = currentValue === option.value;
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant="ghost"
                            className="target-option-control clinical-selection-control"
                            aria-pressed={selected}
                            onClick={() => updateEducatorTargetResponse(option.value)}
                            style={{
                              justifyContent: "flex-start",
                              minHeight: 42,
                              padding: "9px 14px",
                              borderRadius: 12,
                              background: selected ? "rgb(0 0 0 / 9%)" : "var(--glass-strong)",
                              boxShadow: selected ? "var(--inset-paper)" : "var(--shadow-soft)",
                            }}
                          >
                            <span style={{ display: "grid", gap: 2, width: "100%" }}>
                              <span>{option.label}</span>
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      value={currentValue}
                      onChange={(event) => updateEducatorTargetResponse(event.target.value)}
                      placeholder={currentResponse.placeholder}
                      style={{
                        width: 180,
                        justifySelf: "center",
                        minHeight: 44,
                        padding: "10px 12px",
                        ...fieldInputStyle,
                      }}
                    />
                  )}

                  <div
                    style={{
                      display: "grid",
                      justifyItems: "center",
                      gap: 8,
                    }}
                  >
                    <Button
                      type="button"
                      className="material-control action-positive"
                      onClick={saveEducatorTargetResponse}
                      disabled={saveStatus === "saving"}
                    >
                      Continue
                    </Button>
                    <span style={{ fontSize: 13, opacity: 0.62 }}>
                      Next: add an observation
                    </span>
                  </div>
                </>
              )}
              {saveStatus === "error" ? (
                <div style={{ textAlign: "center", opacity: 0.72 }}>
                  {isEditingEducatorTarget
                    ? "Complete the target details before saving."
                    : "Select a response before saving."}
                </div>
              ) : null}
            </>
          ) : null}

          {educatorView === "observation" && currentTarget ? (
            <>
              <button
                type="button"
                onClick={returnToEducatorTargetList}
                style={{
                  justifySelf: "start",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  padding: "4px 2px",
                  font: "inherit",
                  fontSize: 14,
                  fontWeight: 560,
                  opacity: 0.7,
                  cursor: "pointer",
                }}
              >
                ← Targets
              </button>
              <div style={{ display: "grid", gap: 7, textAlign: "center" }}>
                <div style={{ fontSize: 17, opacity: 0.66 }}>
                  {currentTarget.target}
                </div>
                <div style={{ fontSize: 21, fontWeight: 650 }}>
                  {targetResponseSummary(currentTarget)}
                </div>
                <div style={{ fontSize: 24, fontWeight: 650, marginTop: 8 }}>
                  Observation
                </div>
                <div style={{ fontSize: 15, opacity: 0.68 }}>
                  What happened around or after this target?
                </div>
              </div>

              <Textarea
                autoFocus
                value={currentTarget.observation ?? ""}
                onChange={(event) =>
                  updateEducatorTargetObservation(event.target.value)
                }
                placeholder="Example: After the transition support, the client became engaged and used expressive language."
                style={{
                  minHeight: 126,
                  padding: "12px 14px",
                  resize: "none",
                  ...fieldInputStyle,
                }}
              />

              <div
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: 8,
                }}
              >
                <Button
                  type="button"
                  className="material-control action-positive"
                  onClick={saveEducatorTargetObservation}
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saving" ? "Saving..." : "Save Target"}
                </Button>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSaveStatus("idle");
                      setEducatorView("target");
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      padding: 4,
                      font: "inherit",
                      fontSize: 13,
                      opacity: 0.68,
                      cursor: "pointer",
                    }}
                  >
                    Change measurement
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedEducatorTarget}
                    disabled={saveStatus === "saving"}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--remove-target-text, rgb(110 35 35 / 78%))",
                      padding: 4,
                      font: "inherit",
                      fontSize: 13,
                      cursor: saveStatus === "saving" ? "default" : "pointer",
                      opacity: saveStatus === "saving" ? 0.45 : 1,
                    }}
                  >
                    Remove target
                  </button>
                </div>
              </div>
              {saveStatus === "error" ? (
                <div style={{ textAlign: "center", opacity: 0.72 }}>
                  The target could not be saved. Please try again.
                </div>
              ) : null}
            </>
          ) : null}

          {educatorView === "reflection" ? (
            <>
              <div style={{ display: "grid", gap: 8, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 650 }}>
                  Session Note (Optional)
                </div>
                <div style={{ fontSize: 17, opacity: 0.74 }}>
                  Anything from today&apos;s session that would help another provider understand the client?
                </div>
              </div>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Include reinforcers, motivation, engagement, mood, behavior changes, strategies that helped, or anything the care team should know."
                style={{
                  minHeight: 122,
                  padding: "12px 14px",
                  resize: "none",
                  ...fieldInputStyle,
                }}
              />
              <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                <Button
                  type="button"
                  variant="ghost"
                  className="action-secondary"
                  onClick={() => setEducatorView("list")}
                >
                  ← Back
                </Button>
                <Button
                  type="submit"
                  className="material-control action-positive"
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saving" ? "Saving..." : "Save Session Note"}
                </Button>
              </div>
              {saveStatus === "error" ? (
                <div style={{ textAlign: "center", opacity: 0.72 }}>
                  Complete at least one target before submitting.
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </form>
    );
  }

  if (
    noteKind === "SupervisorObservation" ||
    noteKind === "SensoryObservation" ||
    noteKind === "CommunicationObservation"
  ) {
    const observationCardCount = noteKind === "SupervisorObservation" ? 2 : 3;
    const isImmediateObservationMode = noteKind !== "SupervisorObservation";

    return (
      <ObservationEntryForm
        noteKind={noteKind}
        clientName={clientName}
        providerName={providerName}
        todayLabel={todayLabel}
        isAddingObservation={isAddingObservation}
        activeIndex={activeIndex}
        draftCategory={draftObservationCategory}
        draftText={draftObservationText}
        draftRecommendation={draftObservationRecommendation}
        draftRecommendationNote={draftObservationNote}
        editingObservationIndex={editingObservationIndex}
        observationItems={observationItems}
        overallComment={overallObservationComment}
        visibilityControl={supervisorVisibilityControl}
        saveStatus={saveStatus}
        isEditMode={isEditMode}
        onEditorSubmit={(event) => {
          event.preventDefault();
          void saveDraftObservation();
        }}
        onSessionSubmit={submitObservationSession}
        onPrevious={() =>
          setActiveIndex((current) => Math.max(0, current - 1))
        }
        onNext={() =>
          setActiveIndex((current) =>
            Math.min(observationCardCount - 1, current + 1)
          )
        }
        onCategoryChange={(value) => {
          setDraftObservationCategory(value);
          setSaveStatus("idle");
        }}
        onTextChange={(value) => {
          setDraftObservationText(value);
          setSaveStatus("idle");
        }}
        onRecommendationChange={(value) => {
          setDraftObservationRecommendation(value);
          setSaveStatus("idle");
          if (value !== "Other") {
            setDraftObservationNote("");
          }
        }}
        onRecommendationNoteChange={(value) => {
          setDraftObservationNote(value);
          setSaveStatus("idle");
        }}
        onCancelEditor={() => {
          if (isImmediateObservationMode) {
            onCancelToProgress?.();
            return;
          }
          setIsAddingObservation(false);
        }}
        onStartNew={startNewObservation}
        onEdit={startEditObservation}
        onRemove={removeObservation}
        onOverallCommentChange={setOverallObservationComment}
        onDelete={deleteSupervisorDocumentation}
      />
    );
  }

  if (noteKind === "ClinicalNote") {
    return (
      <ClinicalReflectionEntryForm
        clientName={clientName}
        providerName={providerName}
        providerRole={providerRole}
        todayLabel={todayLabel}
        activeIndex={activeIndex}
        cardCount={supervisorCardCount}
        contextValues={contextValues}
        visibilityControl={supervisorVisibilityControl}
        saveStatus={saveStatus}
        isEditMode={isEditMode}
        onPrevious={prevItem}
        onNext={nextItem}
        onContextValueChange={setContextValue}
        onSubmit={handleFormSubmit}
        onDelete={deleteSupervisorDocumentation}
      />
    );
  }

  if (isContextMode) {
    return (
      <CaretakerContextEntryForm
        clientName={clientName}
        providerName={providerName}
        providerRole={providerRole}
        todayLabel={todayLabel}
        activeIndex={activeIndex}
        contextCards={contextCards}
        contextValues={contextValues}
        contextComment={contextComment}
        saveStatus={saveStatus}
        isEditMode={isEditMode}
        onPrevious={prevItem}
        onNext={nextItem}
        onContextValueChange={updateContextValue}
        onContextCommentChange={setContextComment}
        onSubmit={handleFormSubmit}
      />
    );
  }

  const renderMetricValueControl = (item: EntryItemDraft) => {
    const measurement = measurementOptionForItem(item);

    if (item.metricType === MetricType.Percentage) {
      return (
        <>
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            value={item.rawValue}
            onChange={(event) =>
              updateMetricValue(activeIndex, event.target.value, "rawValue")
            }
            style={{
              width: 150,
              padding: "10px 12px",
              ...fieldInputStyle,
            }}
          />
          <span style={{ fontWeight: 600, paddingLeft: 4 }}>%</span>
        </>
      );
    }

    if (item.metricType === MetricType.Duration) {
      return (
        <>
          <Input
            value={formatDurationForEntryInput(item.rawValue)}
            onChange={(event) =>
              updateMetricValue(
                activeIndex,
                normalizeEntryDurationInput(event.target.value),
                "rawValue"
              )
            }
            placeholder="MM:SS"
            style={{
              width: 150,
              padding: "10px 12px",
              ...fieldInputStyle,
            }}
          />
          <span aria-hidden="true" />
        </>
      );
    }

    if (item.metricType === MetricType.Frequency) {
      return (
        <>
          <Input
            type="number"
            min={0}
            value={item.rawValue}
            onChange={(event) =>
              updateMetricValue(activeIndex, event.target.value, "rawValue")
            }
            style={{
              width: 150,
              padding: "10px 12px",
              ...fieldInputStyle,
            }}
          />
          <span aria-hidden="true" />
        </>
      );
    }

    if (item.metricType === MetricType.Subjective) {
      if (measurement.inputKind === "ordinalScale") {
        const min = measurement.recommendedRange.min ?? 1;
        const max = measurement.recommendedRange.max ?? 10;
        const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);

        return (
          <>
            <MaterialSelect
              ariaLabel={measurement.label}
              value={item.score}
              onValueChange={(value) =>
                updateMetricValue(activeIndex, value, "score")
              }
              options={[
                { value: "", label: "Select" },
                ...values.map((value) => ({
                  value: String(value),
                  label: String(measurement.scaleLabels?.[value - min] ?? value),
                })),
              ]}
              style={{
                width: 150,
                minHeight: 42,
              }}
            />
            <span aria-hidden="true" />
          </>
        );
      }

      if (measurement.inputKind === "boolean") {
        return (
          <>
            <MaterialSelect
              ariaLabel={measurement.label}
              value={item.score}
              onValueChange={(value) =>
                updateMetricValue(activeIndex, value, "score")
              }
              options={[
                { value: "", label: "Select" },
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              style={{
                width: 150,
                minHeight: 42,
              }}
            />
            <span aria-hidden="true" />
          </>
        );
      }

      return (
        <>
          <Textarea
            value={item.score}
            onChange={(event) =>
              updateMetricValue(activeIndex, event.target.value, "score")
            }
            style={{
              width: 150,
              height: 48,
              padding: "10px 12px",
              resize: "none",
              ...fieldInputStyle,
            }}
          />
          <span aria-hidden="true" />
        </>
      );
    }

    return <span aria-hidden="true" />;
  };

  return (
    <form
      className="add-note-form"
      onSubmit={handleFormSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          gap: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
      <div
        className="add-note-header-text"
        style={{
          marginBottom: 14,
          opacity: 0.7,
        }}
      >
        <div>{clientName}</div>
        <div>
          {providerName} — {providerRole}
        </div>
        <div>{todayLabel}</div>
      </div>

      <div
        className="paper-surface"
        style={{
          padding: "18px 22px 20px",
          maxWidth: noteCardMaxWidth,
          margin: "0 auto",
          height: noteCardHeight,
          boxSizing: "border-box",
          touchAction: "pan-y",
          transform: `translateX(${itemSwipe.dragOffset}px)`,
          transition: itemSwipe.dragOffset === 0 ? "transform 160ms ease-out" : "none",
        }}
        {...itemSwipe.swipeHandlers}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 28,
            marginBottom: 12,
          }}
        >
          <ChevronControl
            direction="left"
            onClick={prevItem}
            disabled={!hasItems || activeIndex === 0}
            aria-label="Previous item"
          />
          <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
            <div style={{ fontWeight: 600 }}>
              {hasItems ? `${activeIndex + 1} of ${items.length}` : "No items yet"}
            </div>
          </div>
          <ChevronControl
            direction="right"
            onClick={nextItem}
            disabled={!hasItems || activeIndex === items.length - 1}
            aria-label="Next item"
          />
        </div>

        {activeItem ? (
          <div
            style={{
              display: "grid",
              gridTemplateRows: "112px auto",
              alignContent: "start",
              gap: 12,
              height: "100%",
              paddingTop: 8,
              boxSizing: "border-box",
            }}
          >
            <div
              className="noteRow"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 260px minmax(0, 1fr)",
                alignItems: "center",
                justifyContent: "center",
                columnGap: 28,
                minHeight: 112,
                width: "100%",
              }}
            >
              <div
                className="noteLeft"
                style={{
                  width: 360,
                  minWidth: 0,
                  justifySelf: "center",
                  gridColumn: 1,
                  paddingInline: 24,
                  boxSizing: "border-box",
                }}
              >
                {activeItemUsesCreationUI ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <Label
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px minmax(0, 1fr)",
                        alignItems: "center",
                        columnGap: 12,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>Target</span>
                      <>
                        <Input
                          value={activeItem.target}
                          list={targetOptions.length > 0 ? targetListId : undefined}
                          onChange={(event) =>
                            updateTargetValue(activeIndex, event.target.value)
                          }
                          placeholder={
                            targetOptions.length > 0 ? "Select target" : "i.e. compliance"
                          }
                          style={{ width: "100%", padding: "10px 12px", ...fieldInputStyle }}
                        />
                        {targetOptions.length > 0 ? (
                          <datalist id={targetListId}>
                            {targetOptions.map((option) => (
                              <option
                                key={option.value}
                                value={option.label}
                                label={option.description}
                              />
                            ))}
                          </datalist>
                        ) : null}
                      </>
                    </Label>

                    <Label
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px minmax(0, 1fr)",
                        alignItems: "center",
                        columnGap: 12,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>Goal</span>
                      <Input
                        value={activeItem.goal}
                        onChange={(event) =>
                          updateItem(activeIndex, (item) => ({
                            ...item,
                            goalId: "",
                            goal: event.target.value,
                          }))
                        }
                        placeholder="Describe the goal"
                        style={{ width: "100%", padding: "10px 12px", ...fieldInputStyle }}
                      />
                    </Label>
                  </div>
                ) : (
                  <div
                    style={{
                      width: 260,
                      display: "grid",
                      gridTemplateRows: "32px 56px",
                      alignContent: "center",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeItem.target}
                    </p>
                    <p
                      style={{
                        margin: "6px 0 0",
                        opacity:
                          activeItem.metricType === MetricType.Frequency || activeItem.goal
                            ? 0.72
                            : 0,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {activeItem.goal || "Goal placeholder"}
                    </p>
                  </div>
                )}
              </div>

              <div
                style={{
                  width: activeItemUsesCreationUI ? 260 : 160,
                  justifySelf: "center",
                  gridColumn: 2,
                }}
              >
                {activeItemUsesCreationUI ? (
                  <Label
                    style={{
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 500,
                        fontSize: 13,
                      }}
                    >
                      {renderMeasurementHelpForOption(
                        measurementOptionByValue.get(
                          activeItem.measurementType ??
                            measurementOptionForMetric(activeItem.metricType).value
                        ) ?? measurementOptionForMetric(activeItem.metricType)
                      )}
                    </span>
                    <MaterialSelect
                      ariaLabel="Measurement type"
                      value={
                        activeItem.measurementType ??
                        measurementOptionForMetric(activeItem.metricType).value
                      }
                      onValueChange={(value) =>
                        updateMeasurementType(activeIndex, value)
                      }
                      options={measurementOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      style={{
                        width: "100%",
                        minHeight: 42,
                        color: "var(--foreground)",
                        fontWeight: 600,
                      }}
                    />
                  </Label>
                ) : (
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      opacity: 0.82,
                      textAlign: "center",
                    }}
                  >
                    {renderMeasurementHelpForOption(measurementOptionForItem(activeItem))}
                  </div>
                )}
              </div>

              <div
                className="noteRight"
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 32px",
                  alignItems: "center",
                  justifyContent: "center",
                  columnGap: 8,
                  width: 260,
                  minHeight: 56,
                  justifySelf: "center",
                  gridColumn: 3,
                }}
              >
                {renderMetricValueControl(activeItem)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 260px minmax(0, 1fr)",
                alignItems: "center",
                width: "100%",
                padding: "0 0 0 22px",
                boxSizing: "border-box",
              }}
            >
            <div
              style={{
                justifySelf: "start",
                transform: "translateX(-8px)",
              }}
            >
              {plusButton}
            </div>             
             <Button
                type="button"
                variant="outline"
                className="action-negative"
                onClick={removeActiveItem}
                disabled={!hasItems}
                style={{
                  justifySelf: "center",
                  transform: "translateX(-11px)",
                  minHeight: 38,
                  fontSize: 14,
                  padding: "8px 14px",
                }}
              >
                Remove Item
              </Button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "38px 26px",
              textAlign: "center",
              opacity: 0.7,
            }}
          >
            Add an assessment item to start the session note.
          </div>
        )}
      </div>
        </div>
      </div>

      <div
        style={{
          paddingTop: 36,
          width: "100%",
          margin: 0,
        }}
      >
        <div
          style={{
            width: "76%",
            maxWidth: commentMaxWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Label style={{ display: "contents" }}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Comment..."
              style={{
                width: "100%",
                minHeight: isCreationMode ? 104 : 96,
                marginBottom: 14,
                padding: "10px 12px",
                resize: "vertical",
                ...fieldInputStyle,
              }}
            />
          </Label>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Button
              type="submit"
              className="action-positive"
              disabled={saveStatus === "saving"}
              style={{ minHeight: 42, minWidth: 132, padding: "10px 18px" }}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                  ? "Saved"
                  : isEditMode
                    ? "Save Changes"
                    : "Save Details"}
            </Button>
          </div>
        </div>
        {saveStatus === "error" ? (
          <div
            style={{
              marginTop: 10,
              textAlign: "center",
              color: "rgb(0 0 0 / 72%)",
            }}
          >
            {canSubmitCommentOnly
              ? "Add a comment or complete at least one assessment item before saving."
              : "Complete at least one assessment item before saving."}
          </div>
        ) : null}
      </div>
    </form>
  );
}
