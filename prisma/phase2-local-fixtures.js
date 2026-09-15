/* eslint-disable @typescript-eslint/no-require-imports */
const { accessSync, constants } = require("node:fs");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { loadEnvConfig } = require("@next/env");
const { PrismaClient } = require("@prisma/client");

const FIXTURE_LABEL = "AUTCONNECT_PHASE2_LOCAL_FIXTURE_V1";
const EXPECTED_MIGRATION_COUNT = 45;

const ids = {
  leadOrganization: "10000000-0000-4000-8000-000000000201",
  schoolOrganization: "10000000-0000-4000-8000-000000000202",
  unrelatedOrganization: "10000000-0000-4000-8000-000000000203",
  client: "20000000-0000-4000-8000-000000000201",
  teamManager: "30000000-0000-4000-8000-000000000201",
  agencyProvider: "30000000-0000-4000-8000-000000000202",
  schoolAdmin: "30000000-0000-4000-8000-000000000203",
  schoolOccupationalTherapist: "30000000-0000-4000-8000-000000000204",
  schoolEducator: "30000000-0000-4000-8000-000000000205",
  schoolMember: "30000000-0000-4000-8000-000000000206",
  unrelatedProvider: "30000000-0000-4000-8000-000000000207",
  leadMembership: "40000000-0000-4000-8000-000000000201",
  agencyProviderMembership: "40000000-0000-4000-8000-000000000202",
  schoolAdminMembership: "40000000-0000-4000-8000-000000000203",
  schoolOccupationalTherapistMembership:
    "40000000-0000-4000-8000-000000000204",
  schoolEducatorMembership: "40000000-0000-4000-8000-000000000205",
  schoolMemberMembership: "40000000-0000-4000-8000-000000000206",
  unrelatedProviderMembership: "40000000-0000-4000-8000-000000000207",
  leadClientOrganization: "50000000-0000-4000-8000-000000000201",
  teamManagerAssignment: "60000000-0000-4000-8000-000000000201",
  agencyProviderAssignment: "60000000-0000-4000-8000-000000000202",
  teamManagerGrant: "70000000-0000-4000-8000-000000000201",
};

const organizations = [
  {
    id: ids.leadOrganization,
    name: "Fictional Phase 2 Local Test Lead Agency",
    normalizedName: "fictional phase 2 local test lead agency",
    type: "AGENCY",
  },
  {
    id: ids.schoolOrganization,
    name: "Fictional Phase 2 Local Test School",
    normalizedName: "fictional phase 2 local test school",
    type: "SCHOOL",
  },
  {
    id: ids.unrelatedOrganization,
    name: "Fictional Phase 2 Local Test Unrelated Organization",
    normalizedName: "fictional phase 2 local test unrelated organization",
    type: "AGENCY",
  },
];

const providers = [
  {
    id: ids.teamManager,
    email: "phase2-team-manager@example.test",
    firstName: "Fictional",
    lastName: "Phase 2 Team Manager",
    role: "Supervisor",
    providerRole: "Supervisor",
  },
  {
    id: ids.agencyProvider,
    email: "phase2-agency-provider@example.test",
    firstName: "Fictional",
    lastName: "Phase 2 Agency Provider",
    role: "BehaviorTherapist",
    providerRole: "Behavior Therapist",
  },
  {
    id: ids.schoolAdmin,
    email: "phase2-school-admin@example.test",
    firstName: "Fictional",
    lastName: "Phase 2 School Administrator",
    role: "Supervisor",
    providerRole: "Supervisor",
  },
  {
    id: ids.schoolOccupationalTherapist,
    email: "phase2-school-ot@example.test",
    firstName: "Fictional",
    lastName: "Phase 2 School Occupational Therapist",
    role: "OccupationalTherapist",
    providerRole: "Occupational Therapist",
  },
  {
    id: ids.schoolEducator,
    email: "phase2-school-educator@example.test",
    firstName: "Fictional",
    lastName: "Phase 2 School Educator",
    role: "Educator",
    providerRole: "Educator",
  },
  {
    id: ids.schoolMember,
    email: "phase2-school-member@example.test",
    firstName: "Fictional",
    lastName: "Phase 2 Unassigned School Member",
    role: "Supervisor",
    providerRole: "Supervisor",
  },
  {
    id: ids.unrelatedProvider,
    email: "phase2-unrelated-admin@example.test",
    firstName: "Fictional",
    lastName: "Phase 2 Unrelated Administrator",
    role: "Supervisor",
    providerRole: "Supervisor",
  },
];

