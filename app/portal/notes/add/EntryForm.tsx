"use client";

import { AssessmentDomain, ComparisonType, MetricType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createEntry } from "@/app/actions/createEntry";
import { removeGoalDefinition } from "@/app/actions/removeGoalDefinition";

type GoalDefinitionOption = {
  id: string;
  target: string;
  goal: string;
  metricType: MetricType;
  domain: AssessmentDomain | null;
  targetValue: number | null;
  comparison: ComparisonType | null;
  weight: number;
};

type EntryItemDraft = {
  goalId: string;
  target: string;
  goal: string;
  metricType: MetricType | "";
  domain: AssessmentDomain | "";
  score: string;
  rawValue: string;
  supportLevel: string;
  isNewDraft?: boolean;
};

type Props = {
  clientId: string;
  providerId: string;
  role: string;
  mode?: "create" | "edit";
  goalDefinitions: GoalDefinitionOption[];
  clientName: string;
  providerName: string;
  providerRole: string;
  todayLabel: string;
  initialValues?: {
    note: string;
    items: EntryItemDraft[];
  };
};

const metricOptions: Array<{ value: MetricType; label: string }> = [
  { value: MetricType.Percentage, label: "Percentage" },
  { value: MetricType.Frequency, label: "Frequency" },
  { value: MetricType.Duration, label: "Duration" },
  { value: MetricType.Subjective, label: "Subjective" },
];

const createEmptyItem = (): EntryItemDraft => ({
  goalId: "",
  target: "",
  goal: "",
  metricType: MetricType.Percentage,
  domain: "",
  score: "",
  rawValue: "",
  supportLevel: "",
  isNewDraft: true,
});

const fieldInputStyle = {
  border: "1px solid #111",
  boxSizing: "border-box" as const,
};

function parseDurationToSeconds(value: string) {
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return Number.NaN;
  }

  if (parts.length === 2) {
    const [hours, minutes] = parts;
    return hours * 3600 + minutes * 60;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return Number.NaN;
}

function domainForMetric(metricType: MetricType | "") {
  if (metricType === MetricType.Frequency) {
    return AssessmentDomain.Behavior;
  }

  if (
    metricType === MetricType.Percentage ||
    metricType === MetricType.Duration ||
    metricType === MetricType.Subjective
  ) {
    return AssessmentDomain.SkillAcquisition;
  }

  return null;
}

function isCompleteMetricInput(metricType: MetricType | "", value: string) {
  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return false;
  }

  if (metricType === MetricType.Percentage) {
    const percentage = Number(trimmedValue);
    return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100;
  }

  if (metricType === MetricType.Frequency) {
    const frequency = Number(trimmedValue);
    return Number.isFinite(frequency) && frequency >= 0;
  }

  if (metricType === MetricType.Duration) {
    return Number.isFinite(parseDurationToSeconds(trimmedValue));
  }

  if (metricType === MetricType.Subjective) {
    const score = Number(trimmedValue);
    return Number.isInteger(score) && score >= 1 && score <= 10;
  }

  return false;
}

function formatDurationForEntryInput(value: string) {
  const parts = value.split(":");
  if (parts.length === 3 && parts[0] === "00") {
    return `${parts[1]}:${parts[2]}`;
  }

  return value;
}

function normalizeEntryDurationInput(value: string) {
  const parts = value.split(":");
  if (parts.length === 2) {
    return `00:${value}`;
  }

  return value;
}

function lowercaseFirst(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLowerCase() + value.slice(1);
}

