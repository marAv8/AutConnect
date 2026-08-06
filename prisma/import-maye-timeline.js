/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { buildMayeTimeline } = require("./synthetic/mayeTimeline");

process.loadEnvFile?.(".env");
const prisma = new PrismaClient();
const dataset = buildMayeTimeline();
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

function date(value) {
  return new Date(value);
}

function finalScore(items) {
  const scores = items.map((item) => item.score).filter(Number.isFinite);
  if (scores.length === 0) return null;
  return Math.max(1, Math.min(10, Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length / 4) * 10)));
}

function uniqueProviderByRole(assignments) {
  const providers = new Map();
  for (const assignment of assignments) {
    if (providers.has(assignment.role)) throw new Error(`Source client has more than one ${assignment.role} assignment.`);
    providers.set(assignment.role, assignment);
  }
  return providers;
}

function goalId(goal) {
  return `maye-signal-lab-goal-${idPart(goal.syntheticKey)}`;
}

async function loadSource() {
  if (!sourceClientId) throw new Error("Provide --source-client-id=<id> so provider assignments can be copied safely.");
  const sourceClient = await prisma.client.findUnique({
    where: { id: sourceClientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      receivesPrescribedMedication: true,
      providerClients: { select: { providerId: true, organizationId: true, role: true } },
    },
  });
  if (!sourceClient) throw new Error(`Source client ${sourceClientId} was not found.`);
  const providerByRole = uniqueProviderByRole(sourceClient.providerClients);
  for (const required of dataset.profile.providers) {
    if (!providerByRole.has(required.role)) throw new Error(`Source client is missing ${required.role}.`);
  }
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
  const existing = await prisma.client.findUnique({ where: { id: syntheticClientId }, select: { id: true } });
  if (existing) throw new Error("Maye Signal Lab already exists; refusing to overwrite it.");
  const entries = dataset.sourceRecords.filter((record) => record.recordType === "entry");
  const request = dataset.sourceRecords.find((record) => record.recordType === "caseSupportRequest");
  const coordination = dataset.sourceRecords.find((record) => record.recordType === "caseSupportCoordination");
  const goalIdByKey = new Map(dataset.goalDefinitions.map((goal) => [goal.syntheticKey, goalId(goal)]));
  const supervisorAssignment = providerByRole.get("Supervisor");
  const caseId = "maye-signal-lab-case-2026-02";

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

    for (const assignment of sourceClient.providerClients) {
      await tx.providerClient.create({ data: {
        id: `maye-signal-lab-assignment-${idPart(assignment.role)}`,
        providerId: assignment.providerId,
        clientId: syntheticClientId,
        organizationId: assignment.organizationId,
        role: assignment.role,
      } });
    }
    for (const goal of dataset.goalDefinitions) {
      await tx.goalDefinition.create({ data: {
        id: goalId(goal),
        clientId: syntheticClientId,
        providerId: providerByRole.get(goal.providerRole).providerId,
        target: goal.target,
        goal: goal.goal,
        metricType: goal.metricType,
        domain: goal.domain,
        measurementProfile: goal.measurementProfile,
        weight: goal.weight,
        isActive: goal.isActive,
        isMastered: goal.isMastered,
        createdAt: date(`${dataset.profile.dateRange.start}T17:00:00.000Z`),
      } });
    }
    for (const record of entries) await tx.entry.create({ data: entryData(record, providerByRole, goalIdByKey) });

    await tx.caseSupportCase.create({ data: {
      id: caseId,
      clientId: syntheticClientId,
      ownerSupervisorId: supervisorAssignment.providerId,
      organizationId: supervisorAssignment.organizationId,
      title: "Classroom integration and transition support",
      concern: request.concern,
      desiredOutcome: request.requestedSupport,
      status: "RESOLVED",
      createdAt: date(request.date),
      resolvedAt: date("2026-03-27T17:00:00.000Z"),
      updatedAt: date("2026-03-27T17:00:00.000Z"),
    } });
    await tx.caseSupportRequest.create({ data: {
      id: request.syntheticId,
      clientId: syntheticClientId,
      requesterId: providerByRole.get(request.requesterRole).providerId,
      recipientSupervisorId: providerByRole.get(request.recipientRole).providerId,
      linkedCaseId: caseId,
      organizationId: supervisorAssignment.organizationId,
      concern: request.concern,
      requestedSupport: request.requestedSupport,
      status: request.status,
      responseNote: "The request was acknowledged and a split-schedule implementation review was opened.",
      createdAt: date(request.date),
      updatedAt: date(coordination.date),
      acknowledgedAt: date(request.date),
      respondedAt: date(coordination.date),
      requesterViewedAt: date(coordination.date),
    } });
    await tx.caseSupportCoordination.create({ data: {
      id: coordination.syntheticId,
      caseId,
      authorId: providerByRole.get(coordination.authorRole).providerId,
      path: coordination.path,
      status: coordination.status,
      occurredAt: date(coordination.date),
      contactOrganization: "Synthetic school team",
      contactRole: "School program lead",
      communicationMethod: coordination.communicationMethod,
      actionTaken: coordination.actionTaken,
      requestOrDecision: coordination.requestOrDecision,
      nextStep: coordination.nextStep,
      createdAt: date(coordination.date),
    } });
    await tx.teamFocus.create({ data: {
      id: "maye-signal-lab-team-focus-2026-02-23",
      clientId: syntheticClientId,
      authorId: supervisorAssignment.providerId,
      title: "Classroom Integration",
      content: "Use the agreed split schedule, visual transition sequence, safe prompting boundaries, and gradually lengthened mainstream segments while the team reviews progress.",
      isActive: true,
      displayStartedAt: date(coordination.date),
      createdAt: date(coordination.date),
      updatedAt: date(coordination.date),
    } });
  }, { timeout: 120_000 });
}

async function main() {
  const { sourceClient, providerByRole } = await loadSource();
  const preview = {
    mode: writeEnabled ? "write" : "preview",
    sourceClient: `${sourceClient.firstName} ${sourceClient.lastName}`,
    targetClient: `${dataset.profile.client.firstName} ${dataset.profile.client.lastName}`,
    targetClientId: syntheticClientId,
    summary: dataset.summary,
  };
  console.log(JSON.stringify(preview, null, 2));
  if (!writeEnabled) return;
  await insertFixture(sourceClient, providerByRole);
  console.log("Maye Signal Lab imported without modifying the source client.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
