"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeGoalDefinition } from "@/app/actions/removeGoalDefinition";
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
  };
  onSubmitted?: () => void;
  onSaved?: (entryId: string) => void;
};

const metricOptions: Array<{ value: MetricType; label: string }> = [
  { value: MetricType.Percentage, label: "Percentage" },
  { value: MetricType.Frequency, label: "Frequency" },
  { value: MetricType.Duration, label: "Duration" },
  { value: MetricType.Subjective, label: "Subjective" },
];

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
  onSubmitted,
  onSaved,
}: Props) {
  const { handleSubmit: submitEntry } = useEntrySubmit();
  const router = useRouter();
  const isEditMode = mode === "edit";
  const isCreationMode = !isEditMode;
  const canSubmitCommentOnly = role === "Supervisor" || role === "Caregiver";

  const [note, setNote] = useState(initialValues?.note ?? "");
  const [items, setItems] = useState<EntryItemDraft[]>(
    initialValues?.items ?? [createEmptyItem()]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const newDraftReturnIndexRef = useRef<number | null>(null);

  const cancelAutoAdvance = () => {
    if (autoAdvanceTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = null;
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
    };
  }, []);

  const hasItems = items.length > 0;
  const activeItem = useMemo(
    () => (hasItems ? items[Math.min(activeIndex, items.length - 1)] : null),
    [activeIndex, hasItems, items]
  );
  const activeItemUsesCreationUI = activeItem?.isNewDraft === true;
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
    if (!hasItems) {
      return;
    }

    cancelAutoAdvance();
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? items.length - 1 : currentIndex - 1
    );
  };

  const nextItem = () => {
    if (!hasItems) {
      return;
    }

    cancelAutoAdvance();
    setActiveIndex((currentIndex) =>
      currentIndex === items.length - 1 ? 0 : currentIndex + 1
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
    return submitEntry({
      clientId,
      note,
      items: draftItems,
      canSubmitCommentOnly,
      redirectOnSuccess,
    });
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaveStatus("saving");
    const shouldReturnAfterSavingDraft =
      isEditMode &&
      activeItem?.isNewDraft === true &&
      newDraftReturnIndexRef.current !== null;
    const result = await saveItems(items, false);
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
        onSaved?.(result.entryId);
      }
      onSubmitted?.();
    }
    setSaveStatus(result.ok ? "saved" : "error");
  };

  const renderMetricValueControl = (item: EntryItemDraft) => {
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
                      <Input
                        value={activeItem.target}
                        onChange={(event) =>
                          updateItem(activeIndex, (item) => ({
                            ...item,
                            goalId: "",
                            target: event.target.value,
                          }))
                        }
                        placeholder="i.e. compliance"
                        style={{ width: "100%", padding: "10px 12px", ...fieldInputStyle }}
                      />
                    </Label>

                    <Label
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px minmax(0, 1fr)",
                        alignItems: "center",
                        columnGap: 12,
                        visibility:
                          activeItem.metricType === MetricType.Frequency
                            ? "hidden"
                            : "visible",
                        pointerEvents:
                          activeItem.metricType === MetricType.Frequency
                            ? "none"
                            : "auto",
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
                      {activeItem.metricType === MetricType.Frequency
                        ? "Frequency count"
                        : activeItem.goal || "Goal placeholder"}
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
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                      justifyItems: "center",
                    }}
                  >
                    {metricOptions.map((option) => {
                      const isActive = activeItem.metricType === option.value;
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant="outline"
                          onClick={() =>
                            updateItem(activeIndex, (item) => ({
                              ...item,
                              goalId: "",
                              metricType: option.value,
                              goal: option.value === MetricType.Frequency ? "" : item.goal,
                              score:
                                option.value === MetricType.Duration ||
                                option.value === MetricType.Frequency
                                  ? ""
                                  : item.score,
                              rawValue:
                                option.value === MetricType.Percentage ||
                                option.value === MetricType.Subjective
                                  ? ""
                                  : item.rawValue,
                            }))
                          }
                          style={{
                            minHeight: 40,
                            minWidth: 112,
                            padding: "8px 10px",
                            borderRadius: 13,
                            border: "none",
                            background: isActive ? "var(--glass-strong)" : "var(--glass)",
                            color: isActive ? "var(--foreground)" : "rgb(0 0 0 / 68%)",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      opacity: 0.82,
                      textAlign: "center",
                    }}
                  >
                    {activeItem.metricType}
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
                    : "Submit"}
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
