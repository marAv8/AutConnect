import { formatRole } from "@/app/libs/roles";
import {
  getProfessionTemplate,
  type ProfessionTargetOption,
} from "@/app/libs/professionTemplates";
import {
  contextKindLabel,
  getCaretakerContextCards,
  type CaretakerContextCard,
  type CaretakerContextData,
  type CaretakerContextKind,
} from "@/app/libs/caretakerContext";
import {
  noteEntryKindLabel,
  type NoteEntryKind,
} from "@/app/libs/entryKinds";
import { db } from "@/lib/db";
import { clientDisplayCode } from "@/app/libs/clientIdentity";

export type EntryFormItem = {
  goalId: string;
  target: string;
  goal: string;
  score: string;
  metricType: "Percentage" | "Frequency" | "Duration" | "Subjective" | "";
  domain:
    | "Behavior"
    | "SkillAcquisition"
    | "Communication"
    | "Adaptive"
    | "Regulation"
    | "Other"
    | "";
  rawValue: string;
  supportLevel: string;
  observation: string;
  measurementProfile?: string | null;
};

export type NoteFormData = {
  clientId: string;
  role: string;
  providerId: string;
  clientName: string;
  providerName: string;
  providerRole: string;
  targetOptions: ProfessionTargetOption[];
  noteKind?: NoteEntryKind;
  contextKind?: CaretakerContextKind;
  contextCards?: CaretakerContextCard[];
  mode: "create" | "edit";
  initialValues?: {
    note: string;
    items: EntryFormItem[];
    visibility?: "Private" | "Shared";
    contextValues?: Record<string, string>;
    contextComment?: string;
  };
  draft?: {
    data: unknown;
    updatedAt: string;
  } | null;
  draftWorkflowKey: string;
};

type LoadNoteFormDataInput = {
  clientId: string;
  providerId: string;
  sessionRole: string;
  forceEditMode?: boolean;
  requireAssignedClient?: boolean;
  contextKind?: CaretakerContextKind | null;
  noteKind?: NoteEntryKind;
  workflowKey?: string;
};

