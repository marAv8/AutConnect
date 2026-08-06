/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { buildSuDoTimeline } = require("./synthetic/sudoTimeline");
const { compareReplay, replaySignals } = require("./synthetic/signalReplay");

process.loadEnvFile?.(".env");
const prisma = new PrismaClient();
const syntheticClientId = "synthetic-client-sudo-signal-lab-v1";

function sourceEntry(entry) {
  return {
    recordType: "entry",
    syntheticId: entry.id,
    date: entry.date.toISOString(),
    role: entry.provider.role,
    kind: entry.kind,
    visibility: entry.visibility,
    status: entry.status,
    note: entry.note,
    clinicalReflection: entry.clinicalReflection,
    contextData: entry.contextData,
    items: entry.items.map((item) => ({
      target: item.target,
      goal: item.goal,
      measurementProfile: item.goalDefinition?.measurementProfile ?? null,
      metricType: item.metricType,
      domain: item.domain,
      score: item.score,
      rawValue: item.rawValue,
      observation: item.observation,
      goalKey: item.goalId ?? `${entry.provider.role}:${item.target}`,
    })),
    abcObservations: entry.abcObservations.map((observation) => ({
      antecedent: observation.antecedent,
      behavior: observation.behavior,
      consequence: observation.consequence,
    })),
  };
}

async function loadDatabaseRecords() {
  const client = await prisma.client.findUnique({
    where: { id: syntheticClientId },
    select: {
      id: true,
      entries: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: {
          id: true,
          date: true,
          kind: true,
          visibility: true,
          status: true,
          note: true,
          clinicalReflection: true,
          contextData: true,
          provider: { select: { role: true } },
          items: {
            orderBy: { id: "asc" },
            select: {
              goalId: true,
              target: true,
              goal: true,
              metricType: true,
              domain: true,
              score: true,
              rawValue: true,
              observation: true,
              goalDefinition: { select: { measurementProfile: true } },
            },
          },
          abcObservations: {
            orderBy: { id: "asc" },
            select: { antecedent: true, behavior: true, consequence: true },
          },
        },
      },
      caseSupportRequests: {
        orderBy: { createdAt: "asc" },
        select: { id: true, createdAt: true, status: true },
      },
      caseSupportCases: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          entries: {
            orderBy: { occurredAt: "asc" },
            select: { id: true, occurredAt: true, coverageStatus: true },
          },
          coordinations: {
            orderBy: { occurredAt: "asc" },
            select: { id: true, occurredAt: true, status: true, path: true },
          },
        },
      },
    },
  });

  if (!client) throw new Error("Suren Signal Lab has not been imported.");

  const records = client.entries.map(sourceEntry);
  for (const request of client.caseSupportRequests) {
    records.push({
      recordType: "caseSupportRequest",
      syntheticId: request.id,
      date: request.createdAt.toISOString(),
      status: request.status,
    });
  }
  for (const caseRecord of client.caseSupportCases) {
    records.push({
      recordType: "caseSupportCase",
      syntheticId: caseRecord.id,
      date: caseRecord.createdAt.toISOString(),
      status: caseRecord.status,
    });
    for (const entry of caseRecord.entries) {
      records.push({
        recordType: "caseSupportEntry",
        syntheticId: entry.id,
        date: entry.occurredAt.toISOString(),
        coverageStatus: entry.coverageStatus,
      });
    }
    for (const coordination of caseRecord.coordinations) {
      records.push({
        recordType: "caseSupportCoordination",
        syntheticId: coordination.id,
        date: coordination.occurredAt.toISOString(),
        status: coordination.status,
        path: coordination.path,
      });
    }
  }
  return records.sort((first, second) => first.date.localeCompare(second.date));
}

async function main() {
  const dataset = buildSuDoTimeline();
  const sourceRecords = await loadDatabaseRecords();
  const evaluationDates = dataset.expectedSignals.map((item) => item.date);
  const replay = replaySignals({ sourceRecords, evaluationDates });
  const comparison = compareReplay(replay, dataset.expectedSignals);

  console.log(
    JSON.stringify(
      {
        source: "PostgreSQL via Prisma",
        clientId: syntheticClientId,
        persistedSourceRecords: sourceRecords.length,
        evaluated: comparison.evaluated,
        matches: comparison.matches,
        accuracy: Number((comparison.accuracy * 100).toFixed(1)),
        confusion: comparison.confusion,
        mismatchCount: comparison.mismatches.length,
        mismatches: comparison.mismatches,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

