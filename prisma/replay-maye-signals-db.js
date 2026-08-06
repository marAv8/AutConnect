/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { buildMayeTimeline } = require("./synthetic/mayeTimeline");
const { compareReplay, replaySignals } = require("./synthetic/signalReplay");

process.loadEnvFile?.(".env");
const prisma = new PrismaClient();
const dataset = buildMayeTimeline();
const clientId = dataset.profile.client.syntheticKey;

async function main() {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      entries: { orderBy: [{ date: "asc" }, { id: "asc" }], select: {
        id: true, date: true, kind: true, visibility: true, status: true, note: true, clinicalReflection: true, contextData: true,
        provider: { select: { role: true } },
        items: { orderBy: { id: "asc" }, select: { goalId: true, target: true, goal: true, metricType: true, domain: true, score: true, rawValue: true, observation: true, goalDefinition: { select: { measurementProfile: true } } } },
        abcObservations: { orderBy: { id: "asc" }, select: { antecedent: true, behavior: true, consequence: true } },
      } },
      caseSupportRequests: { select: { id: true, createdAt: true, status: true } },
      caseSupportCases: { select: { coordinations: { select: { id: true, occurredAt: true, status: true, path: true } } } },
    },
  });
  if (!client) throw new Error("Maye Signal Lab has not been imported.");
  const records = client.entries.map((entry) => ({
    recordType: "entry", syntheticId: entry.id, date: entry.date.toISOString(), role: entry.provider.role,
    kind: entry.kind, visibility: entry.visibility, status: entry.status, note: entry.note, clinicalReflection: entry.clinicalReflection,
    contextData: entry.contextData,
    items: entry.items.map((item) => ({ ...item, measurementProfile: item.goalDefinition?.measurementProfile, goalDefinition: undefined, goalKey: item.goalId ?? `${entry.provider.role}:${item.target}` })),
    abcObservations: entry.abcObservations,
  }));
  for (const request of client.caseSupportRequests) records.push({ recordType: "caseSupportRequest", syntheticId: request.id, date: request.createdAt.toISOString(), status: request.status });
  for (const caseRecord of client.caseSupportCases) for (const coordination of caseRecord.coordinations) records.push({ recordType: "caseSupportCoordination", syntheticId: coordination.id, date: coordination.occurredAt.toISOString(), status: coordination.status, path: coordination.path });
  records.sort((a, b) => a.date.localeCompare(b.date));
  const replay = replaySignals({ sourceRecords: records, evaluationDates: dataset.expectedSignals.map((item) => item.date), calibration: dataset.profile.calibration });
  const comparison = compareReplay(replay, dataset.expectedSignals);
  console.log(JSON.stringify({ source: "PostgreSQL via Prisma", clientId, persistedSourceRecords: records.length, evaluated: comparison.evaluated, matches: comparison.matches, accuracy: Number((comparison.accuracy * 100).toFixed(1)), confusion: comparison.confusion, mismatchCount: comparison.mismatches.length, mismatches: comparison.mismatches }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
