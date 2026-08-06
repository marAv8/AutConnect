/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { buildFctTimeline } = require("./synthetic/fctTimeline");

process.loadEnvFile?.(".env");
const prisma = new PrismaClient();
const dataset = buildFctTimeline();
const syntheticClientId = dataset.profile.client.syntheticKey;
const writeEnabled = process.argv.includes("--write");

function argumentValue(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}
const sourceClientId = argumentValue("--source-client-id");

function idPart(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function date(value) { return new Date(value); }
function goalId(goal) { return `fct-signal-lab-goal-${idPart(goal.syntheticKey)}`; }
function finalScore(items) {
  const scores = items.map((item) => item.score).filter(Number.isFinite);
  return scores.length === 0 ? null : Math.max(1, Math.min(10, Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length / 4) * 10)));
}

async function loadSource() {
  if (!sourceClientId) throw new Error("Provide --source-client-id=<id> to copy provider-role assignments safely.");
  const sourceClient = await prisma.client.findUnique({
    where: { id: sourceClientId },
    select: { firstName: true, lastName: true, dateOfBirth: true, receivesPrescribedMedication: true, providerClients: { select: { providerId: true, organizationId: true, role: true } } },
  });
  if (!sourceClient) throw new Error(`Source client ${sourceClientId} was not found.`);
  const providerByRole = new Map();
  for (const assignment of sourceClient.providerClients) {
    if (providerByRole.has(assignment.role)) throw new Error(`Source client has more than one ${assignment.role} assignment.`);
    providerByRole.set(assignment.role, assignment);
  }
  for (const required of dataset.profile.providers) if (!providerByRole.has(required.role)) throw new Error(`Source client is missing ${required.role}.`);
  return { sourceClient, providerByRole };
}

function entryData(record, providerByRole, goalIdByKey) {
  return {
    id: record.syntheticId,
    providerId: providerByRole.get(record.role).providerId,
    clientId: syntheticClientId,
    date: date(record.date),
    kind: record.kind,
    visibility: record.visibility,
    status: record.status,
    note: record.note,
    clinicalReflection: record.clinicalReflection,
    contextData: record.contextData ?? undefined,
    finalScore: finalScore(record.items),
    completedAt: date(record.date),
    createdAt: date(record.date),
    items: { create: record.items.map((item, index) => ({
      id: `${record.syntheticId}-item-${index + 1}`,
      goalId: goalIdByKey.get(item.goalKey),
      target: item.target,
      goal: item.goal,
      metricType: item.metricType,
      domain: item.domain,
      score: item.score,
      rawValue: item.rawValue,
      observation: item.observation,
      createdAt: date(record.date),
    })) },
    abcObservations: { create: record.abcObservations.map((observation, index) => ({
      id: `${record.syntheticId}-abc-${index + 1}`,
      antecedent: observation.antecedent,
      behavior: observation.behavior,
      consequence: observation.consequence,
      createdAt: date(record.date),
    })) },
  };
}

async function insertFixture(sourceClient, providerByRole) {
  if (await prisma.client.findUnique({ where: { id: syntheticClientId }, select: { id: true } })) throw new Error("FCT Signal Lab already exists; refusing to overwrite it.");
  const goalIdByKey = new Map(dataset.goalDefinitions.map((goal) => [goal.syntheticKey, goalId(goal)]));
  await prisma.$transaction(async (tx) => {
    await tx.client.create({ data: {
      id: syntheticClientId,
      firstName: dataset.profile.client.firstName,
      lastName: dataset.profile.client.lastName,
      dateOfBirth: sourceClient.dateOfBirth,
      diagnosis: dataset.profile.client.description,
      receivesPrescribedMedication: sourceClient.receivesPrescribedMedication,
      createdAt: date(`${dataset.profile.dateRange.start}T17:00:00.000Z`),
    } });
    for (const assignment of sourceClient.providerClients) await tx.providerClient.create({ data: {
      id: `fct-signal-lab-assignment-${idPart(assignment.role)}`,
      providerId: assignment.providerId,
      clientId: syntheticClientId,
      organizationId: assignment.organizationId,
      role: assignment.role,
    } });
    for (const goal of dataset.goalDefinitions) await tx.goalDefinition.create({ data: {
      id: goalId(goal), clientId: syntheticClientId, providerId: providerByRole.get(goal.providerRole).providerId,
      target: goal.target, goal: goal.goal, metricType: goal.metricType, domain: goal.domain,
      measurementProfile: goal.measurementProfile, weight: goal.weight, isActive: goal.isActive,
      isMastered: goal.isMastered, createdAt: date(`${dataset.profile.dateRange.start}T17:00:00.000Z`),
    } });
    for (const record of dataset.sourceRecords) await tx.entry.create({ data: entryData(record, providerByRole, goalIdByKey) });
    await tx.teamFocus.create({ data: {
      id: "fct-signal-lab-team-focus",
      clientId: syntheticClientId,
      authorId: providerByRole.get("Supervisor").providerId,
      title: "Functional Communication",
      content: "Maintain access to the communication system across settings. Track newly independent pointing, picture selection, break requests, and generalization without treating prompted DTT mastery as a badge event.",
      isActive: true,
      displayStartedAt: date("2026-02-02T17:00:00.000Z"),
      createdAt: date("2026-02-02T17:00:00.000Z"),
      updatedAt: date("2026-02-02T17:00:00.000Z"),
    } });
  }, { timeout: 120_000 });
}

async function main() {
  const { sourceClient, providerByRole } = await loadSource();
  console.log(JSON.stringify({ mode: writeEnabled ? "write" : "preview", sourceClient: `${sourceClient.firstName} ${sourceClient.lastName}`, targetClient: `${dataset.profile.client.firstName} ${dataset.profile.client.lastName}`, targetClientId: syntheticClientId, summary: dataset.summary }, null, 2));
  if (!writeEnabled) return;
  await insertFixture(sourceClient, providerByRole);
  console.log("FCT Signal Lab imported without modifying the source client.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
