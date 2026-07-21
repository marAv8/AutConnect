"use client";

/**
 * Shared observation editor shown in the dashboard note overlay.
 * Speech uses it for communication observations, OT for sensory observations,
 * and supervisors for observation sessions. EntryForm owns all persistence.
 */

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  communicationObservationCategoryOptions,
  communicationRecommendationOptions,
  observationCategoryOptions,
  sensoryObservationCategoryOptions,
  sensoryRecommendationOptions,
} from "./entryFormConfig";
import type { ObservationItemDraft } from "./entryFormClinicalModel";
import type { EntryFormSaveStatus } from "./EntrySpecializedForms";

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
      : "Observation Session";

  return (
    <form
      className="add-note-form"
      onSubmit={isAddingObservation ? onEditorSubmit : onSessionSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div className="add-note-header-text" style={{ marginBottom: 14, opacity: 0.7 }}>
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
              maxWidth: 1080,
              margin: "0 auto",
              height: 320,
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
              <Button type="button" variant="ghost" onClick={onPrevious}>
                ‹
              </Button>
              <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
                <div style={{ fontWeight: 600 }}>
                  {activeIndex + 1} of {observationCardCount}
                </div>
              </div>
              <Button type="button" variant="ghost" onClick={onNext}>
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
                      const selected = draftCategory === option;

                      return (
                        <Button
                          key={option}
                          type="button"
                          variant="ghost"
                          onClick={() => onCategoryChange(option)}
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
                      const selected = draftRecommendation === option;

                      return (
                        <Button
                          key={option}
                          type="button"
                          variant="ghost"
                          onClick={() => onRecommendationChange(option)}
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
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
              minHeight: 44,
            }}
          >
            <Button type="button" variant="ghost" onClick={onCancelEditor}>
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
              maxWidth: 1080,
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
            {visibilityControl}

            <Button
              type="button"
              onClick={onStartNew}
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
