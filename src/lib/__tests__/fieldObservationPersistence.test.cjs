/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const originalTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  createFieldObservationRecord,
  getFieldObservationsForClient,
} = require(path.join(
  process.cwd(),
  "src/lib/fieldObservationPersistence.ts",
));
const { FIELD_OBSERVATION_RUBRIC } = require(path.join(
  process.cwd(),
  "src/lib/fieldObservation.ts",
));

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

function validInput() {
  return {
    clientId: "client-1",
    observedProviderId: "provider-1",
    observedAt: new Date(Date.now() - 60_000),
    setting: "SCHOOL",
    durationMinutes: 45,
    strengths: "  Calm preparation  ",
    coachingFocus: "Prompt fading",
    followUp: "Review next week",
    items: FIELD_OBSERVATION_RUBRIC.map((criterion) => ({
      criterionKey: criterion.key,
      rating: "IMPLEMENTED",
      note: `Note for ${criterion.key}`,
    })),
  };
}

function createMockDb(options = {}) {
  const calls = { create: [], findMany: [] };
  const db = {
    providerClient: {
      async findFirst({ where }) {
        if (where.role === "Supervisor") {
          return options.supervisorAssigned === false ? null : { id: "spc-1" };
        }
        return options.observedProviderAssigned === false
          ? null
          : { id: "ppc-1", role: options.observedProviderRole ?? "BehaviorTherapist" };
      },
    },
    fieldObservation: {
      async create(args) {
        calls.create.push(args);
        return { id: "observation-1", ...args.data };
      },
      async findMany(args) {
        calls.findMany.push(args);
        return [{ id: "observation-1" }];
      },
    },
  };
  return { db, calls };
}

test("creates an observation with authoritative assignment data and rubric snapshots", async () => {
  const { db, calls } = createMockDb();
  const result = await createFieldObservationRecord(
    db,
    "supervisor-1",
    validInput(),
  );

  assert.equal(result.id, "observation-1");
  assert.equal(calls.create.length, 1);
  const data = calls.create[0].data;
  assert.equal(data.observedProviderRole, "BehaviorTherapist");
  assert.equal(data.fidelityPercent, 100);
  assert.equal(data.applicableItemCount, 8);
  assert.equal(data.strengths, "Calm preparation");
  assert.equal(data.items.create.length, FIELD_OBSERVATION_RUBRIC.length);
  assert.deepEqual(
    data.items.create.map((item) => item.displayOrder),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
});

test("persists a partial eight-item snapshot and consolidated summary", async () => {
  const { db, calls } = createMockDb();
  const input = validInput();
  input.strengths = null;
  input.coachingFocus = "  Continue prompt fading and review next week.  ";
  input.followUp = null;
  input.items = FIELD_OBSERVATION_RUBRIC.map((criterion, index) => ({
    criterionKey: criterion.key,
    rating: index === 0 ? "IMPLEMENTED" : "NOT_OBSERVED",
    note: null,
  }));

  await createFieldObservationRecord(db, "supervisor-1", input);

  const data = calls.create[0].data;
  assert.equal(data.fidelityPercent, 100);
  assert.equal(data.applicableItemCount, 1);
  assert.equal(data.coachingFocus, "Continue prompt fading and review next week.");
  assert.equal(data.strengths, null);
  assert.equal(data.followUp, null);
  assert.equal(data.items.create.length, 8);
  assert.deepEqual(
    data.items.create.map((item) => item.rating),
    ["IMPLEMENTED", ...Array(7).fill("NOT_OBSERVED")],
  );
  assert.ok(data.items.create.every((item) => item.note === null));
});

test("rejects creation when either provider assignment is invalid", async () => {
  const supervisorMissing = createMockDb({ supervisorAssigned: false });
  await assert.rejects(
    () =>
      createFieldObservationRecord(
        supervisorMissing.db,
        "supervisor-1",
        validInput(),
      ),
    /supervisor is not assigned/,
  );
  assert.equal(supervisorMissing.calls.create.length, 0);

  const providerMissing = createMockDb({ observedProviderAssigned: false });
  await assert.rejects(
    () =>
      createFieldObservationRecord(
        providerMissing.db,
        "supervisor-1",
        validInput(),
      ),
    /observed provider is not assigned/,
  );
  assert.equal(providerMissing.calls.create.length, 0);
});

test("rejects an assigned provider whose role is not eligible", async () => {
  const { db, calls } = createMockDb({ observedProviderRole: "Caregiver" });
  await assert.rejects(
    () => createFieldObservationRecord(db, "supervisor-1", validInput()),
    /not eligible/,
  );
  assert.equal(calls.create.length, 0);
});

test("retrieves a bounded client history only for an assigned supervisor", async () => {
  const allowed = createMockDb();
  const records = await getFieldObservationsForClient(
    allowed.db,
    "supervisor-1",
    "client-1",
  );
  assert.equal(records.length, 1);
  assert.equal(allowed.calls.findMany[0].where.clientId, "client-1");
  assert.equal(allowed.calls.findMany[0].take, 100);

  const denied = createMockDb({ supervisorAssigned: false });
  await assert.rejects(
    () =>
      getFieldObservationsForClient(
        denied.db,
        "supervisor-1",
        "client-1",
      ),
    /supervisor is not assigned/,
  );
  assert.equal(denied.calls.findMany.length, 0);
});