export async function loadNoteFormData({
  clientId,
  providerId,
  forceEditMode = false,
  requireAssignedClient = true,
  contextKind = null,
  noteKind = "SessionNote",
  workflowKey,
}: LoadNoteFormDataInput): Promise<NoteFormData | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entryKind = contextKind ?? noteKind;
  const draftKey = `${workflowKey ?? entryKind}:${dateKey(today)}`;
  const [client, provider, entry, goalDefinitions, draft] = await Promise.all([
    db.client.findFirst({
      where: {
        id: clientId,
        ...(requireAssignedClient
          ? {
              providerClients: {
                some: {
                  providerId,
                },
              },
            }
          : {}),
      },
      select: {
        firstName: true,
        lastName: true,
        receivesPrescribedMedication: true,
      },
    }),
    db.provider.findUnique({
      where: { id: providerId },
      select: { firstName: true, lastName: true, role: true },
    }),
    db.entry.findUnique({
      where: {
        providerId_clientId_date_kind: {
          providerId,
          clientId,
          date: today,
          kind: entryKind,
        },
      },
      select: {
        note: true,
        visibility: true,
        contextData: true,
        items: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            goalId: true,
            target: true,
            goal: true,
            score: true,
            metricType: true,
            domain: true,
            rawValue: true,
            supportLevel: true,
            observation: true,
            goalDefinition: {
              select: {
                measurementProfile: true,
              },
            },
          },
        },
      },
    }),
    db.goalDefinition.findMany({
      where: {
        clientId,
        providerId,
        isActive: true,
        isMastered: false,
      },
      orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        target: true,
        goal: true,
        metricType: true,
        domain: true,
        measurementProfile: true,
      },
    }),
    db.documentationDraft.findUnique({
      where: {
        providerId_clientId_workflowKey: {
          providerId,
          clientId,
          workflowKey: draftKey,
        },
      },
      select: {
        data: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!client || !provider) {
    return null;
  }

  if (contextKind) {
    const contextCards = getCaretakerContextCards({
      kind: contextKind,
      receivesPrescribedMedication: client.receivesPrescribedMedication,
    });
    const contextData = normalizeContextData(entry?.contextData);
    const contextValues = Object.fromEntries(
      contextData.entries.map((item) => [item.key, item.value])
    );

    return {
      clientId,
      role: provider.role,
      providerId,
      clientName: clientDisplayCode(client.firstName, client.lastName),
      providerName: `${provider.firstName} ${provider.lastName}`,
      providerRole: contextKindLabel(contextKind),
      targetOptions: [],
      contextKind,
      contextCards,
      mode: forceEditMode || !!entry ? "edit" : "create",
      initialValues:
        forceEditMode || !!entry
          ? {
              note: entry?.note ?? "",
              items: [],
              visibility: "Shared",
              contextValues,
              contextComment: contextData.comment,
            }
          : {
              note: "",
              items: [],
              visibility: "Shared",
              contextValues: {},
            contextComment: "",
            },
      draft: draft
        ? {
            data: draft.data,
            updatedAt: draft.updatedAt.toISOString(),
          }
        : null,
      draftWorkflowKey: draftKey,
    };
  }

  const isSupervisorDocumentation =
    noteKind === "SupervisorObservation" || noteKind === "ClinicalNote";
  const isObservationDocumentation =
    isSupervisorDocumentation ||
    noteKind === "SensoryObservation" ||
    noteKind === "CommunicationObservation";
  const supervisorContextValues = isObservationDocumentation
    ? normalizeSupervisorContextData(entry?.contextData)
    : {};
  const targetOptions = isObservationDocumentation
    ? []
    : await targetOptionsForProvider(provider.role, providerId);
  const hasEntryItems = (entry?.items.length ?? 0) > 0;
  const entryItems = entry?.items.map(formatEntryItemForForm) ?? [];
  const entryItemsByGoalId = new Map(
    entryItems.filter((item) => item.goalId).map((item) => [item.goalId, item])
  );
  const effectiveGoalDefinitions = isObservationDocumentation ? [] : goalDefinitions;
  const goalDefinitionItems = effectiveGoalDefinitions.map((goalDefinition) => {
    const savedItem = entryItemsByGoalId.get(goalDefinition.id);

    return {
      goalId: goalDefinition.id,
      target: goalDefinition.target,
      goal: goalDefinition.goal,
      score: savedItem?.score ?? "",
      metricType: goalDefinition.metricType,
      domain: goalDefinition.domain ?? "",
      rawValue: savedItem?.rawValue ?? "",
      supportLevel: savedItem?.supportLevel ?? "",
      observation: savedItem?.observation ?? "",
      measurementProfile:
        goalDefinition.measurementProfile ??
        savedItem?.measurementProfile ??
        educatorMeasurementProfileForTarget(goalDefinition.target, goalDefinition.metricType),
    } satisfies EntryFormItem;
  });
  const activeGoalIds = new Set(
    effectiveGoalDefinitions.map((goalDefinition) => goalDefinition.id)
  );
  const activeEntryItemsWithoutGoalDefinitions = entryItems.filter(
    (item) => item.goalId === "" || activeGoalIds.has(item.goalId)
  );
  const previousEntry =
    !isObservationDocumentation && goalDefinitionItems.length === 0 && !hasEntryItems
      ? await db.entry.findFirst({
          where: {
            providerId,
            clientId,
            date: {
              lt: today,
            },
            items: {
              some: {},
            },
          },
          orderBy: {
            date: "desc",
          },
          select: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                goalId: true,
                target: true,
                goal: true,
                metricType: true,
                domain: true,
              },
            },
          },
        })
      : null;

  const carriedForwardItems: EntryFormItem[] =
    goalDefinitionItems.length > 0
      ? [
          ...goalDefinitionItems,
          ...activeEntryItemsWithoutGoalDefinitions.filter(
            (item) => item.goalId === ""
          ),
        ]
      : activeEntryItemsWithoutGoalDefinitions;

  const priorSessionItems = dedupePriorItems(previousEntry?.items ?? []).map((item) => ({
    goalId: "",
    target: item.target,
    goal: item.goal,
    score: "",
    metricType: item.metricType ?? "",
    domain: item.domain ?? "",
    rawValue: "",
    supportLevel: "",
    observation: "",
    measurementProfile: educatorMeasurementProfileForTarget(item.target, item.metricType),
  } satisfies EntryFormItem));
  const templateItems =
    isSupervisorDocumentation
      ? []
      : provider.role !== "Educator" &&
          provider.role !== "OccupationalTherapist" &&
          provider.role !== "SpeechPathologist" &&
          provider.role !== "BehaviorTherapist" &&
          goalDefinitionItems.length === 0 &&
          carriedForwardItems.length === 0 &&
          priorSessionItems.length === 0
        ? templateItemsForRole(provider.role)
        : [];
  const initialItems =
    carriedForwardItems.length > 0
      ? carriedForwardItems
      : priorSessionItems.length > 0
        ? priorSessionItems
        : templateItems;
  const isEditMode = forceEditMode || !!entry;

  return {
    clientId,
    role: provider.role,
    providerId,
    clientName: clientDisplayCode(client.firstName, client.lastName),
    providerName: `${provider.firstName} ${provider.lastName}`,
    providerRole: isSupervisorDocumentation
      ? noteEntryKindLabel(noteKind)
      : formatRole(provider.role),
    targetOptions,
    noteKind,
    mode: isEditMode ? "edit" : "create",
    initialValues:
      provider.role === "Educator" ||
      provider.role === "OccupationalTherapist" ||
      provider.role === "SpeechPathologist" ||
      provider.role === "BehaviorTherapist" ||
      isEditMode ||
      initialItems.length > 0
        ? {
            note: entry?.note ?? "",
            items: initialItems,
            visibility: isSupervisorDocumentation
              ? entry?.visibility ?? "Private"
              : "Shared",
            contextValues: supervisorContextValues,
          }
        : undefined,
    draft: draft
      ? {
          data: draft.data,
          updatedAt: draft.updatedAt.toISOString(),
        }
      : null,
    draftWorkflowKey: draftKey,
  };
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSupervisorContextData(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const data = value as Record<string, unknown>;
  const contextValues = Object.fromEntries(
    Object.entries(data)
      .filter(([, fieldValue]) => typeof fieldValue === "string")
      .map(([key, fieldValue]) => [key, fieldValue as string])
  );

  if (Array.isArray(data.observations)) {
    contextValues.observationItemsJson = JSON.stringify(
      data.observations
        .map((item) => ({
          category:
            typeof item === "object" &&
            item !== null &&
            "category" in item &&
            typeof item.category === "string"
              ? item.category
              : "",
          observation:
            typeof item === "object" &&
            item !== null &&
            "observation" in item &&
            typeof item.observation === "string"
              ? item.observation
              : "",
          recommendation:
            typeof item === "object" &&
            item !== null &&
            "recommendation" in item &&
            typeof item.recommendation === "string"
              ? item.recommendation
              : "",
          note:
            typeof item === "object" &&
            item !== null &&
            "note" in item &&
            typeof item.note === "string"
              ? item.note
              : "",
        }))
        .filter((item) => item.category && item.observation)
    );
  }

  return contextValues;
}

