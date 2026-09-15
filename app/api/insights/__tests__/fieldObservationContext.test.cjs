/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

let fieldObservationQuery = null;
const allObservations = [
  {
    id: "observation-client-1",
    clientId: "client-1",
    observedAt: new Date("2026-08-10T17:00:00.000Z"),
    createdAt: new Date("2026-08-10T18:00:00.000Z"),
    setting: "SCHOOL",
    durationMinutes: 45,
    observedProviderId: "educator-1",
    observedProviderRole: "Educator",
    rubricVersion: "1.0",
    fidelityPercent: 75,
    applicableItemCount: 8,
    strengths: "Prepared visual materials.",
    coachingFocus: "Fade prompts.",
    followUp: "Review next month.",
    observedProvider: { firstName: "Casey", lastName: "Sch" },
    supervisor: { firstName: "Erin", lastName: "Arr" },
    items: [
      {
        criterionKey: "prompting_and_independence",
        criterionLabel: "Prompting and independence",
        rating: "PARTIALLY_IMPLEMENTED",
        displayOrder: 3,
        note: "Prompts were not consistently faded.",
      },
    ],
  },
  {
    id: "observation-client-2",
    clientId: "client-2",
    observedAt: new Date("2026-08-11T17:00:00.000Z"),
    createdAt: new Date("2026-08-11T18:00:00.000Z"),
    setting: "CLINIC",
    durationMinutes: 30,
    observedProviderId: "provider-other",
    observedProviderRole: "BehaviorTherapist",
    rubricVersion: "1.0",
    fidelityPercent: 100,
    applicableItemCount: 8,
    strengths: "Cross-client record",
    coachingFocus: null,
    followUp: null,
    observedProvider: { firstName: "Other", lastName: "Provider" },
    supervisor: { firstName: "Other", lastName: "Supervisor" },
    items: [],
  },
];

const db = {
  client: {
    findUnique: async ({ where }) =>
      where.id === "client-1"
        ? {
            id: "client-1",
            firstName: "Test",
            lastName: "Client",
            dateOfBirth: null,
            diagnosis: null,
          }
        : null,
  },
  providerClient: { findMany: async () => [] },
  goalDefinition: { findMany: async () => [] },
  entry: { findMany: async () => [] },
  teamFocus: { findFirst: async () => null },
  fieldObservation: {
    findMany: async (query) => {
      fieldObservationQuery = query;
      return allObservations.filter(
        (observation) => observation.clientId === query.where.clientId
      );
    },
  },
};

const emptyArray = () => [];
const modelStubs = {
  buildNormalizedSessionsWithSignals: emptyArray,
  buildProviderGoalSeries: emptyArray,
  buildProviderDomainSeries: emptyArray,
  buildPerformanceTrends: emptyArray,
  buildRelationshipMetrics: () => ({ providerPairs: [], providerCoverage: [] }),
  buildGoalRelationships: emptyArray,
  buildProviderRelationships: emptyArray,
  buildProviderOverlap: emptyArray,
  buildDomainRelationships: emptyArray,
  buildBehaviorRelationships: emptyArray,
  buildCollaborationMetrics: () => ({}),
  buildContinuityMetrics: () => ({}),
  buildClinicalPicture: () => ({}),
  buildRelationshipSummary: () => ({}),
  buildClientSignalScore: () => ({}),
  buildDomainContributions: emptyArray,
  buildQuestionContributors: emptyArray,
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@/lib/db") return { db };
  if (request === "@/app/libs/teamFocusLifecycle") {
    return { isTeamFocusVisible: () => false };
  }
  if (request === "./insightContextModel") return modelStubs;
  return originalLoad.call(this, request, parent, isMain);
};
const { buildInsightContext } = require("../insightContext.ts");
Module._load = originalLoad;

test("Field Observation context is client-specific and preserves structured evidence", async () => {
  const context = await buildInsightContext(
    "client-1",
    { intent: "summary" },
    { category: "providers", viewerProviderId: "supervisor-1" }
  );

  assert.deepEqual(fieldObservationQuery.where, { clientId: "client-1" });
  assert.deepEqual(fieldObservationQuery.orderBy, [
    { observedAt: "desc" },
    { createdAt: "desc" },
  ]);
  assert.equal(context.fieldObservations.length, 1);
  assert.equal(context.fieldObservations[0].id, "observation-client-1");
  assert.equal(context.fieldObservations[0].observedProvider.id, "educator-1");
  assert.equal(context.fieldObservations[0].observedProvider.name, "Casey S.");
  assert.equal(context.fieldObservations[0].observedProvider.role, "Educator");
  assert.equal(context.fieldObservations[0].supervisor.name, "Erin A.");
  assert.equal(context.fieldObservations[0].items[0].rating, "PARTIALLY_IMPLEMENTED");
  assert.equal(
    context.fieldObservations[0].items[0].note,
    "Prompts were not consistently faded."
  );
  assert.equal(context.fieldObservations[0].coachingFocus, "Fade prompts.");
  assert.equal(
    context.fieldObservations.some((observation) => observation.id === "observation-client-2"),
    false
  );
});
