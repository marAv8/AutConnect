/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { buildSuDoTimeline } = require("./synthetic/sudoTimeline");

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();
const dataset = buildSuDoTimeline();
const writeEnabled = process.argv.includes("--write");
const refreshEntries = process.argv.includes("--refresh-entries");
const sourceClientId = argumentValue("--source-client-id");
const syntheticClientId = "synthetic-client-sudo-signal-lab-v1";

function argumentValue(name) {
  const prefix = `${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length) ?? null;
}

function date(value) {
  return new Date(value);
}

function uniqueProviderByRole(assignments) {
  const providers = new Map();
  for (const assignment of assignments) {
    if (providers.has(assignment.role)) {
      throw new Error(
        `Source client has more than one ${assignment.role} assignment; explicit provider mapping is required.`
      );
    }
    providers.set(assignment.role, assignment);
  }
  return providers;
}

function idPart(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function finalScore(items) {
  const scores = items
    .map((item) => item.score)
    .filter((value) => typeof value === "number");
  if (scores.length === 0) return null;
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return Math.max(1, Math.min(10, Math.round((average / 4) * 10)));
}

function goalId(goal) {
  return `sudo-signal-lab-goal-${idPart(goal.syntheticKey)}`;
}

function entryData(record, providerByRole, goalIdByKey) {
  const providerId = providerByRole.get(record.role)?.providerId;
  if (!providerId) throw new Error(`No provider assignment for ${record.role}.`);

  return {
    id: record.syntheticId,
    providerId,
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
    items: {
      create: record.items.map((item, index) => ({
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
      })),
    },
    abcObservations: {
      create: record.abcObservations.map((observation, index) => ({
        id: `${record.syntheticId}-abc-${index + 1}`,
        antecedent: observation.antecedent,
        behavior: observation.behavior,
        consequence: observation.consequence,
        createdAt: date(record.date),
      })),
    },
  };
}

async function inspectSourceClient() {
  if (!sourceClientId) {
    throw new Error("Provide --source-client-id=<id> so provider assignments can be copied safely.");
  }

  const sourceClient = await prisma.client.findUnique({
    where: { id: sourceClientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      receivesPrescribedMedication: true,
      providerClients: {
        select: {
          providerId: true,
          organizationId: true,
          role: true,
          provider: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!sourceClient) throw new Error(`Source client ${sourceClientId} was not found.`);

  const providerByRole = uniqueProviderByRole(sourceClient.providerClients);
  for (const required of dataset.profile.providers) {
    if (!providerByRole.has(required.role)) {
      throw new Error(`Source client is missing the required ${required.role} assignment.`);
    }
  }

  return { sourceClient, providerByRole };
}

async function insertFixture(sourceClient, providerByRole) {
  const existing = await prisma.client.findUnique({
    where: { id: syntheticClientId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (existing) {
    throw new Error(
      `Synthetic client ${existing.firstName} ${existing.lastName} already exists. Refusing to overwrite it.`
    );
  }

  const goalIdByKey = new Map(
    dataset.goalDefinitions.map((goal) => [goal.syntheticKey, goalId(goal)])
  );
  const entryRecords = dataset.sourceRecords.filter((record) => record.recordType === "entry");
  const caseRecord = dataset.sourceRecords.find((record) => record.recordType === "caseSupportCase");
  const requestRecord = dataset.sourceRecords.find(
    (record) => record.recordType === "caseSupportRequest"
  );
  const caseEntryRecords = dataset.sourceRecords.filter(
    (record) => record.recordType === "caseSupportEntry"
  );
  const coordinationRecords = dataset.sourceRecords.filter(
    (record) => record.recordType === "caseSupportCoordination"
  );
  const supervisorId = providerByRole.get("Supervisor").providerId;

  await prisma.$transaction(
    async (tx) => {
      await tx.client.create({
        data: {
          id: syntheticClientId,
          firstName: sourceClient.firstName,
          lastName: "Signal Lab",
          dateOfBirth: sourceClient.dateOfBirth,
          diagnosis: dataset.profile.client.description,
          receivesPrescribedMedication: sourceClient.receivesPrescribedMedication,
          createdAt: date(`${dataset.profile.dateRange.start}T17:00:00.000Z`),
        },
      });

      for (const assignment of sourceClient.providerClients) {
        await tx.providerClient.create({
          data: {
            id: `sudo-signal-lab-assignment-${idPart(assignment.role)}`,
            providerId: assignment.providerId,
            clientId: syntheticClientId,
            organizationId: assignment.organizationId,
            role: assignment.role,
          },
        });
      }

      for (const goal of dataset.goalDefinitions) {
        await tx.goalDefinition.create({
          data: {
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
          },
        });
      }

      for (const record of entryRecords) {
        await tx.entry.create({ data: entryData(record, providerByRole, goalIdByKey) });
      }

      if (!caseRecord || !requestRecord) {
        throw new Error("Fixture is missing its case or originating request record.");
      }

      const caseId = caseRecord.syntheticId;
      await tx.caseSupportCase.create({
        data: {
          id: caseId,
          clientId: syntheticClientId,
          ownerSupervisorId: supervisorId,
          organizationId: providerByRole.get("Supervisor").organizationId,
          title: caseRecord.title,
          concern: caseRecord.concern,
          desiredOutcome: caseRecord.desiredOutcome,
          status: caseRecord.status,
          createdAt: date(caseRecord.date),
          updatedAt: date(caseRecord.resolvedAt),
          resolvedAt: date(caseRecord.resolvedAt),
        },
      });

      await tx.caseSupportRequest.create({
        data: {
          id: requestRecord.syntheticId,
          clientId: syntheticClientId,
          requesterId: providerByRole.get(requestRecord.requesterRole).providerId,
          recipientSupervisorId: providerByRole.get(requestRecord.recipientRole).providerId,
          linkedCaseId: caseId,
          organizationId: providerByRole.get("Supervisor").organizationId,
          concern: requestRecord.concern,
          requestedSupport: requestRecord.requestedSupport,
          status: requestRecord.status,
          responseNote: "Supervisor acknowledged the concern and opened a coordination case.",
          createdAt: date(requestRecord.date),
          updatedAt: date(caseRecord.date),
          acknowledgedAt: date(caseRecord.date),
          respondedAt: date(caseRecord.date),
        },
      });

      for (const record of caseEntryRecords) {
        await tx.caseSupportEntry.create({
          data: {
            id: record.syntheticId,
            caseId,
            authorId: providerByRole.get(record.authorRole).providerId,
            entryType: "PROVIDER_ACCOUNT",
            occurredAt: date(record.date),
            requestSource: "CLASSROOM_STAFF",
            requestedBy: "Classroom staff",
            coverageStatus: record.coverageStatus,
            durationMinutes: 45,
            scheduleImpacts: record.scheduleImpacts,
            whatOccurred: record.whatOccurred,
            supportProvided: record.supportProvided,
            observableOutcome: record.observableOutcome,
            followUp: "Supervisor review and role clarification requested.",
            createdAt: date(record.date),
          },
        });
      }

      for (const record of coordinationRecords) {
        await tx.caseSupportCoordination.create({
          data: {
            id: record.syntheticId,
            caseId,
            authorId: providerByRole.get(record.authorRole).providerId,
            path: record.path,
            status: record.status,
            occurredAt: date(record.date),
            contactOrganization:
              record.path === "EXTERNAL" ? "Synthetic school special-education team" : null,
            contactRole: record.path === "EXTERNAL" ? "Special-education lead" : null,
            communicationMethod: record.communicationMethod,
            actionTaken: record.actionTaken,
            requestOrDecision: record.requestOrDecision,
            nextStep: record.nextStep,
            createdAt: date(record.date),
          },
        });
      }
    },
    { timeout: 120_000 }
  );
}

async function refreshFixtureEntries(providerByRole) {
  const existing = await prisma.client.findUnique({
    where: { id: syntheticClientId },
    select: {
      id: true,
      diagnosis: true,
      entries: { select: { id: true } },
      goalDefinitions: { select: { id: true } },
    },
  });
  if (!existing || existing.diagnosis !== dataset.profile.client.description) {
    throw new Error("The guarded Signal Lab fixture was not found; refusing to refresh entries.");
  }
  if (existing.entries.some((entry) => !entry.id.startsWith("sudo-"))) {
    throw new Error("Signal Lab contains a non-fixture entry; refusing to replace its entry history.");
  }

  const expectedGoalIds = new Set(dataset.goalDefinitions.map((goal) => goalId(goal)));
  if (existing.goalDefinitions.some((goal) => !expectedGoalIds.has(goal.id))) {
    throw new Error("Signal Lab contains a non-fixture goal; refusing to refresh entries.");
  }

  const goalIdByKey = new Map(
    dataset.goalDefinitions.map((goal) => [goal.syntheticKey, goalId(goal)])
  );
  const entryRecords = dataset.sourceRecords.filter((record) => record.recordType === "entry");

  await prisma.$transaction(
    async (tx) => {
      await tx.entry.deleteMany({ where: { clientId: syntheticClientId } });
      for (const record of entryRecords) {
        await tx.entry.create({ data: entryData(record, providerByRole, goalIdByKey) });
      }
    },
    { timeout: 120_000 }
  );
}

async function verifyFixture() {
  const client = await prisma.client.findUnique({
    where: { id: syntheticClientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      providerClients: { select: { role: true } },
      goalDefinitions: { select: { id: true } },
      entries: {
        select: {
          id: true,
          abcObservations: { select: { id: true } },
          items: { select: { id: true } },
        },
      },
      caseSupportCases: {
        select: {
          id: true,
          entries: { select: { id: true } },
          coordinations: { select: { id: true } },
        },
      },
      caseSupportRequests: { select: { id: true } },
    },
  });

  if (!client) return { exists: false };
  return {
    exists: true,
    client: `${client.firstName} ${client.lastName}`,
    clientId: client.id,
    providerAssignments: client.providerClients.length,
    goals: client.goalDefinitions.length,
    entries: client.entries.length,
    assessmentItems: client.entries.reduce((count, entry) => count + entry.items.length, 0),
    abcObservations: client.entries.reduce(
      (count, entry) => count + entry.abcObservations.length,
      0
    ),
    cases: client.caseSupportCases.length,
    caseEntries: client.caseSupportCases.reduce(
      (count, caseItem) => count + caseItem.entries.length,
      0
    ),
    coordinations: client.caseSupportCases.reduce(
      (count, caseItem) => count + caseItem.coordinations.length,
      0
    ),
    requests: client.caseSupportRequests.length,
  };
}

async function main() {
  const { sourceClient, providerByRole } = await inspectSourceClient();
  const preview = {
    mode: writeEnabled ? (refreshEntries ? "refresh-entries" : "write") : "preview",
    sourceClient: `${sourceClient.firstName} ${sourceClient.lastName}`,
    sourceClientId: sourceClient.id,
    syntheticClient: `${sourceClient.firstName} Signal Lab`,
    syntheticClientId,
    providers: Array.from(providerByRole.entries()).map(([role, assignment]) => ({
      role,
      provider: `${assignment.provider.firstName} ${assignment.provider.lastName}`,
    })),
    fixture: dataset.summary,
  };

  if (!writeEnabled) {
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  if (refreshEntries) await refreshFixtureEntries(providerByRole);
  else await insertFixture(sourceClient, providerByRole);
  console.log(JSON.stringify({ ...preview, verification: await verifyFixture() }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
