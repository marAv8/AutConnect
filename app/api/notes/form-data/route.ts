import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatRole } from "@/app/libs/roles";

type EntryFormItem = {
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
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [client, provider, entry, goalDefinitions] = await Promise.all([
    db.client.findFirst({
      where: {
        id: clientId,
        providerClients: {
          some: {
            providerId: session.providerId,
          },
        },
      },
      select: { firstName: true, lastName: true },
    }),
    db.provider.findUnique({
      where: { id: session.providerId },
      select: { firstName: true, lastName: true, role: true },
    }),
    db.entry.findUnique({
      where: {
        providerId_clientId_date: {
          providerId: session.providerId,
          clientId,
          date: today,
        },
      },
      select: {
        note: true,
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
          },
        },
      },
    }),
    db.goalDefinition.findMany({
      where: {
        clientId,
        providerId: session.providerId,
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
      },
    }),
  ]);

  if (!client || !provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasEntryItems = (entry?.items.length ?? 0) > 0;
  const entryItems = entry?.items.map(formatEntryItemForForm) ?? [];
  const entryItemsByGoalId = new Map(
    entryItems.filter((item) => item.goalId).map((item) => [item.goalId, item])
  );
  const goalDefinitionItems = goalDefinitions.map((goalDefinition) => {
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
    } satisfies EntryFormItem;
  });
  const activeGoalIds = new Set(goalDefinitions.map((goalDefinition) => goalDefinition.id));
  const activeEntryItemsWithoutGoalDefinitions = entryItems.filter(
    (item) => item.goalId === "" || activeGoalIds.has(item.goalId)
  );
  const previousEntry =
    goalDefinitionItems.length === 0 && !hasEntryItems
      ? await db.entry.findFirst({
          where: {
            providerId: session.providerId,
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

  const priorSessionItems =
    carriedForwardItems.length > 0
      ? carriedForwardItems
      : dedupePriorItems(previousEntry?.items ?? []).map((item) => ({
          goalId: "",
          target: item.target,
          goal: item.goal,
          score: "",
          metricType: item.metricType ?? "",
          domain: item.domain ?? "",
          rawValue: "",
          supportLevel: "",
        } satisfies EntryFormItem));

  const isEditMode = !!entry;

  return NextResponse.json({
    clientId,
    role: session.role,
    providerId: session.providerId,
    clientName: `${client.firstName} ${client.lastName}`,
    providerName: `${provider.firstName} ${provider.lastName}`,
    providerRole: formatRole(provider.role),
    mode: isEditMode ? "edit" : "create",
    initialValues:
      isEditMode || priorSessionItems.length > 0
        ? {
            note: entry?.note ?? "",
            items: priorSessionItems,
          }
        : undefined,
  });
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
  };
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
