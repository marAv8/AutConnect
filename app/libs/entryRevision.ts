import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type EntryRevisionChange = {
  path: string;
  label: string;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
};

export type EntryRevisionSnapshot = {
  note: string | null;
  clinicalReflection: string | null;
  visibility: string;
  contextData: Prisma.JsonValue | null;
  finalScore: number | null;
  items: Array<{
    target: string;
    goal: string;
    score: number | null;
    metricType: string;
    domain: string | null;
    rawValue: number | null;
    supportLevel: number | null;
    observation: string | null;
  }>;
  abcObservations: Array<{
    antecedent: string;
    behavior: string;
    consequence: string;
  }>;
};

type RevisionClient = Prisma.TransactionClient | typeof db;

const revisionEntrySelect = {
  note: true,
  clinicalReflection: true,
  visibility: true,
  contextData: true,
  finalScore: true,
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      target: true,
      goal: true,
      score: true,
      metricType: true,
      domain: true,
      rawValue: true,
      supportLevel: true,
      observation: true,
    },
  },
  abcObservations: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      antecedent: true,
      behavior: true,
      consequence: true,
    },
  },
} satisfies Prisma.EntrySelect;

export async function ensureEntryRevision(
  client: RevisionClient,
  entryId: string,
  createdById: string,
  createdAt?: Date
) {
  const [entry, latestRevision] = await Promise.all([
    client.entry.findUnique({
      where: { id: entryId },
      select: revisionEntrySelect,
    }),
    client.entryRevision.findFirst({
      where: { entryId },
      orderBy: { revisionNumber: "desc" },
      select: {
        revisionNumber: true,
        snapshot: true,
      },
    }),
  ]);

  if (!entry) {
    throw new Error("Cannot revise a missing entry.");
  }

  const snapshot = toEntryRevisionSnapshot(entry);
  const previousSnapshot = parseEntryRevisionSnapshot(latestRevision?.snapshot);

  if (
    previousSnapshot &&
    stableJson(normalizeSnapshotForComparison(previousSnapshot)) ===
      stableJson(normalizeSnapshotForComparison(snapshot))
  ) {
    return {
      created: false as const,
      revisionNumber: latestRevision?.revisionNumber ?? 1,
      changes: [] as EntryRevisionChange[],
    };
  }

  const changes = previousSnapshot
    ? buildEntryRevisionChanges(previousSnapshot, snapshot)
    : [];
  const revisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

  await client.entryRevision.create({
    data: {
      entryId,
      createdById,
      revisionNumber,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      changes: changes as unknown as Prisma.InputJsonValue,
      createdAt,
    },
  });

  return {
    created: true as const,
    revisionNumber,
    changes,
  };
}

export function buildEntryRevisionChanges(
  before: EntryRevisionSnapshot,
  after: EntryRevisionSnapshot
): EntryRevisionChange[] {
  const changes: EntryRevisionChange[] = [];

  addScalarChange(changes, "note", "Provider note", before.note, after.note);
  addScalarChange(
    changes,
    "clinicalReflection",
    "Clinical reflection",
    before.clinicalReflection,
    after.clinicalReflection
  );
  addScalarChange(
    changes,
    "visibility",
    "Visibility",
    before.visibility,
    after.visibility
  );
  addStructuredChanges(changes, "contextData", "Documentation", before.contextData, after.contextData);

  addItemChanges(changes, before.items, after.items);

  if (stableJson(before.abcObservations) !== stableJson(after.abcObservations)) {
    changes.push({
      path: "abcObservations",
      label: "A-B-C observations",
      before: summarizeAbcObservations(before.abcObservations),
      after: summarizeAbcObservations(after.abcObservations),
    });
  }

  return changes;
}

