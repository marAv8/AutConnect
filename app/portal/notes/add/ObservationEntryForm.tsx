"use client";

/**
 * Shared observation editor shown in the dashboard note overlay.
 * Speech uses it for communication observations, OT for sensory observations,
 * and supervisors for observation sessions. EntryForm owns all persistence.
 */

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronControl } from "@/components/ui/ChevronControl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useGuardedSwipe } from "@/components/useGuardedSwipe";
import {
  communicationObservationCategoryOptions,
  communicationRecommendationOptions,
  observationCategoryOptions,
  sensoryObservationCategoryOptions,
  sensoryRecommendationOptions,
} from "./entryFormConfig";
import type { ObservationItemDraft } from "./entryFormClinicalModel";
import type { EntryFormSaveStatus } from "./EntrySpecializedForms";
import styles from "./ObservationEntryForm.module.css";

type ObservationNoteKind =
  | "SupervisorObservation"
  | "SensoryObservation"
  | "CommunicationObservation";

type Props = {
  noteKind: ObservationNoteKind;
  clientName: string;
  providerName: string;
  todayLabel: string;
  isAddingObservation: boolean;
  activeIndex: number;
  draftCategory: string;
  draftText: string;
  draftRecommendation: string;
  draftRecommendationNote: string;
  editingObservationIndex: number | null;
  observationItems: ObservationItemDraft[];
  overallComment: string;
  visibilityControl: ReactNode;
  saveStatus: EntryFormSaveStatus;
  isEditMode: boolean;
  onEditorSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSessionSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onPrevious: () => void;
  onNext: () => void;
  onCategoryChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onRecommendationChange: (value: string) => void;
  onRecommendationNoteChange: (value: string) => void;
  onCancelEditor: () => void;
  onStartNew: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onOverallCommentChange: (value: string) => void;
  onDelete: () => void | Promise<void>;
};

const fieldInputStyle = {
  border: "none",
  boxSizing: "border-box" as const,
};

export function ObservationEntryForm({
  noteKind,
  clientName,
  providerName,
  todayLabel,
  isAddingObservation,
  activeIndex,
  draftCategory,
  draftText,
  draftRecommendation,
  draftRecommendationNote,
  editingObservationIndex,
  observationItems,
  overallComment,
  visibilityControl,
  saveStatus,
  isEditMode,
  onEditorSubmit,
  onSessionSubmit,
  onPrevious,
  onNext,
  onCategoryChange,
  onTextChange,
  onRecommendationChange,
  onRecommendationNoteChange,
  onCancelEditor,
  onStartNew,
  onEdit,
  onRemove,
  onOverallCommentChange,
  onDelete,
}: Props) {
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
      : "Observation";
  const observationHeaderTitle =
    noteKind === "SupervisorObservation"
      ? "Observation Session"
      : observationTitle;
  const observationSwipe = useGuardedSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrevious,
    canSwipeLeft: activeIndex < observationCardCount - 1,
    canSwipeRight: activeIndex > 0,
    disabled: !isAddingObservation,
  });

  return (
    <form
      className="add-note-form"
      onSubmit={isAddingObservation ? onEditorSubmit : onSessionSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div className="add-note-header-text" style={{ marginBottom: 14, opacity: 0.7 }}>
        <div>{clientName}</div>
        <div>
          {providerName} — {observationHeaderTitle}
        </div>
        <div>{todayLabel}</div>
      </div>

      {isAddingObservation ? (
        <>
          <div
            className={`paper-surface ${styles.editorCard}`}
            style={{
              touchAction: "pan-y",
              transform: `translateX(${observationSwipe.dragOffset}px)`,
              transition: observationSwipe.dragOffset === 0 ? "transform 160ms ease-out" : "none",
            }}
            {...observationSwipe.swipeHandlers}
          >
            <div
              className={styles.pager}
            >
              <ChevronControl
                direction="left"
                className={styles.pagerButton}
                onClick={onPrevious}
                disabled={activeIndex === 0}
                aria-label="Previous observation step"
              />
              <div className={styles.pagerCount}>
                {activeIndex + 1} of {observationCardCount}
              </div>
              <ChevronControl
                direction="right"
                className={styles.pagerButton}
                onClick={onNext}
                disabled={activeIndex === observationCardCount - 1}
                aria-label="Next observation step"
              />
            </div>

            <div className={styles.editorContent}>
              {activeIndex === 0 ? (
                <>
                  <div className={styles.cardTitle}>
                    Observations
                  </div>
                  <div className={styles.optionGrid}>
                    {activeObservationCategories.map((option) => {
                      const selected = draftCategory === option;

                      return (
                        <Button
                          key={option}
                          type="button"
                          variant="ghost"
                          className={`${styles.optionButton} clinical-selection-control`}
                          aria-pressed={selected}
                          onClick={() => onCategoryChange(option)}
                          style={{
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
                  <div className={styles.cardTitle}>
                    Observation
                  </div>
                  <Textarea
                    value={draftText}
                    onChange={(event) => onTextChange(event.target.value)}
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
                  <div className={styles.cardTitle}>
                    Recommendation
                  </div>
                  <div className={styles.optionGrid}>
                    {activeRecommendationOptions.map((option) => {
                      const selected = draftRecommendation === option;

                      return (
                        <Button
                          key={option}
                          type="button"
                          variant="ghost"
                          className={`${styles.optionButton} clinical-selection-control`}
                          aria-pressed={selected}
                          onClick={() => onRecommendationChange(option)}
                          style={{
                            background: selected ? "rgb(0 0 0 / 9%)" : "var(--glass-strong)",
                            boxShadow: selected ? "var(--inset-paper)" : "var(--shadow-soft)",
                          }}
                        >
                          {option}
                        </Button>
                      );
                    })}
                  </div>
                  {draftRecommendation === "Other" ? (
                    <Input
                      value={draftRecommendationNote}
                      onChange={(event) => onRecommendationNoteChange(event.target.value)}
                      placeholder="Recommendation"
                      style={{ minHeight: 44, padding: "10px 12px", ...fieldInputStyle }}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div
            className={styles.editorActions}
          >
            <Button
              type="button"
              variant="ghost"
              className="action-secondary"
              onClick={onCancelEditor}
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
              padding: "18px 22px 20px",
              width: "100%",
              maxWidth: 1080,
              margin: "0 auto",
              minHeight: 360,
              boxSizing: "border-box",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
              {observationTitle}
            </div>
            {visibilityControl}

            <Button
              type="button"
              onClick={onStartNew}
              className="material-control action-positive"
              style={{ justifySelf: "center" }}
            >
              Add Observation
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
                      onClick={() => onEdit(index)}
                      className="back-link"
                      style={{ border: "none", background: "transparent", padding: 0 }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
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
              value={overallComment}
              onChange={(event) => onOverallCommentChange(event.target.value)}
              placeholder="Overall Comment (optional)"
              style={{
                minHeight: 122,
                padding: "12px 14px",
                resize: "none",
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
                className="action-negative"
                onClick={onDelete}
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