const memberships = [
  [ids.leadMembership, ids.leadOrganization, ids.teamManager, "OWNER"],
  [
    ids.agencyProviderMembership,
    ids.leadOrganization,
    ids.agencyProvider,
    "MEMBER",
  ],
  [ids.schoolAdminMembership, ids.schoolOrganization, ids.schoolAdmin, "ADMIN"],
  [
    ids.schoolOccupationalTherapistMembership,
    ids.schoolOrganization,
    ids.schoolOccupationalTherapist,
    "MEMBER",
  ],
  [
    ids.schoolEducatorMembership,
    ids.schoolOrganization,
    ids.schoolEducator,
    "MEMBER",
  ],
  [
    ids.schoolMemberMembership,
    ids.schoolOrganization,
    ids.schoolMember,
    "MEMBER",
  ],
  [
    ids.unrelatedProviderMembership,
    ids.unrelatedOrganization,
    ids.unrelatedProvider,
    "ADMIN",
  ],
];

function assertDevelopmentOnly() {
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error(
      "Refusing Phase 2 fixtures unless NODE_ENV is explicitly development or test."
    );
  }
}

function loadAndVerifyConfiguredTarget() {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const parsed = new URL(process.env.DATABASE_URL);
  const host = parsed.hostname.toLowerCase();
  const port = parsed.port || "5432";
  const database = parsed.pathname.replace(/^\//, "").split("?")[0];
  const hostedMarker = /neon|vercel|supabase|railway|render|amazonaws|cloud/i;
  if (
    !["localhost", "127.0.0.1"].includes(host) ||
    hostedMarker.test(host) ||
    port !== "5432" ||
    database !== "autconnect"
  ) {
    throw new Error(
      "Refusing Phase 2 fixtures: target must be local autconnect on port 5432."
    );
  }
}

async function verifyConnectedTarget(db) {
  const identity = await db.$queryRawUnsafe(
    "select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port"
  );
  const migrationRows = await db.$queryRawUnsafe(
    'select count(*) filter (where finished_at is not null and rolled_back_at is null)::int as applied, count(*) filter (where finished_at is null and rolled_back_at is null)::int as incomplete from "_prisma_migrations"'
  );
  const server = identity[0];
  const migrations = migrationRows[0];
  if (
    server.database !== "autconnect" ||
    !["127.0.0.1/32", "::1/128"].includes(server.address) ||
    server.port !== 5432 ||
    migrations.applied !== EXPECTED_MIGRATION_COUNT ||
    migrations.incomplete !== 0
  ) {
    throw new Error(
      "Refusing Phase 2 fixtures: connected database identity or migration state is not authorized."
    );
  }
}

function ensureCredentialDeliveryAvailable() {
  if (process.platform !== "darwin") {
    throw new Error(
      "No safe local credential handoff is configured for this operating system."
    );
  }
  accessSync("/usr/bin/osascript", constants.X_OK);
}

function generatePassword() {
  return `${randomBytes(24).toString("base64url")}!aA7`;
}

function escapeAppleScript(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function presentCredentials(credentials) {
  const lines = [
    "AutConnect fictional local Phase 2 credentials",
    "",
    "These credentials exist only in the local autconnect database.",
    "Record them now; this dialog is the only handoff.",
    "",
    ...credentials.flatMap(({ label, email, password }) => [
      label,
      email,
      password,
      "",
    ]),
  ];
  const message = escapeAppleScript(lines.join("\\n"));
  const appleScript = `display dialog "${message}" with title "AutConnect Local Fixtures" buttons {"OK"} default button "OK" with icon note`;
  const child = spawn("/usr/bin/osascript", ["-"], {
    detached: true,
    stdio: ["pipe", "ignore", "ignore"],
  });
  child.stdin.end(appleScript);
  child.unref();
}

async function assertStableRecordOwnership(tx) {
  const [existingOrganizations, existingProviders, existingClients] =
    await Promise.all([
      tx.organization.findMany({
        where: { id: { in: organizations.map(({ id }) => id) } },
        select: { id: true, normalizedName: true },
      }),
      tx.provider.findMany({
        where: { id: { in: providers.map(({ id }) => id) } },
        select: { id: true, email: true },
      }),
      tx.client.findMany({
        where: { id: ids.client },
        select: { id: true, caseCode: true },
      }),
    ]);
  const expectedOrganizationNames = new Map(
    organizations.map(({ id, normalizedName }) => [id, normalizedName])
  );
  const expectedProviderEmails = new Map(
    providers.map(({ id, email }) => [id, email])
  );
  if (
    existingOrganizations.some(
      ({ id, normalizedName }) =>
        expectedOrganizationNames.get(id) !== normalizedName
    ) ||
    existingProviders.some(
      ({ id, email }) => expectedProviderEmails.get(id) !== email
    ) ||
    existingClients.some(
      ({ caseCode }) => caseCode !== "phase2-local-test-client-v1"
    )
  ) {
    throw new Error("Stable Phase 2 fixture identifier collision detected.");
  }
}

async function setupFixtures(db) {
  ensureCredentialDeliveryAvailable();
  const existingProviderIds = new Set(
    (
      await db.provider.findMany({
        where: { id: { in: providers.map(({ id }) => id) } },
        select: { id: true },
      })
    ).map(({ id }) => id)
  );
  const newCredentials = providers
    .filter(({ id }) => !existingProviderIds.has(id))
    .map((provider) => ({
      provider,
      label: provider.lastName,
      email: provider.email,
      password: generatePassword(),
    }));
  const passwordHashes = new Map(
    await Promise.all(
      newCredentials.map(async ({ provider, password }) => [
        provider.id,
        await bcrypt.hash(password, 12),
      ])
    )
  );

  const before = await aggregateCounts(db);
  await db.$transaction(async (tx) => {
    await assertStableRecordOwnership(tx);
    for (const organization of organizations) {
      await tx.organization.upsert({
        where: { id: organization.id },
        update: {},
        create: organization,
      });
    }
    for (const provider of providers) {
      await tx.provider.upsert({
        where: { id: provider.id },
        update: {},
        create: {
          ...provider,
          passwordHash: passwordHashes.get(provider.id),
          authType: "email",
          status: "ACTIVE",
        },
      });
    }
    await tx.client.upsert({
      where: { id: ids.client },
      update: {},
      create: {
        id: ids.client,
        caseCode: "phase2-local-test-client-v1",
        firstName: "Fictional",
        lastName: "Phase 2 Local Test Client",
        receivesPrescribedMedication: false,
      },
    });
    for (const [id, organizationId, providerId, role] of memberships) {
      await tx.organizationMembership.upsert({
        where: { id },
        update: {},
        create: { id, organizationId, providerId, role, active: true },
      });
    }
    await tx.clientOrganization.upsert({
      where: { id: ids.leadClientOrganization },
      update: {},
      create: {
        id: ids.leadClientOrganization,
        clientId: ids.client,
        organizationId: ids.leadOrganization,
        role: "LEAD",
        status: "ACTIVE",
        requestedById: ids.teamManager,
        approvedById: ids.teamManager,
        activatedAt: new Date(),
      },
    });
    await tx.providerClient.upsert({
      where: { id: ids.teamManagerAssignment },
      update: {},
      create: {
        id: ids.teamManagerAssignment,
        providerId: ids.teamManager,
        clientId: ids.client,
        organizationId: ids.leadOrganization,
        role: "Supervisor",
        assignedById: ids.teamManager,
      },
    });
    await tx.providerClient.upsert({
      where: { id: ids.agencyProviderAssignment },
      update: {},
      create: {
        id: ids.agencyProviderAssignment,
        providerId: ids.agencyProvider,
        clientId: ids.client,
        organizationId: ids.leadOrganization,
        role: "BehaviorTherapist",
        assignedById: ids.teamManager,
      },
    });
    await tx.clientTeamManager.upsert({
      where: { id: ids.teamManagerGrant },
      update: {},
      create: {
        id: ids.teamManagerGrant,
        clientId: ids.client,
        providerId: ids.teamManager,
        grantedById: ids.teamManager,
      },
    });
  });

  const after = await aggregateCounts(db);
  const state = await fixtureState(db);
  if (newCredentials.length) {
    presentCredentials(
      newCredentials.map(({ label, email, password }) => ({
        label,
        email,
        password,
      }))
    );
  }
  console.log(
    JSON.stringify(
      {
        fixtureLabel: FIXTURE_LABEL,
        created: subtractCounts(after, before),
        fixtureCounts: state.counts,
        isolation: state.isolation,
        existingNonfixtureCountsReduced: false,
        credentials: newCredentials.length
          ? "Shown only in a native local dialog."
          : "Existing fixture credentials were not changed or displayed.",
      },
      null,
      2
    )
  );
}

async function cleanupFixtures(db) {
  const fixtureProviderIds = providers.map(({ id }) => id);
  await db.$transaction(async (tx) => {
    await assertStableRecordOwnership(tx);
    const protectedRecords = await Promise.all([
      tx.entry.count({
        where: {
          OR: [
            { clientId: ids.client },
            { providerId: { in: fixtureProviderIds } },
          ],
        },
      }),
      tx.goalDefinition.count({
        where: {
          OR: [
            { clientId: ids.client },
            { providerId: { in: fixtureProviderIds } },
          ],
        },
      }),
      tx.fieldObservation.count({ where: { clientId: ids.client } }),
    ]);
    if (protectedRecords.some((count) => count > 0)) {
      throw new Error(
        "Cleanup refused because fixture identities have historical or clinical records."
      );
    }
    await tx.clientTeamAuditEvent.deleteMany({ where: { clientId: ids.client } });
    await tx.clientTeamManager.deleteMany({ where: { clientId: ids.client } });
    await tx.providerClient.deleteMany({ where: { clientId: ids.client } });
    await tx.clientOrganization.deleteMany({ where: { clientId: ids.client } });
    await tx.organizationMembership.deleteMany({
      where: { id: { in: memberships.map(([id]) => id) } },
    });
    await tx.client.deleteMany({ where: { id: ids.client } });
    await tx.provider.deleteMany({ where: { id: { in: fixtureProviderIds } } });
    await tx.organization.deleteMany({
      where: { id: { in: organizations.map(({ id }) => id) } },
    });
  });
  console.log(
    JSON.stringify({ fixtureLabel: FIXTURE_LABEL, removed: true }, null, 2)
  );
}

async function aggregateCounts(db) {
  const [providersCount, clients, organizationsCount, membershipsCount, assignments] =
    await Promise.all([
      db.provider.count(),
      db.client.count(),
      db.organization.count(),
      db.organizationMembership.count(),
      db.providerClient.count(),
    ]);
  return {
    providers: providersCount,
    clients,
    organizations: organizationsCount,
    memberships: membershipsCount,
    assignments,
  };
}

function subtractCounts(after, before) {
  return Object.fromEntries(
    Object.keys(after).map((key) => [key, after[key] - before[key]])
  );
}

async function fixtureState(db) {
  const providerIds = providers.map(({ id }) => id);
  const organizationIds = organizations.map(({ id }) => id);
  const [
    providerCount,
    clientCount,
    organizationCount,
    membershipCount,
    assignmentCount,
    clientOrganizationCount,
    managerCount,
    schoolRelationshipCount,
    schoolProviderAssignmentCount,
    schoolAdminAssignmentCount,
    unrelatedAssignmentCount,
  ] = await Promise.all([
    db.provider.count({ where: { id: { in: providerIds } } }),
    db.client.count({ where: { id: ids.client } }),
    db.organization.count({ where: { id: { in: organizationIds } } }),
    db.organizationMembership.count({
      where: { id: { in: memberships.map(([id]) => id) } },
    }),
    db.providerClient.count({ where: { clientId: ids.client } }),
    db.clientOrganization.count({ where: { clientId: ids.client } }),
    db.clientTeamManager.count({
      where: { clientId: ids.client, providerId: ids.teamManager, revokedAt: null },
    }),
    db.clientOrganization.count({
      where: { clientId: ids.client, organizationId: ids.schoolOrganization },
    }),
    db.providerClient.count({
      where: {
        clientId: ids.client,
        providerId: {
          in: [ids.schoolOccupationalTherapist, ids.schoolEducator],
        },
        revokedAt: null,
      },
    }),
    db.providerClient.count({
      where: { clientId: ids.client, providerId: ids.schoolAdmin, revokedAt: null },
    }),
    db.providerClient.count({
      where: { clientId: ids.client, providerId: ids.unrelatedProvider, revokedAt: null },
    }),
  ]);
  return {
    counts: {
      providers: providerCount,
      clients: clientCount,
      organizations: organizationCount,
      memberships: membershipCount,
      assignments: assignmentCount,
      clientOrganizations: clientOrganizationCount,
      teamManagers: managerCount,
    },
    isolation: {
      teamManagerRelationshipExists: managerCount === 1,
      schoolHasNoClientOrganization: schoolRelationshipCount === 0,
      schoolProvidersUnassigned: schoolProviderAssignmentCount === 0,
      schoolAdministratorWithoutClientAccess: schoolAdminAssignmentCount === 0,
      unrelatedOrganizationAndProviderOutsideClient:
        unrelatedAssignmentCount === 0,
    },
  };
}

async function main() {
  assertDevelopmentOnly();
  loadAndVerifyConfiguredTarget();
  const db = new PrismaClient();
  try {
    await verifyConnectedTarget(db);
    if (process.argv.includes("--cleanup")) {
      await cleanupFixtures(db);
    } else {
      await setupFixtures(db);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Fixture command failed.");
  process.exitCode = 1;
});