function addItemChanges(
  changes: EntryRevisionChange[],
  beforeItems: EntryRevisionSnapshot["items"],
  afterItems: EntryRevisionSnapshot["items"]
) {
  const beforeByTarget = new Map(
    beforeItems.map((item) => [itemIdentity(item), item])
  );
  const afterByTarget = new Map(
    afterItems.map((item) => [itemIdentity(item), item])
  );
  const identities = [
    ...new Set([...beforeByTarget.keys(), ...afterByTarget.keys()]),
  ].sort();

  for (const identity of identities) {
    const before = beforeByTarget.get(identity);
    const after = afterByTarget.get(identity);
    const target = after?.target ?? before?.target ?? "Target";
    const path = `items.${identity}`;

    if (!before && after) {
      changes.push({
        path,
        label: `${target}: Added`,
        before: null,
        after: summarizeItemDetails(after),
      });
      continue;
    }

    if (before && !after) {
      changes.push({
        path,
        label: `${target}: Removed`,
        before: summarizeItemDetails(before),
        after: null,
      });
      continue;
    }

    if (!before || !after) {
      continue;
    }

    addScalarChange(
      changes,
      `${path}.goal`,
      `${target}: Goal`,
      before.goal,
      after.goal
    );
    addScalarChange(
      changes,
      `${path}.response`,
      `${target}: Response`,
      itemResponse(before),
      itemResponse(after)
    );
    addScalarChange(
      changes,
      `${path}.observation`,
      `${target}: Observation`,
      before.observation,
      after.observation
    );
    addScalarChange(
      changes,
      `${path}.measurement`,
      `${target}: Measurement`,
      before.metricType,
      after.metricType
    );
  }
}

function toEntryRevisionSnapshot(
  entry: Prisma.EntryGetPayload<{ select: typeof revisionEntrySelect }>
): EntryRevisionSnapshot {
  return {
    note: entry.note,
    clinicalReflection: entry.clinicalReflection,
    visibility: entry.visibility,
    contextData: entry.contextData ?? null,
    finalScore: entry.finalScore,
    items: entry.items,
    abcObservations: entry.abcObservations,
  };
}

function parseEntryRevisionSnapshot(value: Prisma.JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as unknown as EntryRevisionSnapshot;
}

function addScalarChange(
  changes: EntryRevisionChange[],
  path: string,
  label: string,
  before: Prisma.JsonValue | null,
  after: Prisma.JsonValue | null
) {
  if (stableJson(before) === stableJson(after)) return;
  changes.push({ path, label, before, after });
}

function addStructuredChanges(
  changes: EntryRevisionChange[],
  path: string,
  label: string,
  before: Prisma.JsonValue | null,
  after: Prisma.JsonValue | null
) {
  const beforeRecord = jsonRecord(before);
  const afterRecord = jsonRecord(after);

  if (!beforeRecord || !afterRecord) {
    addScalarChange(changes, path, label, before, after);
    return;
  }

  const keys = [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].sort();
  for (const key of keys) {
    const beforeValue = beforeRecord[key] ?? null;
    const afterValue = afterRecord[key] ?? null;
    const childPath = `${path}.${key}`;

    if (jsonRecord(beforeValue) && jsonRecord(afterValue)) {
      addStructuredChanges(
        changes,
        childPath,
        `${label}: ${humanizeKey(key)}`,
        beforeValue,
        afterValue
      );
      continue;
    }

    addScalarChange(
      changes,
      childPath,
      `${label}: ${humanizeKey(key)}`,
      beforeValue,
      afterValue
    );
  }
}

function jsonRecord(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Prisma.JsonObject;
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function itemIdentity(item: EntryRevisionSnapshot["items"][number]) {
  return item.target.trim().toLocaleLowerCase();
}

function itemResponse(item: EntryRevisionSnapshot["items"][number]) {
  return item.rawValue ?? item.score ?? item.supportLevel ?? null;
}

function summarizeItemDetails(
  item: EntryRevisionSnapshot["items"][number]
) {
  const response = itemResponse(item);
  return [
    response === null ? null : `Response: ${response}`,
    item.observation?.trim()
      ? `Observation: ${item.observation.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

function normalizeSnapshotForComparison(snapshot: EntryRevisionSnapshot) {
  return {
    ...snapshot,
    items: [...snapshot.items].sort((left, right) =>
      itemIdentity(left).localeCompare(itemIdentity(right))
    ),
  };
}

function summarizeAbcObservations(
  observations: EntryRevisionSnapshot["abcObservations"]
) {
  return observations.map(
    (observation) =>
      `Antecedent: ${observation.antecedent}; Behavior: ${observation.behavior}; Consequence: ${observation.consequence}`
  );
}

function stableJson(value: unknown) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)])
  );
}
