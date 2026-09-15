"use client";

/**
 * Specialized note screens rendered inside the dashboard documentation overlay.
 * EntryForm owns persistence and workflow state; these components only present
 * supervisor reflections and caretaker daily-context cards to the provider.
 */

import type { FormEvent, ReactNode } from "react";
import type { CaretakerContextCard } from "@/app/libs/caretakerContext";
import { Button } from "@/components/ui/button";
import { ChevronControl } from "@/components/ui/ChevronControl";
import { Textarea } from "@/components/ui/textarea";
import { useGuardedSwipe } from "@/components/useGuardedSwipe";

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
  showProviderIdentity = true,
}: Pick<SharedFormProps, "clientName" | "providerName" | "providerRole" | "todayLabel"> & {
  showProviderIdentity?: boolean;
}) {
  return (
    <div className="add-note-header-text" style={{ marginBottom: 14, opacity: 0.7 }}>
      <div>{clientName}</div>
      {showProviderIdentity ? (
        <div>
          {providerName} — {providerRole}
        </div>
      ) : null}
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
  const reflectionSwipe = useGuardedSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrevious,
    canSwipeLeft: activeIndex < cardCount - 1,
    canSwipeRight: activeIndex > 0,
    disabled: cardCount < 2,
  });

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
        showProviderIdentity={false}
      />

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
          touchAction: "pan-y",
          transform: `translateX(${reflectionSwipe.dragOffset}px)`,
          transition: reflectionSwipe.dragOffset === 0 ? "transform 160ms ease-out" : "none",
        }}
        {...reflectionSwipe.swipeHandlers}
      >
        {cardCount > 1 ? (
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
              onClick={onPrevious}
              disabled={activeIndex === 0}
              aria-label="Previous reflection"
            />
            <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
              <div style={{ fontWeight: 600 }}>
                {activeIndex + 1} of {cardCount}
              </div>
            </div>
            <ChevronControl
              direction="right"
              onClick={onNext}
              disabled={activeIndex === cardCount - 1}
              aria-label="Next reflection"
            />
          </div>
        ) : null}

        {visibilityControl}

        <div
          style={{
            display: "grid",
            alignContent: "center",
            gap: 18,
            minHeight: 224,
            padding: "8px 18px 12px",
            boxSizing: "border-box",
          }}
        >
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
            className="action-negative"
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
  const contextSwipe = useGuardedSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrevious,
    canSwipeLeft: activeIndex < contextCards.length - 1,
    canSwipeRight: activeIndex > 0,
    disabled: contextCards.length < 2,
  });

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
          touchAction: "pan-y",
          transform: `translateX(${contextSwipe.dragOffset}px)`,
          transition: contextSwipe.dragOffset === 0 ? "transform 160ms ease-out" : "none",
        }}
        {...contextSwipe.swipeHandlers}
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
            onClick={onPrevious}
            disabled={!hasContextCards || activeIndex === 0}
            aria-label="Previous context card"
          />
          <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
            <div style={{ fontWeight: 600 }}>
              {hasContextCards ? `${activeIndex + 1} of ${contextCards.length}` : "No items yet"}
            </div>
          </div>
          <ChevronControl
            direction="right"
            onClick={onNext}
            disabled={!hasContextCards || activeIndex === contextCards.length - 1}
            aria-label="Next context card"
          />
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
                      className="clinical-selection-control"
                      aria-pressed={selected}
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
        {activeContextCard?.kind === "comment" ? (
          <Button
            type="submit"
            className="material-control action-positive"
            disabled={saveStatus === "saving"}
          >
            {saveStatus === "saving"
              ? "Saving..."
              : isEditMode
                ? "Update today's note"
                : "Add note to today's update"}
          </Button>
        ) : null}
        {saveStatus === "saved" ? <span style={{ opacity: 0.68 }}>Saved</span> : null}
        {saveStatus === "error" ? <span style={{ opacity: 0.72 }}>Could not save.</span> : null}
      </div>
    </form>
  );
}