function normalizeContextData(value: unknown): CaretakerContextData {
  if (!value || typeof value !== "object") {
    return { kind: "MorningContext", entries: [], comment: "" };
  }

  const data = value as Partial<CaretakerContextData>;
  const entries = Array.isArray(data.entries)
    ? data.entries
        .map((entry) => ({
          key: typeof entry.key === "string" ? entry.key : "",
          label: typeof entry.label === "string" ? entry.label : "",
          value: typeof entry.value === "string" ? entry.value : "",
        }))
        .filter((entry) => entry.key && entry.label)
    : [];

  return {
    kind:
      data.kind === "EveningContext" || data.kind === "MorningContext"
        ? data.kind
        : "MorningContext",
    entries,
    comment: typeof data.comment === "string" ? data.comment : "",
  };
}

async function targetOptionsForProvider(
  role: string,
  providerId: string
): Promise<ProfessionTargetOption[]> {
  const template = getProfessionTemplate(role);
  if (!template || template.targets.length === 0) {
    return [];
  }

  const usageCounts = await db.assessmentItem.groupBy({
    by: ["target"],
    where: {
      entry: {
        providerId,
      },
      target: {
        in: template.targets.map((target) => target.value),
      },
    },
    _count: {
      target: true,
    },
  });
  const countByTarget = new Map(
    usageCounts.map((item) => [item.target, item._count.target])
  );

  return [...template.targets].sort((first, second) => {
    const firstCount = countByTarget.get(first.value) ?? 0;
    const secondCount = countByTarget.get(second.value) ?? 0;
    return secondCount - firstCount;
  });
}