function subjectiveTextSummaries(items: EntryItemDraft[]) {
  return items
    .filter((item) => item.metricType === MetricType.Subjective)
    .map((item) => ({
      target: item.target.trim(),
      goal: item.goal.trim(),
      value: item.score.trim(),
      numericValue: Number(item.score.trim()),
    }))
    .filter(
      (item) =>
        item.target &&
        item.value &&
        (!Number.isInteger(item.numericValue) ||
          item.numericValue < 1 ||
          item.numericValue > 10)
    )
    .map((item) => {
      const target = lowercaseFirst(item.target);
      const goal = lowercaseFirst(item.goal);
      const value = item.value.toLowerCase();
      const literalLine = `${item.target}: ${item.value}`;

      if (["yes", "y", "true"].includes(value)) {
        if (goal.includes("without interrupt")) {
          return {
            literalLine,
            summary: `Maintained attention for ${target} without interrupting.`,
          };
        }

        if (goal) {
          return {
            literalLine,
            summary: `${item.target} was observed: ${goal}.`,
          };
        }
      }

      if (["no", "n", "false"].includes(value) && goal) {
        return {
          literalLine,
          summary: `${item.target} was not observed: ${goal}.`,
        };
      }

      return { literalLine, summary: literalLine };
    });
}

function noteWithSubjectiveText(note: string, items: EntryItemDraft[]) {
  const summaries = subjectiveTextSummaries(items);
  let nextNote = note;

  for (const { literalLine } of summaries) {
    nextNote = nextNote
      .split("\n")
      .filter((line) => line.trim().toLowerCase() !== literalLine.toLowerCase())
      .join("\n");
  }

  const lines = summaries
    .map(({ summary }) => summary)
    .filter((line) => !nextNote.includes(line));

  if (lines.length === 0) {
    return nextNote;
  }

  return [nextNote.trim(), ...lines].filter(Boolean).join("\n");
}

