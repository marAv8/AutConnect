export const MetricType = {
  Percentage: "Percentage",
  Frequency: "Frequency",
  Duration: "Duration",
  Subjective: "Subjective",
} as const;

export type MetricType = (typeof MetricType)[keyof typeof MetricType];

export const AssessmentDomain = {
  Behavior: "Behavior",
  SkillAcquisition: "SkillAcquisition",
  Communication: "Communication",
  Adaptive: "Adaptive",
  Regulation: "Regulation",
  Other: "Other",
} as const;

export type AssessmentDomain =
  (typeof AssessmentDomain)[keyof typeof AssessmentDomain];

export type EntryItemDraft = {
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

type InvalidEntryItem = { invalid: true };

export type NormalizedEntryItem =
  | InvalidEntryItem
  | {
      goalId: string | null;
      target: string;
      goal: string;
      metricType: MetricType;
      domain: AssessmentDomain | null;
      score: number | null;
      rawValue: number | null;
      supportLevel: null;
    };

export type EntryPayload =
  | {
      ok: true;
      formData: FormData;
      noteForSave: string;
    }
  | {
      ok: false;
      noteForSave: string;
    };

export const createEmptyItem = (): EntryItemDraft => ({
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

export function parseDurationToSeconds(value: string) {
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

export function domainForMetric(metricType: MetricType | "") {
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

export function isCompleteMetricInput(metricType: MetricType | "", value: string) {
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

export function formatDurationForEntryInput(value: string) {
  const parts = value.split(":");
  if (parts.length === 3 && parts[0] === "00") {
    return `${parts[1]}:${parts[2]}`;
  }

  return value;
}

export function normalizeEntryDurationInput(value: string) {
  const parts = value.split(":");
  if (parts.length === 2) {
    return `00:${value}`;
  }

  return value;
}

export function normalizeItems(draftItems: EntryItemDraft[]): NormalizedEntryItem[] {
  return draftItems
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
}

export function buildPayload({
  clientId,
  note,
  items,
  canSubmitCommentOnly,
}: {
  clientId: string;
  note: string;
  items: EntryItemDraft[];
  canSubmitCommentOnly: boolean;
}): EntryPayload {
  const normalizedItems = normalizeItems(items);
  const noteForSave = noteWithSubjectiveText(note, items);
  const hasComment = noteForSave.trim().length > 0;

  if (
    normalizedItems.some((item) => "invalid" in item) ||
    (normalizedItems.length === 0 && (!canSubmitCommentOnly || !hasComment))
  ) {
    return { ok: false, noteForSave };
  }

  const formData = new FormData();
  formData.append("clientId", clientId);
  formData.append("note", noteForSave);
  formData.append("items", JSON.stringify(normalizedItems));

  return {
    ok: true,
    formData,
    noteForSave,
  };
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