function templateItemsForRole(role: string): EntryFormItem[] {
  const template = getProfessionTemplate(role);
  if (!template) {
    return [];
  }

  return template.items.map((item) => ({
    goalId: "",
    target: item.target,
    goal: item.goal,
    score: "",
    metricType: item.metricType,
    domain: item.domain,
    rawValue: "",
    supportLevel: "",
    observation: "",
    measurementProfile: null,
  }));
}

function formatEntryItemForForm(item: {
  goalId: string | null;
  target: string;
  goal: string;
  score: number | null;
  metricType: "Percentage" | "Frequency" | "Duration" | "Subjective";
  domain:
    | "Behavior"
    | "SkillAcquisition"
    | "Communication"
    | "Adaptive"
    | "Regulation"
    | "Other"
    | null;
  rawValue: number | null;
  supportLevel: number | null;
  observation: string | null;
  goalDefinition?: {
    measurementProfile: string | null;
  } | null;
}): EntryFormItem {
  return {
    goalId: item.goalId ?? "",
    target: item.target,
    goal: item.goal,
    score: item.score?.toString() ?? "",
    metricType: item.metricType ?? "",
    domain: item.domain ?? "",
    rawValue:
      item.metricType === "Duration"
        ? formatDurationForInput(item.rawValue)
        : item.metricType === "Percentage"
          ? formatPercentageForInput(item)
          : item.rawValue?.toString() ?? "",
    supportLevel: item.supportLevel?.toString() ?? "",
    observation: item.observation ?? "",
    measurementProfile:
      item.goalDefinition?.measurementProfile ??
      educatorMeasurementProfileForTarget(item.target, item.metricType),
  };
}

function educatorMeasurementProfileForTarget(
  target: string,
  metricType: "Percentage" | "Frequency" | "Duration" | "Subjective" | ""
) {
  if (metricType === "Frequency") {
    return "Frequency";
  }

  const normalized = target.toLowerCase();
  if (normalized.includes("peer") || normalized.includes("group") || normalized.includes("participation")) {
    return "Participation";
  }

  if (normalized.includes("assignment") || normalized.includes("completion")) {
    return "Completion";
  }

  if (normalized.includes("independent") || normalized.includes("direction")) {
    return "Independence";
  }

  return "SupportLevel";
}

function dedupePriorItems<T extends {
  target: string;
  goal: string;
  metricType: "Percentage" | "Frequency" | "Duration" | "Subjective";
}>(items: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const key = `${item.target.trim().toLowerCase()}|${item.goal.trim().toLowerCase()}|${item.metricType}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function formatPercentageForInput(item: {
  rawValue: number | null;
  score: number | null;
}) {
  if (typeof item.rawValue === "number" && Number.isFinite(item.rawValue)) {
    return item.rawValue.toString();
  }

  if (typeof item.score === "number" && Number.isFinite(item.score)) {
    return String(item.score * 10);
  }

  return "";
}

function formatDurationForInput(rawValue: number | null) {
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return "";
  }

  const totalSeconds = Math.max(0, Math.round(rawValue));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}
