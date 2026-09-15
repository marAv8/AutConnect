/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const originalTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

let currentSession;
let state;

function freshState(overrides = {}) {
  const calls = {
    assignment: [],
    entryFind: [],
    entryUpsert: [],
    entryUpdate: [],
    goalFindMany: [],
    goalFindFirst: [],
    goalCreate: [],
    entryReadDelete: [],
    entryReadCreate: [],
    entryReadUpdate: [],
    revisions: [],
    reconcile: [],
    revalidate: [],
  };
  return {
    assignedClientId: "client-a",
    assignmentRole: "BehaviorTherapist",
    scopedGoals: new Map([
      [
        "goal-a",
        {
          id: "goal-a",
          clientId: "client-a",
          providerId: "provider-a",
          isActive: true,
          isMastered: false,
          metricType: "Percentage",
          domain: "Other",
          targetValue: null,
          comparison: null,
          weight: 1,
        },
      ],
    ]),
    existingEntry: null,
    assignedProviderIds: ["provider-a", "provider-b"],
    statusAfterSave: "IN_PROGRESS",
    calls,
    ...overrides,
  };
}

const db = {
  providerClient: {
    async findFirst(args) {
      state.calls.assignment.push(args);
      return args.where.providerId === "provider-a" &&
        args.where.clientId === state.assignedClientId
        ? { id: "assignment-a", role: state.assignmentRole }
        : null;
    },
    async findMany() {
      return state.assignedProviderIds.map((providerId) => ({ providerId }));
    },
  },
  entry: {
    async findUnique(args) {
      state.calls.entryFind.push(args);
      return state.existingEntry;
    },
    async upsert(args) {
      state.calls.entryUpsert.push(args);
      return { id: "entry-a" };
    },
    async update(args) {
      state.calls.entryUpdate.push(args);
      return { id: "entry-a" };
    },
  },
  goalDefinition: {
    async findMany(args) {
      state.calls.goalFindMany.push(args);
      return (args.where.id?.in ?? [])
        .map((id) => state.scopedGoals.get(id))
        .filter(
          (goal) =>
            goal &&
            (!args.where.clientId || goal.clientId === args.where.clientId) &&
            (!args.where.providerId || goal.providerId === args.where.providerId) &&
            (args.where.isActive === undefined ||
              goal.isActive === args.where.isActive) &&
            (args.where.isMastered === undefined ||
              goal.isMastered === args.where.isMastered),
        );
    },
    async findFirst(args) {
      state.calls.goalFindFirst.push(args);
      return state.scopedGoals.get("goal-a") ?? null;
    },
    async create(args) {
      state.calls.goalCreate.push(args);
      return { id: "goal-created" };
    },
  },
  entryRead: {
    async deleteMany(args) {
      state.calls.entryReadDelete.push(args);
      return { count: 0 };
    },
    async createMany(args) {
      state.calls.entryReadCreate.push(args);
      return { count: args.data.length };
    },
    async updateMany(args) {
      state.calls.entryReadUpdate.push(args);
      return { count: 1 };
    },
  },
  async $transaction(input) {
    if (Array.isArray(input)) return Promise.all(input);
    return input(db);
  },
};

