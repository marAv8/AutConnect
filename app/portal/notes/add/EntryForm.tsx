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
  getProfessionTemplate,
  type ProfessionMeasurementOption,
} from "@/app/libs/professionTemplates";
import { getClinicalHelpContent } from "@/app/libs/clinicalHelp";
import { ContextualHelp } from "@/components/ContextualHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyItem,
  formatDurationForEntryInput,
  isCompleteMetricInput,
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
  communicationObservationCategoryOptions,
  communicationRecommendationOptions,
  educatorFallbackTargetOptions,
  educatorMeasurementProfiles,
  educatorResponseProfiles,
  fallbackMeasurementOptions,
  observationCategoryOptions,
  otFallbackTargetOptions,
  otMeasurementProfiles,
  otResponseProfiles,
  sensoryObservationCategoryOptions,
  sensoryRecommendationOptions,
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
} from "./entryFormDraftModel";
import {
  CaretakerContextEntryForm,
  ClinicalReflectionEntryForm,
} from "./EntrySpecializedForms";

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
  onCancel?: () => void;
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
  onCancel,
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

  const [note, setNote] = useState(restoredDraft?.note ?? initialValues?.note ?? "");
  const [items, setItems] = useState<EntryItemDraft[]>(
    restoredDraft?.items ?? initialValues?.items ?? [createEmptyItem()]
  );
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
  const [activeIndex, setActiveIndex] = useState(restoredDraft?.activeIndex ?? 0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [visibility, setVisibility] = useState<"Private" | "Shared">(
    restoredDraft?.visibility ?? initialValues?.visibility ?? "Private"
  );
  const [educatorView, setEducatorView] = useState<"list" | "target" | "reflection">(
    restoredDraft?.educatorView ?? "list"
  );
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
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const newDraftReturnIndexRef = useRef<number | null>(null);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const lastDraftPayloadRef = useRef("");
  const didHydrateDraftRef = useRef(false);
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

  const cancelAutoAdvance = () => {
    if (autoAdvanceTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = null;
  };

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

  const closeTargetProgressDraft = async () => {
    setSaveStatus("saving");
    const didSaveDraft = await saveCurrentDocumentationDraftNow();
    if (!didSaveDraft) {
      setSaveStatus("error");
      return;
    }

    setSaveStatus("idle");
    if (onCancel) {
      onCancel();
      return;
    }

    router.push(`/dashboard?clientId=${clientId}&view=orbit`);
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
      if (autoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
      }
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
  const supervisorCardCount = noteKind === "SupervisorObservation" ? 2 : 2;
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
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {(["Private", "Shared"] as const).map((option) => {
        const selected = visibility === option;
        return (
          <Button
            key={option}
            type="button"
            variant="ghost"
            disabled={saveStatus === "saving"}
            onClick={() => void requestVisibilityChange(option)}
            style={{
              minHeight: 40,
              padding: "9px 14px",
              borderRadius: 12,
              background: selected ? "rgb(0 0 0 / 9%)" : "var(--glass-strong)",
              boxShadow: selected ? "var(--inset-paper)" : "var(--shadow-soft)",
            }}
          >
            {option === "Private" ? "🔒 Private" : "🌐 Share with Team"}
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
        }));
        const hasOther = mappedTargets.some((option) => option.value === "Other");
        return hasOther ? mappedTargets : [...mappedTargets, { value: "Other", label: "Other" }];
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
    cancelAutoAdvance();
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

    cancelAutoAdvance();
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

    cancelAutoAdvance();
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? count - 1 : currentIndex - 1
    );
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

    cancelAutoAdvance();
    setActiveIndex((currentIndex) =>
      currentIndex === count - 1 ? 0 : currentIndex + 1
    );
  };

  const scheduleAutoAdvance = (
    index: number,
    metricType: MetricType | "",
    value: string
  ) => {
    cancelAutoAdvance();

    if (index >= items.length - 1 || !isCompleteMetricInput(metricType, value)) {
      return;
    }

    autoAdvanceTimeoutRef.current = window.setTimeout(() => {
      setActiveIndex((currentIndex) => (currentIndex === index ? index + 1 : currentIndex));
      autoAdvanceTimeoutRef.current = null;
    }, 700);
  };

  const updateMetricValue = (
    index: number,
    value: string,
    field: "rawValue" | "score" = "rawValue",
    shouldAutoAdvance = true
  ) => {
    const metricType = items[index]?.metricType ?? "";
    updateItem(index, (item) => ({
      ...item,
      [field]: value,
    }));

    if (!shouldAutoAdvance) {
      cancelAutoAdvance();
      return;
    }

    scheduleAutoAdvance(index, metricType, value);
  };

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

  const shouldAutoAdvanceAfterInput = (
    event: React.ChangeEvent<HTMLInputElement>,
    previousValue: string
  ) => {
    const inputType = (event.nativeEvent as InputEvent).inputType;
    if (inputType?.startsWith("delete")) {
      return false;
    }

    return event.target.value.length >= previousValue.length;
  };

  const saveItems = async (
    draftItems: EntryItemDraft[],
    redirectOnSuccess = false
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
      ? buildContextData(contextKind, contextCards, contextValues, contextComment)
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
    setContextValues((previous) => ({
      ...previous,
      [key]: previous[key] === value ? "" : value,
    }));
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

  const targetDraftFromItem = (item: EntryItemDraft) => {
    const matchedTarget = availableEducatorTargets.find(
      (option) => option.value.toLowerCase() === item.target.toLowerCase()
    );

    return {
      target: matchedTarget?.value ?? "Other",
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
      targetEditDraft.target === "Other"
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
        "Delete this target?\n\nThis removes it from the active target list."
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
    setEducatorView("list");
  };

  const submitEducatorTarget = async (event: React.FormEvent) => {
    event.preventDefault();
    const target =
      targetDraft.target === "Other"
        ? targetDraft.customTarget.trim()
        : targetDraft.target.trim();

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("target", target);
    formData.append("goal", targetDraft.goal.trim());
    formData.append("measurementProfile", targetDraft.measurementProfile);

    setSaveStatus("saving");
    setTargetSaveError("");
    const result = await createEducatorTarget(formData);
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
            domain: isSpeechPathologist
              ? "Communication"
              : isOccupationalTherapist
                ? "Adaptive"
                : isBehaviorTherapist
                  ? "Behavior"
                  : "SkillAcquisition",
            rawValue: "",
            supportLevel: "",
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
    const target = targetDraft.target === "Other" ? targetDraft.customTarget.trim() : targetDraft.target;
    const targetReminder = target || "Selected target";

    return (
      <form
        className="add-note-form"
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
          <div>{providerName} -- Add Target</div>
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
          }}
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
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setActiveIndex((current) =>
                  current === 0 ? targetCardCount - 1 : current - 1
                )
              }
            >
              ‹
            </Button>
            <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
              <div style={{ fontWeight: 600 }}>{activeIndex + 1} of {targetCardCount}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setActiveIndex((current) =>
                  current === targetCardCount - 1 ? 0 : current + 1
                )
              }
            >
              ›
            </Button>
          </div>

          <div
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
                <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                  {targetSelectTitle}
                </div>
                <select
                  value={targetDraft.target}
                  onChange={(event) =>
                    setTargetDraft((current) => ({
                      ...current,
                      target: event.target.value,
                      measurementProfile: normalizeMeasurementProfileForRole(
                        educatorDefaultProfileForTarget(event.target.value),
                        event.target.value
                      ),
                    }))
                  }
                  style={{
                    minHeight: 44,
                    padding: "10px 12px",
                    background: "transparent",
                    ...fieldInputStyle,
                  }}
                >
                  {availableEducatorTargets.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {targetDraft.target === "Other" ? (
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
                <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                  How will this be measured?
                </div>
                <div
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
          <div>{providerName} -- {progressTitle}</div>
          <div>{todayLabel}</div>
        </div>

        <div
          className="paper-surface"
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
                    onClick={() => openEducatorTarget(index)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 44,
                      border: "none",
                      borderRadius: 12,
                      background: "var(--glass-strong)",
                      boxShadow: "var(--shadow-soft), var(--inset-paper)",
                      padding: "10px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--foreground)",
                    }}
                  >
                    <span style={{ width: 20, fontWeight: 700 }}>
                      {educatorTargetCompleted(item) ? "✓" : "□"}
                    </span>
                    <span style={{ fontWeight: 600 }}>{item.target}</span>
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
                    variant="ghost"
                    disabled={saveStatus === "saving"}
                    onClick={closeTargetProgressDraft}
                  >
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    className="material-control action-positive"
                    onClick={() => setEducatorView("reflection")}
                  >
                    + Add Session Note
                  </Button>
                  <Button
                    type="submit"
                    className="material-control action-positive"
                    disabled={saveStatus === "saving"}
                  >
                    {saveStatus === "saving" ? "Saving..." : "Save Targets"}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {educatorView === "target" && currentTarget ? (
            <>
              {isEditingEducatorTarget ? (
                <>
                  <div style={{ display: "grid", gap: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 650 }}>Edit Target</div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      maxWidth: 560,
                      width: "100%",
                      margin: "0 auto",
                    }}
                  >
                    <select
                      value={targetEditDraft.target}
                      onChange={(event) =>
                        setTargetEditDraft((current) => ({
                          ...current,
                            target: event.target.value,
                            measurementProfile: normalizeMeasurementProfileForRole(
                              educatorDefaultProfileForTarget(event.target.value),
                              event.target.value
                            ),
                        }))
                      }
                      style={{
                        minHeight: 44,
                        padding: "10px 12px",
                        background: "transparent",
                        ...fieldInputStyle,
                      }}
                    >
                      {availableEducatorTargets.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {targetEditDraft.target === "Other" ? (
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

                  <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                    <Button
                      type="button"
                      variant="ghost"
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
                      Delete Target
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
                    <div
                      style={{
                        display: "inline-flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontSize: 17,
                        color: "rgb(0 0 0 / 74%)",
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
                            <span style={{ marginRight: 10 }}>{selected ? "●" : "○"}</span>
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

                  <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                    <Button type="button" variant="ghost" onClick={() => setEducatorView("list")}>
                      Back
                    </Button>
                    <Button type="button" variant="ghost" onClick={startEditEducatorTarget}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      className="material-control action-positive"
                      onClick={saveEducatorTargetResponse}
                    >
                      Save Target
                    </Button>
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
                <Button type="button" variant="ghost" onClick={() => setEducatorView("list")}>
                  ← Back
                </Button>
                <Button
                  type="submit"
                  className="material-control action-positive"
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saving" ? "Saving..." : "Save Targets"}
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
    const isSensoryObservationMode = noteKind === "SensoryObservation";
    const isCommunicationObservationMode = noteKind === "CommunicationObservation";
    const isImmediateObservationMode =
      isSensoryObservationMode || isCommunicationObservationMode;
    const observationCardCount = isImmediateObservationMode ? 3 : 2;
    const activeObservationCategories = isSensoryObservationMode
      ? sensoryObservationCategoryOptions
      : isCommunicationObservationMode
        ? communicationObservationCategoryOptions
      : observationCategoryOptions;
    const activeRecommendationOptions = isCommunicationObservationMode
      ? communicationRecommendationOptions
      : sensoryRecommendationOptions;
    const observationTitle = isSensoryObservationMode
      ? "Sensory Observation"
      : isCommunicationObservationMode
        ? "Communication Observation"
      : "Observation Session";

    return (
      <form
        className="add-note-form"
        onSubmit={isAddingObservation ? (event) => {
          event.preventDefault();
          saveDraftObservation();
        } : submitObservationSession}
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
          <div>
            {providerName} -- {observationTitle}
          </div>
          <div>{todayLabel}</div>
        </div>

        {isAddingObservation ? (
          <>
            <div
              className="paper-surface"
              style={{
                padding: "18px 22px 20px",
                maxWidth: noteCardMaxWidth,
                margin: "0 auto",
                height: noteCardHeight,
                boxSizing: "border-box",
              }}
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === 0 ? observationCardCount - 1 : current - 1
                    )
                  }
                >
                  ‹
                </Button>
                <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
                  <div style={{ fontWeight: 600 }}>{activeIndex + 1} of {observationCardCount}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === observationCardCount - 1 ? 0 : current + 1
                    )
                  }
                >
                  ›
                </Button>
              </div>

              <div
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
                    <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                      Observations
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      {activeObservationCategories.map((option) => {
                        const selected = draftObservationCategory === option;

                        return (
                          <Button
                            key={option}
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setDraftObservationCategory(option);
                              setSaveStatus("idle");
                              if (isImmediateObservationMode) {
                                setActiveIndex(1);
                              }
                            }}
                            style={{
                              minHeight: 40,
                              padding: "9px 14px",
                              borderRadius: 12,
                              background: selected ? "rgb(0 0 0 / 9%)" : "var(--glass-strong)",
                              boxShadow: selected ? "var(--inset-paper)" : "var(--shadow-soft)",
                            }}
                          >
                            {option}
                          </Button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {activeIndex === 1 ? (
                  <>
                    <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                      Observation
                    </div>
                    <Textarea
                      value={draftObservationText}
                      onChange={(event) => {
                        setDraftObservationText(event.target.value);
                        setSaveStatus("idle");
                      }}
                      placeholder={
                        isSensoryObservationMode
                          ? "Describe today's observation."
                          : isCommunicationObservationMode
                            ? "Describe today's communication observation."
                          : "Describe what you directly observed."
                      }
                      style={{
                        minHeight: 122,
                        padding: "12px 14px",
                        resize: "none",
                        ...fieldInputStyle,
                      }}
                    />
                  </>
                ) : null}

                {isImmediateObservationMode && activeIndex === 2 ? (
                  <>
                    <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                      Recommendation
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      {activeRecommendationOptions.map((option) => {
                        const selected = draftObservationRecommendation === option;

                        return (
                          <Button
                            key={option}
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setDraftObservationRecommendation(option);
                              setSaveStatus("idle");
                              if (option !== "Other") {
                                setDraftObservationNote("");
                              }
                            }}
                            style={{
                              minHeight: 40,
                              padding: "9px 14px",
                              borderRadius: 12,
                              background: selected ? "rgb(0 0 0 / 9%)" : "var(--glass-strong)",
                              boxShadow: selected ? "var(--inset-paper)" : "var(--shadow-soft)",
                            }}
                          >
                            {option}
                          </Button>
                        );
                      })}
                    </div>
                    {draftObservationRecommendation === "Other" ? (
                      <Input
                        value={draftObservationNote}
                        onChange={(event) => {
                          setDraftObservationNote(event.target.value);
                          setSaveStatus("idle");
                        }}
                        placeholder="Recommendation"
                        style={{ minHeight: 44, padding: "10px 12px", ...fieldInputStyle }}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 14,
                minHeight: 44,
              }}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (isImmediateObservationMode) {
                    onCancelToProgress?.();
                    return;
                  }

                  setIsAddingObservation(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="material-control action-positive"
                disabled={saveStatus === "saving"}
              >
                {editingObservationIndex === null ? "Add Observation" : "Update Observation"}
              </Button>
              {saveStatus === "error" ? (
                <span style={{ opacity: 0.72 }}>Complete the required cards before saving.</span>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div
              className="paper-surface"
              style={{
                padding: 28,
                maxWidth: noteCardMaxWidth,
                margin: "0 auto",
                minHeight: 360,
                boxSizing: "border-box",
                display: "grid",
                gap: 18,
              }}
            >
              <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                {observationTitle}
              </div>
              {supervisorVisibilityControl}

              <Button
                type="button"
                onClick={startNewObservation}
                className="material-control"
                style={{ justifySelf: "start" }}
              >
                + Add Observation
              </Button>

              <div style={{ display: "grid", gap: 14 }}>
                {observationItems.length === 0 ? (
                  <div style={{ textAlign: "center", opacity: 0.62 }}>
                    No observations added yet.
                  </div>
                ) : null}

                {observationItems.map((item, index) => (
                  <div
                    key={`${item.category}-${index}`}
                    style={{
                      borderTop: "1px solid rgb(255 255 255 / 78%)",
                      paddingTop: 14,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 650 }}>{item.category}</div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                      {item.observation}
                    </div>
                    {item.recommendation ? (
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, opacity: 0.78 }}>
                        Recommendation: {item.recommendation}
                      </div>
                    ) : null}
                    {item.note ? (
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, opacity: 0.78 }}>
                        Note: {item.note}
                      </div>
                    ) : null}
                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => startEditObservation(index)}
                        className="back-link"
                        style={{ border: "none", background: "transparent", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeObservation(index)}
                        className="back-link"
                        style={{ border: "none", background: "transparent", padding: 0 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Textarea
                value={overallObservationComment}
                onChange={(event) => setOverallObservationComment(event.target.value)}
                placeholder="Overall Comment (optional)"
                style={{
                  minHeight: 90,
                  padding: "12px 14px",
                  resize: "vertical",
                  ...fieldInputStyle,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 14,
                minHeight: 44,
              }}
            >
              <Button
                type="submit"
                className="material-control action-positive"
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : isEditMode
                    ? `Update ${observationTitle}`
                    : noteKind === "SupervisorObservation"
                      ? "Save Observation"
                      : `Save ${observationTitle}`}
              </Button>
              {isEditMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={deleteSupervisorDocumentation}
                  disabled={saveStatus === "saving"}
                >
                  Delete
                </Button>
              ) : null}
              {saveStatus === "error" ? (
                <span style={{ opacity: 0.72 }}>Add at least one observation.</span>
              ) : null}
            </div>
          </>
        )}
      </form>
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
              updateMetricValue(
                activeIndex,
                event.target.value,
                "rawValue",
                shouldAutoAdvanceAfterInput(event, item.rawValue)
              )
            }
            onBlur={(event) =>
              scheduleAutoAdvance(activeIndex, item.metricType, event.target.value)
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
                "rawValue",
                shouldAutoAdvanceAfterInput(event, item.rawValue)
              )
            }
            onBlur={(event) =>
              scheduleAutoAdvance(
                activeIndex,
                item.metricType,
                normalizeEntryDurationInput(event.target.value)
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
              updateMetricValue(
                activeIndex,
                event.target.value,
                "rawValue",
                shouldAutoAdvanceAfterInput(event, item.rawValue)
              )
            }
            onBlur={(event) =>
              scheduleAutoAdvance(activeIndex, item.metricType, event.target.value)
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
            <select
              value={item.score}
              onChange={(event) =>
                updateMetricValue(activeIndex, event.target.value, "score", false)
              }
              onBlur={(event) =>
                scheduleAutoAdvance(activeIndex, item.metricType, event.target.value)
              }
              style={{
                width: 150,
                minHeight: 42,
                padding: "10px 12px",
                background: "transparent",
                ...fieldInputStyle,
              }}
            >
              <option value="">Select</option>
              {values.map((value) => (
                <option key={value} value={value}>
                  {measurement.scaleLabels?.[value - min] ?? value}
                </option>
              ))}
            </select>
            <span aria-hidden="true" />
          </>
        );
      }

      if (measurement.inputKind === "boolean") {
        return (
          <>
            <select
              value={item.score}
              onChange={(event) =>
                updateMetricValue(activeIndex, event.target.value, "score", false)
              }
              onBlur={(event) =>
                scheduleAutoAdvance(activeIndex, item.metricType, event.target.value)
              }
              style={{
                width: 150,
                minHeight: 42,
                padding: "10px 12px",
                background: "transparent",
                ...fieldInputStyle,
              }}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <span aria-hidden="true" />
          </>
        );
      }

      return (
        <>
          <Textarea
            value={item.score}
            onChange={(event) =>
              updateMetricValue(activeIndex, event.target.value, "score", false)
            }
            onBlur={(event) =>
              scheduleAutoAdvance(activeIndex, item.metricType, event.target.value)
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
          {providerName} -- {providerRole}
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
        }}
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
          <Button
            type="button"
            variant="ghost"
            onClick={prevItem}
            disabled={!hasItems}
          >
            ‹
          </Button>
          <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
            <div style={{ fontWeight: 600 }}>
              {hasItems ? `${activeIndex + 1} of ${items.length}` : "No items yet"}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={nextItem}
            disabled={!hasItems}
          >
            ›
          </Button>
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
                    <select
                      value={
                        activeItem.measurementType ??
                        measurementOptionForMetric(activeItem.metricType).value
                      }
                      onChange={(event) =>
                        updateMeasurementType(activeIndex, event.target.value)
                      }
                      style={{
                        width: "100%",
                        minHeight: 42,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "var(--glass)",
                        color: "var(--foreground)",
                        fontWeight: 600,
                        ...fieldInputStyle,
                      }}
                    >
                      {measurementOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
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
