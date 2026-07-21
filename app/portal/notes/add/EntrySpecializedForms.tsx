"use client";

/**
 * Specialized note screens rendered inside the dashboard documentation overlay.
 * EntryForm owns persistence and workflow state; these components only present
 * supervisor reflections and caretaker daily-context cards to the provider.
 */

import type { FormEvent, ReactNode } from "react";
import type { CaretakerContextCard } from "@/app/libs/caretakerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type EntryFormSaveStatus = "idle" | "saving" | "saved" | "error";

const fieldInputStyle = {
  border: "none",
  boxSizing: "border-box" as const,
};

type SharedFormProps = {
  clientName: string;
  providerName: string;
  providerRole: string;
  todayLabel: string;
  saveStatus: EntryFormSaveStatus;
  isEditMode: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

function EntryFormHeader({
  clientName,
  providerName,
  providerRole,
  todayLabel,
}: Pick<SharedFormProps, "clientName" | "providerName" | "providerRole" | "todayLabel">) {
  return (
    <div className="add-note-header-text" style={{ marginBottom: 14, opacity: 0.7 }}>
      <div>{clientName}</div>
      <div>
        {providerName} -- {providerRole}
      </div>
      <div>{todayLabel}</div>
    </div>
  );
}

type ClinicalReflectionEntryFormProps = SharedFormProps & {
  activeIndex: number;
  cardCount: number;
  contextValues: Record<string, string>;
  visibilityControl: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  onContextValueChange: (key: string, value: string) => void;
  onDelete: () => void | Promise<void>;
};

export function ClinicalReflectionEntryForm({
  clientName,
  providerName,
  providerRole,
  todayLabel,
  activeIndex,
  cardCount,
  contextValues,
  visibilityControl,
  saveStatus,
  isEditMode,
  onPrevious,
  onNext,
  onContextValueChange,
  onSubmit,
  onDelete,
}: ClinicalReflectionEntryFormProps) {
  return (
    <form
      className="add-note-form"
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <EntryFormHeader
        clientName={clientName}
        providerName={providerName}
        providerRole={providerRole}
        todayLabel={todayLabel}
      />

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
              {activeIndex + 1} of {cardCount}
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={onNext}>
            ›
          </Button>
        </div>

        {visibilityControl}

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
                Clinical Reflection
              </div>
              <Textarea
                value={contextValues.clinicalReflection ?? ""}
                onChange={(event) =>
                  onContextValueChange("clinicalReflection", event.target.value)
                }
                placeholder="What clinical insight or interpretation would you like to record?"
                style={{
                  minHeight: 122,
                  padding: "12px 14px",
                  resize: "none",
                  ...fieldInputStyle,
                }}
              />
            </>
          ) : null}

          {activeIndex === 1 ? (
            <>
              <div style={{ textAlign: "center", fontSize: 24, fontWeight: 650 }}>
                Optional Reference
              </div>
              <Input
                value={contextValues.optionalReference ?? ""}
                onChange={(event) =>
                  onContextValueChange("optionalReference", event.target.value)
                }
                placeholder="Optional reference (example: Full supervision documentation completed in agency record.)"
                style={{ minHeight: 44, padding: "10px 12px", ...fieldInputStyle }}
              />
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
          type="submit"
          className="material-control action-positive"
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving..." : isEditMode ? "Update Note" : "Submit"}
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
        {saveStatus === "saved" ? <span style={{ opacity: 0.68 }}>Saved</span> : null}
        {saveStatus === "error" ? (
          <span style={{ opacity: 0.72 }}>Complete the required card before saving.</span>
        ) : null}
      </div>
    </form>
  );
}

type CaretakerContextEntryFormProps = SharedFormProps & {
  activeIndex: number;
  contextCards: CaretakerContextCard[];
  contextValues: Record<string, string>;
  contextComment: string;
  onPrevious: () => void;
  onNext: () => void;
  onContextValueChange: (key: string, value: string) => void;
  onContextCommentChange: (value: string) => void;
};

export function CaretakerContextEntryForm({
  clientName,
  providerName,
  providerRole,
  todayLabel,
  activeIndex,
  contextCards,
  contextValues,
  contextComment,
  saveStatus,
  isEditMode,
  onPrevious,
  onNext,
  onContextValueChange,
  onContextCommentChange,
  onSubmit,
}: CaretakerContextEntryFormProps) {
  const hasContextCards = contextCards.length > 0;
  const activeContextCard = hasContextCards
    ? contextCards[Math.min(activeIndex, contextCards.length - 1)]
    : null;

  return (
    <form
      className="add-note-form"
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <EntryFormHeader
        clientName={clientName}
        providerName={providerName}
        providerRole={providerRole}
        todayLabel={todayLabel}
      />

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
          <Button type="button" variant="ghost" onClick={onPrevious} disabled={!hasContextCards}>
            ‹
          </Button>
          <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
            <div style={{ fontWeight: 600 }}>
              {hasContextCards ? `${activeIndex + 1} of ${contextCards.length}` : "No items yet"}
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={onNext} disabled={!hasContextCards}>
            ›
          </Button>
        </div>

        {activeContextCard ? (
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
            <div style={{ display: "grid", gap: 8, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 650 }}>{activeContextCard.label}</div>
              <div style={{ fontSize: 17, opacity: 0.74 }}>{activeContextCard.prompt}</div>
            </div>

            {activeContextCard.kind === "comment" ? (
              <Textarea
                value={contextComment}
                onChange={(event) => onContextCommentChange(event.target.value)}
                placeholder={activeContextCard.placeholder}
                style={{
                  minHeight: 108,
                  padding: "12px 14px",
                  resize: "none",
                  ...fieldInputStyle,
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                {(activeContextCard.options ?? []).map((option) => {
                  const selected = contextValues[activeContextCard.key] === option;

                  return (
                    <Button
                      key={option}
                      type="button"
                      variant="ghost"
                      onClick={() => onContextValueChange(activeContextCard.key, option)}
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
            )}
          </div>
        ) : null}
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
          {saveStatus === "saving" ? "Saving..." : isEditMode ? "Update Note" : "Submit"}
        </Button>
        {saveStatus === "saved" ? <span style={{ opacity: 0.68 }}>Saved</span> : null}
        {saveStatus === "error" ? <span style={{ opacity: 0.72 }}>Could not save.</span> : null}
      </div>
    </form>
  );
}