export default function EntryForm({
  clientId,
  providerId,
  role,
  mode = "create",
  goalDefinitions,
  clientName,
  providerName,
  providerRole,
  todayLabel,
  initialValues,
}: Props) {
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
  const activeItem = hasItems ? items[Math.min(activeIndex, items.length - 1)] : null;

  const updateItem = (index: number, updater: (item: EntryItemDraft) => EntryItemDraft) => {
    setItems((previous) =>
      previous.map((item, itemIndex) => (itemIndex === index ? updater(item) : item))
    );
  };

  const syncGoalDefinition = (index: number, goalId: string) => {
    const goalDefinition = goalDefinitions.find((goal) => goal.id === goalId);
    updateItem(index, (item) => ({
      ...item,
      goalId,
      target: goalDefinition ? goalDefinition.target : item.target,
      goal: goalDefinition ? goalDefinition.goal : item.goal,
      metricType: goalDefinition ? goalDefinition.metricType : item.metricType,
      domain: goalDefinition ? goalDefinition.domain ?? "" : item.domain,
      score:
        goalDefinition && goalDefinition.metricType !== MetricType.Percentage &&
        goalDefinition.metricType !== MetricType.Subjective
          ? ""
          : item.score,
      rawValue:
        goalDefinition && goalDefinition.metricType === MetricType.Percentage
          ? ""
          : item.rawValue,
    }));
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

  const normalizeItemsForSave = (draftItems: EntryItemDraft[]) =>
    draftItems
      .map((item) => {
        const hasAssessmentValue =
          item.metricType === MetricType.Subjective
            ? item.score.trim()
            : item.rawValue.trim();

        if (!hasAssessmentValue) {
          return null;
        }

        if (
          !item.target.trim() ||
          (!item.goal.trim() && item.metricType !== MetricType.Frequency) ||
          !item.metricType
        ) {
          return { invalid: true as const };
        }

        let score: number | null = null;
        let rawValue: number | null = null;

        if (item.metricType === MetricType.Subjective) {
          if (item.score.trim() === "") {
            return { invalid: true as const };
          }
          const subjectiveScore = Number(item.score);
          score =
            Number.isInteger(subjectiveScore) &&
            subjectiveScore >= 1 &&
            subjectiveScore <= 10
              ? subjectiveScore
              : null;
        }

        if (item.metricType === MetricType.Percentage) {
          if (item.rawValue.trim() === "") {
            return { invalid: true as const };
          }
          rawValue = Number(item.rawValue);
        }

        if (item.metricType === MetricType.Duration) {
          if (item.rawValue.trim() === "") {
            return { invalid: true as const };
          }
          rawValue = parseDurationToSeconds(item.rawValue);
        }

        if (item.metricType === MetricType.Frequency) {
          if (item.rawValue.trim() === "") {
            return { invalid: true as const };
          }
          rawValue = Number(item.rawValue);
        }

        const supportLevel =
          item.supportLevel.trim() === "" ? null : Number(item.supportLevel);

        if (
          Number.isNaN(score ?? 0) ||
          Number.isNaN(rawValue ?? 0) ||
          Number.isNaN(supportLevel ?? 0)
        ) {
          return { invalid: true as const };
        }

        return {
          goalId: item.goalId || null,
          target: item.target.trim(),
          goal:
            item.metricType === MetricType.Frequency
              ? item.goal.trim() || "Frequency count"
              : item.goal.trim(),
          metricType: item.metricType,
          domain: domainForMetric(item.metricType),
          score,
          rawValue,
          supportLevel: null,
        };
      })
      .filter((item): item is Exclude<typeof item, null> => item !== null);

  const saveItems = async (draftItems: EntryItemDraft[]) => {
    const normalizedItems = normalizeItemsForSave(draftItems);

    const noteForSave = noteWithSubjectiveText(note, draftItems);
    const hasComment = noteForSave.trim().length > 0;

    if (
      normalizedItems.some((item) => "invalid" in item) ||
      (normalizedItems.length === 0 && (!canSubmitCommentOnly || !hasComment))
    ) {
      setSaveStatus("error");
      return { ok: false, noteForSave };
    }

    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("note", noteForSave);
    formData.append("items", JSON.stringify(normalizedItems));

    const result = await createEntry(formData);
    return { ...result, noteForSave };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaveStatus("saving");
    const shouldReturnAfterSavingDraft =
      isEditMode &&
      activeItem?.isNewDraft === true &&
      newDraftReturnIndexRef.current !== null;
    const result = await saveItems(items);
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
      router.push(`/dashboard?clientId=${clientId}&view=orbit`);
    }
    setSaveStatus(result.ok ? "saved" : "error");
  };

  const activeItemUsesCreationUI = activeItem?.isNewDraft === true;
  const noteCardMaxWidth = activeItemUsesCreationUI ? 1080 : 740;

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 20,
        }}
      >
        <button
          type="button"
          onClick={addItem}
          aria-label="Add assessment item"
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            border: "3px solid #2248e8",
            background: "#fff",
            color: "#2248e8",
            fontSize: 34,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            marginTop: 8,
          }}
        >
          +
        </button>

        <div style={{ flex: 1 }}>
      <div
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
        style={{
          border: "1px solid #ececec",
          borderRadius: 14,
          padding: activeItemUsesCreationUI ? "18px 22px 20px" : "14px 18px 16px",
          background: "#fff",
          maxWidth: noteCardMaxWidth,
          margin: "0 auto",
          minHeight: activeItemUsesCreationUI ? 250 : 190,
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
          <button
            type="button"
            onClick={prevItem}
            disabled={!hasItems}
          >
            ‹
          </button>
          <div style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 76 }}>
            <div style={{ fontWeight: 600 }}>
              {hasItems ? `${activeIndex + 1} of ${items.length}` : "No items yet"}
            </div>
          </div>
          <button
            type="button"
            onClick={nextItem}
            disabled={!hasItems}
          >
            ›
          </button>
        </div>

        {activeItem ? (
          activeItemUsesCreationUI ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(280px, 360px) 260px minmax(140px, 180px)",
                alignItems: "start",
                justifyContent: "center",
                gap: 18,
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <label>
                  <div style={{ marginBottom: 4, fontWeight: 500 }}>Target</div>
                  <input
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
                </label>

                {activeItem.metricType !== MetricType.Frequency ? (
                  <label>
                    <div style={{ marginBottom: 4, fontWeight: 500 }}>Goal</div>
                    <input
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
                  </label>
                ) : (
                  <div aria-hidden="true" style={{ minHeight: 74 }} />
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                  alignSelf: "center",
                  minWidth: 260,
                  justifyItems: "center",
                }}
              >
                {metricOptions.map((option) => {
                  const isActive = activeItem.metricType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        updateItem(activeIndex, (item) => ({
                          ...item,
                          goalId: "",
                          metricType: option.value,
                          goal:
                            option.value === MetricType.Frequency
                              ? ""
                              : item.goal,
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
                        borderRadius: 8,
                        border: `2px solid ${isActive ? "#2248e8" : "#c7d2fe"}`,
                        background: isActive ? "#eef2ff" : "#fff",
                        color: isActive ? "#2248e8" : "#333",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ alignSelf: "center" }}>
                {activeItem.metricType === MetricType.Percentage && (
                <label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={activeItem.rawValue}
                      onChange={(event) =>
                        updateMetricValue(
                          activeIndex,
                          event.target.value,
                          "rawValue",
                          shouldAutoAdvanceAfterInput(event, activeItem.rawValue)
                        )
                      }
                      onBlur={(event) =>
                        scheduleAutoAdvance(
                          activeIndex,
                          activeItem.metricType,
                          event.target.value
                        )
                      }
                      style={{ width: 120, padding: "10px 12px", ...fieldInputStyle }}
                    />
                    <span style={{ fontWeight: 600 }}>%</span>
                  </div>
                </label>
              )}

              {activeItem.metricType === MetricType.Subjective && (
                <label>
                  <input
                    type="text"
                    value={activeItem.score}
                    onChange={(event) =>
                      updateMetricValue(
                        activeIndex,
                        event.target.value,
                        "score",
                        shouldAutoAdvanceAfterInput(event, activeItem.score)
                      )
                    }
                    onBlur={(event) =>
                      scheduleAutoAdvance(
                        activeIndex,
                        activeItem.metricType,
                        event.target.value
                      )
                    }
                    placeholder="Text or number"
                    style={{ width: 140, padding: "10px 12px", ...fieldInputStyle }}
                  />
                </label>
              )}

              {activeItem.metricType === MetricType.Duration && (
                <label>
                  <input
                    value={formatDurationForEntryInput(activeItem.rawValue)}
                    onChange={(event) =>
                      updateMetricValue(
                        activeIndex,
                        normalizeEntryDurationInput(event.target.value),
                        "rawValue",
                        shouldAutoAdvanceAfterInput(event, activeItem.rawValue)
                      )
                    }
                    onBlur={(event) =>
                      scheduleAutoAdvance(
                        activeIndex,
                        activeItem.metricType,
                        normalizeEntryDurationInput(event.target.value)
                      )
                    }
                    placeholder="MM:SS"
                    style={{ width: 140, padding: "10px 12px", ...fieldInputStyle }}
                  />
                </label>
              )}

              {activeItem.metricType === MetricType.Frequency && (
                <label>
                  <input
                    type="number"
                    min={0}
                    value={activeItem.rawValue}
                    onChange={(event) =>
                      updateMetricValue(
                        activeIndex,
                        event.target.value,
                        "rawValue",
                        shouldAutoAdvanceAfterInput(event, activeItem.rawValue)
                      )
                    }
                    onBlur={(event) =>
                      scheduleAutoAdvance(
                        activeIndex,
                        activeItem.metricType,
                        event.target.value
                      )
                    }
                    style={{ width: 120, padding: "10px 12px", ...fieldInputStyle }}
                  />
                </label>
              )}
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 18,
                }}
              >
                <button
                  type="button"
                  onClick={removeActiveItem}
                  disabled={!hasItems}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#4b5563",
                    fontSize: 14,
                    padding: 0,
                  }}
                >
                  Remove Item
                </button>
              </div>

            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
	              <div
	                className="noteRow"
	                style={{
	                  display: "grid",
	                  gridTemplateColumns: "260px 160px 260px",
	                  alignItems: "center",
	                  justifyContent: "center",
	                  columnGap: 28,
	                  minHeight: 122,
	                }}
	              >
                <div
                  className="noteLeft"
                  style={{
                    minWidth: 0,
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
                        activeItem.metricType === MetricType.Frequency ||
                        activeItem.goal
                          ? 0.72
                          : 0,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {activeItem.metricType === MetricType.Frequency ? (
                      "Frequency count"
                    ) : activeItem.goal ? (
                      activeItem.goal
                    ) : (
                      "Goal placeholder"
                    )}
                  </p>
                </div>

	                <div
	                  style={{
	                    fontSize: 15,
	                    fontWeight: 600,
	                    opacity: 0.82,
	                    width: 160,
	                    textAlign: "center",
	                  }}
	                >
                  {activeItem.metricType}
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
	                  }}
	                >
                  {activeItem.metricType === MetricType.Percentage && (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={activeItem.rawValue}
                        onChange={(event) =>
                          updateMetricValue(
                            activeIndex,
                            event.target.value,
                            "rawValue",
                            shouldAutoAdvanceAfterInput(event, activeItem.rawValue)
                          )
                        }
                        onBlur={(event) =>
                          scheduleAutoAdvance(
                            activeIndex,
                            activeItem.metricType,
                            event.target.value
                          )
                        }
                        style={{
                          width: 150,
                          padding: "10px 12px",
                          ...fieldInputStyle,
                        }}
                      />
	                      <span style={{ fontWeight: 600, paddingLeft: 4 }}>%</span>
                    </>
                  )}

                  {activeItem.metricType === MetricType.Duration && (
                    <>
                      <input
                        value={formatDurationForEntryInput(activeItem.rawValue)}
                        onChange={(event) =>
                          updateMetricValue(
                            activeIndex,
                            normalizeEntryDurationInput(event.target.value),
                            "rawValue",
                            shouldAutoAdvanceAfterInput(event, activeItem.rawValue)
                          )
                        }
                        onBlur={(event) =>
                          scheduleAutoAdvance(
                            activeIndex,
                            activeItem.metricType,
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
                  )}

                  {activeItem.metricType === MetricType.Frequency && (
                    <>
                      <input
                        type="number"
                        min={0}
                        value={activeItem.rawValue}
                        onChange={(event) =>
                          updateMetricValue(
                            activeIndex,
                            event.target.value,
                            "rawValue",
                            shouldAutoAdvanceAfterInput(event, activeItem.rawValue)
                          )
                        }
                        onBlur={(event) =>
                          scheduleAutoAdvance(
                            activeIndex,
                            activeItem.metricType,
                            event.target.value
                          )
                        }
                        style={{
                          width: 150,
                          padding: "10px 12px",
                          ...fieldInputStyle,
                        }}
                      />
                      <span aria-hidden="true" />
                    </>
                  )}

                  {activeItem.metricType === MetricType.Subjective && (
                    <>
                      <textarea
                        value={activeItem.score}
                        onChange={(event) =>
                          updateMetricValue(
                            activeIndex,
                            event.target.value,
                            "score",
                            false
                          )
                        }
                        onBlur={(event) =>
                          scheduleAutoAdvance(
                            activeIndex,
                            activeItem.metricType,
                            event.target.value
                          )
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
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 18,
                }}
              >
                <button
                  type="button"
                  onClick={removeActiveItem}
                  disabled={!hasItems}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#4b5563",
                    fontSize: 14,
                    padding: 0,
                  }}
                >
                  Remove Item
                </button>
              </div>
            </div>
          )
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
          paddingTop: 4,
          width: "calc(100% - 74px)",
          margin: "0 0 0 74px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: noteCardMaxWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <label style={{ display: "contents" }}>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Comment..."
              style={{
                width: "75%",
                minHeight: isCreationMode ? 84 : 76,
                marginBottom: 8,
                padding: "10px 12px",
                resize: "vertical",
                ...fieldInputStyle,
              }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "center", width: "75%" }}>
            <button type="submit" disabled={saveStatus === "saving"}>
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                  ? "Saved"
                  : isEditMode
                    ? "Save Changes"
                    : "Submit"}
            </button>
          </div>
        </div>
        {saveStatus === "error" ? (
          <div
            style={{
              marginTop: 10,
              textAlign: "center",
              color: "#b42318",
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
