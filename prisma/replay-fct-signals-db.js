/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { buildFctTimeline } = require("./synthetic/fctTimeline");
const { compareReplay, replaySignals } = require("./synthetic/signalReplay");

process.loadEnvFile?.(".env");
const prisma = new PrismaClient();
const dataset = buildFctTimeline();
const clientId = dataset.profile.client.syntheticKey;

async function main() {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { entries: { orderBy: [{ date: "asc" }, { id: "asc" }], select: {
    id: true, date: true, kind: true, visibility: true, status: true, note: true, clinicalReflection: true, contextData: true,
    provider: { select: { role: true } },
    items: { orderBy: { id: "asc" }, select: { goalId: true, target: true, goal: true, metricType: true, domain: true, score: true, rawValue: true, observation: true, goalDefinition: { select: { measurementProfile: true } } } },
    abcObservations: { orderBy: { id: "asc" }, select: { antecedent: true, behavior: true, consequence: true } },
  } } } });
  if (!client) throw new Error("FCT Signal Lab has not been imported.");
  const records = client.entries.map((entry) => ({
    recordType: "entry", syntheticId: entry.id, date: entry.date.toISOString(), role: entry.provider.role, kind: entry.kind,
    visibility: entry.visibility, status: entry.status, note: entry.note, clinicalReflection: entry.clinicalReflection, contextData: entry.contextData,
    items: entry.items.map((item) => ({ target: item.target, goal: item.goal, metricType: item.metricType, domain: item.domain, score: item.score, rawValue: item.rawValue, observation: item.observation, measurementProfile: item.goalDefinition?.measurementProfile, goalKey: item.goalId ?? `${entry.provider.role}:${item.target}` })),
    abcObservations: entry.abcObservations,
  }));
  const replay = replaySignals({ sourceRecords: records, evaluationDates: dataset.expectedSignals.map((item) => item.date), calibration: dataset.profile.calibration });
  const comparison = compareReplay(replay, dataset.expectedSignals);
  console.log(JSON.stringify({ source: "PostgreSQL via Prisma", clientId, persistedSourceRecords: records.length, evaluated: comparison.evaluated, matches: comparison.matches, accuracy: Number((comparison.accuracy * 100).toFixed(1)), confusion: comparison.confusion, mismatchCount: comparison.mismatches.length, mismatches: comparison.mismatches }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