const originalLoad = Module._load;
Module._load = function loadWithActionMocks(request, parent, isMain) {
  if (request === "@/lib/db") return { db };
  if (request === "@/lib/session") {
    return { getSession: async () => currentSession };
  }
  if (request === "@/app/libs/schemas/entry") {
    return {
      createEntrySchema: {
        safeParse: (data) => ({ success: true, data }),
      },
    };
  }
  if (request === "@/app/libs/entryItems") {
    return {
      parseAssessmentItems: (value) =>
        typeof value === "string" ? JSON.parse(value) : [],
    };
  }
  if (request === "@/lib/sessionScoring") {
    return { calculateSessionScore: () => ({ finalScore: 75 }) };
  }
  if (request === "@/app/libs/entryRevision") {
    return {
      ensureEntryRevision: async (...args) => {
        state.calls.revisions.push(args);
        return { created: false };
      },
    };
  }
  if (request === "@/app/libs/entryLifecycle") {
    return { statusAfterEntrySave: () => state.statusAfterSave };
  }
  if (request === "@/app/libs/entryReadState") {
    return require(path.join(process.cwd(), "app/libs/entryReadState.ts"));
  }
  if (request === "@/app/libs/mastery/masteryPersistence") {
    return {
      reconcileMasteryForCompletedGoals: async (input) => {
        state.calls.reconcile.push(input);
      },
    };
  }
  if (request === "@/app/libs/professionTemplates") {
    return {
      getProfessionTemplate: () => ({
        targets: [
          {
            value: "Fictional target",
            defaultDomain: "Other",
            direction: "higherIsBetter",
          },
        ],
      }),
    };
  }
  if (request === "next/cache") {
    return {
      revalidatePath: (value) => state.calls.revalidate.push(value),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { createEntry } = require(path.join(process.cwd(), "app/actions/createEntry.ts"));
const { updateOwnEntry } = require(
  path.join(process.cwd(), "app/actions/updateOwnEntry.ts"),
);
const { createAbcData } = require(
  path.join(process.cwd(), "app/actions/createAbcData.ts"),
);
const { createEducatorTarget } = require(
  path.join(process.cwd(), "app/actions/createEducatorTarget.ts"),
);
Module._load = originalLoad;

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test.beforeEach(() => {
  currentSession = { providerId: "provider-a", role: "BehaviorTherapist" };
  state = freshState();
});

function entryForm({ clientId = "client-a", goalId = "goal-a" } = {}) {
  const formData = new FormData();
  formData.set("clientId", clientId);
  formData.set("kind", "SessionNote");
  formData.set("note", "Fictional authorized note");
  formData.set(
    "items",
    JSON.stringify([
      {
        goalId,
        target: "Fictional target",
        goal: "Fictional goal",
        score: 75,
        metricType: "Percentage",
        domain: "Other",
        rawValue: 75,
        supportLevel: null,
        observation: "Fictional observation",
      },
    ]),
  );
  return formData;
}

function formForKind(kind, withItems) {
  const formData = new FormData();
  formData.set("clientId", "client-a");
  formData.set("kind", kind);
  formData.set("note", "Fictional authorized note");
  if (withItems) {
    formData.set("items", entryForm().get("items"));
  } else {
    formData.set("items", "[]");
    formData.set("contextData", JSON.stringify({ fictional: true }));
  }
  return formData;
}

function assertNoWriteOrSideEffect() {
  assert.equal(state.calls.entryUpsert.length, 0);
  assert.equal(state.calls.entryUpdate.length, 0);
  assert.equal(state.calls.goalCreate.length, 0);
  assert.equal(state.calls.entryReadDelete.length, 0);
  assert.equal(state.calls.entryReadCreate.length, 0);
  assert.equal(state.calls.entryReadUpdate.length, 0);
  assert.equal(state.calls.reconcile.length, 0);
  assert.equal(state.calls.revalidate.length, 0);
}

function scopedGoal(overrides = {}) {
  return {
    id: "goal-a",
    clientId: "client-a",
    providerId: "provider-a",
    isActive: true,
    isMastered: false,
    metricType: "Percentage",
    domain: "Other",
    targetValue: null,
    comparison: null,
    weight: 1,
    ...overrides,
  };
}

function canonicalEntry(goalIds = ["goal-a"]) {
  return {
    id: "entry-a",
    status: "IN_PROGRESS",
    completedAt: null,
    items: goalIds.map((goalId) => ({ goalId })),
    _count: { revisions: 0 },
  };
}

test("an active non-mastered scoped goal can be newly attached without changing the response", async () => {
  const result = await createEntry(entryForm());

  assert.deepEqual(result, {
    ok: true,
    entryId: "entry-a",
    visibility: "Shared",
    status: "IN_PROGRESS",
  });
  assert.equal(state.calls.entryUpsert.length, 1);
  assert.deepEqual(
    state.calls.entryUpsert[0].where.providerId_clientId_date_kind,
    {
      providerId: "provider-a",
      clientId: "client-a",
      date: state.calls.entryUpsert[0].create.date,
      kind: "SessionNote",
    },
  );
  assert.equal(state.calls.entryUpsert[0].create.clientId, "client-a");
  const createdItem = state.calls.entryUpsert[0].create.items.create[0];
  assert.equal(createdItem.goalId, "goal-a");
  assert.equal(createdItem.score, 75);
  assert.equal(createdItem.rawValue, 75);
  assert.equal(createdItem.observation, "Fictional observation");
  assert.equal(state.calls.entryUpsert[0].create.finalScore, 75);
  assert.equal(state.calls.entryReadCreate.length, 1);
  assert.equal(state.calls.entryReadCreate[0].skipDuplicates, true);
  assert.deepEqual(state.calls.entryReadUpdate[0].where, {
    entryId: "entry-a",
    providerId: "provider-a",
  });
  assert.deepEqual(state.calls.revalidate, ["/dashboard"]);
});

test("all supported entry kinds retain their authorized create contract", async (t) => {
  const workflows = [
    ["SessionNote", "BehaviorTherapist", true],
    ["MorningContext", "Caregiver", false],
    ["EveningContext", "Caregiver", false],
    ["SupervisorObservation", "Supervisor", false],
    ["ClinicalNote", "Supervisor", false],
    ["SensoryObservation", "OccupationalTherapist", false],
    ["SpeechProgress", "SpeechPathologist", true],
    ["CommunicationObservation", "SpeechPathologist", false],
  ];

  for (const [kind, role, withItems] of workflows) {
    await t.test(kind, async () => {
      state = freshState();
      currentSession = { providerId: "provider-a", role };

      const result = await createEntry(formForKind(kind, withItems));

      assert.equal(result.ok, true);
      assert.equal(result.entryId, "entry-a");
      assert.equal(result.status, "IN_PROGRESS");
      assert.equal(state.calls.entryUpsert.length, 1);
      assert.equal(state.calls.entryUpsert[0].create.kind, kind);
    });
  }
});

test("an unassigned client is rejected before create side effects", async () => {
  const result = await createEntry(entryForm({ clientId: "client-b" }));

  assert.deepEqual(result, { ok: false, reason: "missing_client" });
  assertNoWriteOrSideEffect();
  assert.equal(state.calls.entryFind.length, 0);
  assert.equal(state.calls.goalFindMany.length, 0);
});

test("an out-of-scope goal is rejected before create side effects", async () => {
  const result = await createEntry(entryForm({ goalId: "goal-b" }));

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
  assert.equal(state.calls.entryFind.length, 0);
});

test("a mastered goal cannot be newly attached from a stale create form", async () => {
  state.scopedGoals.set(
    "goal-a",
    scopedGoal({ isActive: false, isMastered: true }),
  );

  const result = await createEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
});

test("an inactive goal cannot be newly attached", async () => {
  state.scopedGoals.set("goal-a", scopedGoal({ isActive: false }));

  const result = await createEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
});

test("create preserves a mastered goal already associated with its canonical Entry", async () => {
  state.scopedGoals.set(
    "goal-a",
    scopedGoal({ isActive: false, isMastered: true }),
  );
  state.existingEntry = canonicalEntry();

  const result = await createEntry(entryForm());

  assert.deepEqual(result, {
    ok: true,
    entryId: "entry-a",
    visibility: "Shared",
    status: "IN_PROGRESS",
  });
  assert.equal(state.calls.entryUpsert[0].update.items.create[0].goalId, "goal-a");
});

test("an existing mastered relationship cannot authorize a different Entry", async () => {
  state.scopedGoals.set(
    "goal-a",
    scopedGoal({ isActive: false, isMastered: true }),
  );
  state.existingEntry = null;

  const result = await createEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
});

test("a goal belonging to another client is always rejected", async () => {
  state.scopedGoals.set("goal-a", scopedGoal({ clientId: "client-b" }));

  const result = await createEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
  assert.equal(state.calls.entryFind.length, 0);
});

test("a goal belonging to another provider is always rejected", async () => {
  state.scopedGoals.set("goal-a", scopedGoal({ providerId: "provider-b" }));

  const result = await createEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
  assert.equal(state.calls.entryFind.length, 0);
});

test("an assigned provider retains the existing update response and processing", async () => {
  state.existingEntry = canonicalEntry();

  const result = await updateOwnEntry(entryForm());

  assert.deepEqual(result, { ok: true, status: "IN_PROGRESS" });
  assert.equal(state.calls.entryUpdate.length, 1);
  assert.deepEqual(state.calls.entryUpdate[0].where, { id: "entry-a" });
  assert.equal(state.calls.entryUpdate[0].data.items.create[0].goalId, "goal-a");
  assert.equal(state.calls.entryReadCreate.length, 1);
  assert.equal(state.calls.entryReadDelete.length, 0);
  assert.equal(state.calls.entryReadCreate[0].skipDuplicates, true);
  assert.deepEqual(state.calls.entryReadUpdate[0].where, {
    entryId: "entry-a",
    providerId: "provider-a",
  });
  assert.deepEqual(state.calls.revalidate, ["/dashboard"]);
});

test("updating a completed canonical Entry preserves the response and brackets the write with revisions", async () => {
  state.existingEntry = {
    ...canonicalEntry(),
    status: "COMPLETED",
    completedAt: new Date("2026-08-30T17:00:00.000Z"),
    _count: { revisions: 1 },
  };
  state.statusAfterSave = "COMPLETED";

  const result = await updateOwnEntry(entryForm());

  assert.deepEqual(result, { ok: true, status: "COMPLETED" });
  assert.deepEqual(state.calls.entryUpdate[0].where, { id: "entry-a" });
  assert.equal(state.calls.revisions.length, 2);
  assert.equal(state.calls.revisions[0][1], "entry-a");
  assert.equal(state.calls.revisions[0][2], "provider-a");
  assert.equal(state.calls.revisions[1][1], "entry-a");
  assert.equal(state.calls.revisions[1][2], "provider-a");
  assert.equal(state.calls.reconcile.length, 1);
});

test("saving an Entry acknowledges the author while leaving other assigned Providers unread", async () => {
  await createEntry(entryForm());

  assert.equal(state.calls.entryReadDelete.length, 0);
  assert.equal(state.calls.entryReadCreate[0].skipDuplicates, true);
  assert.deepEqual(
    state.calls.entryReadCreate[0].data.map(({ providerId }) => providerId),
    ["provider-a", "provider-b"],
  );
  const authorRead = state.calls.entryReadCreate[0].data.find(
    ({ providerId }) => providerId === "provider-a",
  );
  const teammateRead = state.calls.entryReadCreate[0].data.find(
    ({ providerId }) => providerId === "provider-b",
  );
  assert.ok(authorRead.readAt instanceof Date);
  assert.equal(teammateRead.readAt, null);
  assert.deepEqual(state.calls.entryReadUpdate[0].where, {
    entryId: "entry-a",
    providerId: "provider-a",
  });
  assert.ok(state.calls.entryReadUpdate[0].data.readAt instanceof Date);
});

test("update preserves a mastered goal already associated with the same Entry", async () => {
  state.scopedGoals.set(
    "goal-a",
    scopedGoal({ isActive: false, isMastered: true }),
  );
  state.existingEntry = canonicalEntry();

  const result = await updateOwnEntry(entryForm());

  assert.deepEqual(result, { ok: true, status: "IN_PROGRESS" });
  assert.equal(state.calls.entryUpdate[0].data.items.create[0].goalId, "goal-a");
});

test("update preserves an inactive goal already associated with the same Entry", async () => {
  state.scopedGoals.set("goal-a", scopedGoal({ isActive: false }));
  state.existingEntry = canonicalEntry();

  const result = await updateOwnEntry(entryForm());

  assert.deepEqual(result, { ok: true, status: "IN_PROGRESS" });
  assert.equal(state.calls.entryUpdate[0].data.items.create[0].goalId, "goal-a");
});

test("update rejects a mastered goal associated only with a different Entry", async () => {
  state.scopedGoals.set(
    "goal-a",
    scopedGoal({ isActive: false, isMastered: true }),
  );
  state.existingEntry = canonicalEntry([]);

  const result = await updateOwnEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
});

test("an unassigned client is rejected before update lookup or side effects", async () => {
  const result = await updateOwnEntry(entryForm({ clientId: "client-b" }));

  assert.deepEqual(result, { ok: false, reason: "missing_client" });
  assertNoWriteOrSideEffect();
  assert.equal(state.calls.entryFind.length, 0);
});

test("an out-of-scope goal is rejected without replacing existing items", async () => {
  state.existingEntry = canonicalEntry();

  const result = await updateOwnEntry(entryForm({ goalId: "goal-b" }));

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
});

test("update always rejects a goal belonging to another client", async () => {
  state.scopedGoals.set("goal-a", scopedGoal({ clientId: "client-b" }));
  state.existingEntry = canonicalEntry();

  const result = await updateOwnEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
});

test("update always rejects a goal belonging to another provider", async () => {
  state.scopedGoals.set("goal-a", scopedGoal({ providerId: "provider-b" }));
  state.existingEntry = canonicalEntry();

  const result = await updateOwnEntry(entryForm());

  assert.deepEqual(result, { ok: false, reason: "invalid_data" });
  assertNoWriteOrSideEffect();
});

test("the add-note loader keeps its existing output path but requires assignment", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app/portal/notes/add/page.tsx"),
    "utf8",
  );
  const loaderSource = fs.readFileSync(
    path.join(process.cwd(), "app/libs/noteFormData.ts"),
    "utf8",
  );

  assert.doesNotMatch(pageSource, /requireAssignedClient:\s*false/);
  assert.match(loaderSource, /requireAssignedClient\s*=\s*true/);
  assert.match(loaderSource, /providerClients:\s*\{[\s\S]*?providerId/);
  assert.match(loaderSource, /isActive:\s*true/);
  assert.match(loaderSource, /isMastered:\s*false/);
  assert.match(pageSource, /if \(!formData\) redirect\("\/dashboard"\)/);
  assert.match(pageSource, /<NoteOverlay/);
});

test("the existing assigned-provider ABC submission remains unchanged", async () => {
  currentSession = { providerId: "provider-a", role: "BehaviorTherapist" };
  const formData = new FormData();
  formData.set("clientId", "client-a");
  formData.set(
    "rows",
    JSON.stringify([
      {
        antecedent: "Fictional antecedent",
        behavior: "Fictional behavior",
        consequence: "Fictional consequence",
      },
    ]),
  );

  const result = await createAbcData(formData);

  assert.deepEqual(result, {
    ok: true,
    entryId: "entry-a",
    status: "IN_PROGRESS",
  });
  assert.deepEqual(state.calls.entryUpsert[0].create.abcObservations.create, [
    {
      antecedent: "Fictional antecedent",
      behavior: "Fictional behavior",
      consequence: "Fictional consequence",
    },
  ]);
  assert.equal(state.calls.entryReadCreate.length, 1);
});

test("the existing assigned-provider target-goal submission remains unchanged", async () => {
  const clientId = "11111111-1111-4111-8111-111111111111";
  state = freshState({
    assignedClientId: clientId,
    assignmentRole: "Educator",
    scopedGoals: new Map(),
  });
  currentSession = { providerId: "provider-a", role: "Educator" };
  const formData = new FormData();
  formData.set("clientId", clientId);
  formData.set("target", "Fictional target");
  formData.set("goal", "Fictional goal");
  formData.set("measurementProfile", "Participation");

  const result = await createEducatorTarget(formData);

  assert.deepEqual(result, { ok: true, goalId: "goal-created" });
  assert.equal(state.calls.goalCreate.length, 1);
  assert.equal(state.calls.goalCreate[0].data.clientId, clientId);
  assert.equal(state.calls.goalCreate[0].data.providerId, "provider-a");
  assert.equal(state.calls.goalCreate[0].data.measurementProfile, "Participation");
  assert.deepEqual(state.calls.revalidate, ["/dashboard"]);
});
