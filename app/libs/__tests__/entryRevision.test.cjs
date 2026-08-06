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

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@/lib/db") {
    return { db: {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { buildEntryRevisionChanges } = require("../entryRevision.ts");
Module._load = originalLoad;

function snapshot(overrides = {}) {
  return {
    note: "Client used the visual schedule.",
    clinicalReflection: null,
    visibility: "Shared",
    contextData: null,
    finalScore: 7,
    items: [
      {
        target: "Transition",
        goal: "Move between activities",
        score: 1,
        metricType: "Subjective",
        domain: "Adaptive",
        rawValue: null,
        supportLevel: 1,
        observation: null,
      },
    ],
    abcObservations: [],
    ...overrides,
  };
}

test("records only fields that changed instead of duplicating the whole note", () => {
  const changes = buildEntryRevisionChanges(
    snapshot(),
    snapshot({ note: "Client used the visual schedule with one reminder." })
  );

  assert.deepEqual(changes, [
    {
      path: "note",
      label: "Provider note",
      before: "Client used the visual schedule.",
      after: "Client used the visual schedule with one reminder.",
    },
  ]);
});

test("identifies a corrected response separately from unchanged documentation", () => {
  const before = snapshot();
  const after = snapshot({
    items: [
      {
        ...before.items[0],
        score: 4,
        supportLevel: 4,
      },
    ],
    finalScore: 10,
  });

  const changes = buildEntryRevisionChanges(before, after);

  assert.deepEqual(
    changes.map((change) => change.label),
    ["Transition: Response"]
  );
  assert.equal(changes[0].before, 1);
  assert.equal(changes[0].after, 4);
});

test("returns no changes for an identical resubmission", () => {
  assert.deepEqual(buildEntryRevisionChanges(snapshot(), snapshot()), []);
});

test("includes written target observations in a revision diff", () => {
  const before = snapshot();
  const after = snapshot({
    items: [
      {
        ...before.items[0],
        observation: "Transitioned after one visual reminder.",
      },
    ],
  });

  const changes = buildEntryRevisionChanges(before, after);

  assert.deepEqual(changes, [
    {
      path: "items.transition.observation",
      label: "Transition: Observation",
      before: null,
      after: "Transitioned after one visual reminder.",
    },
  ]);
});

test("ignores target order when the documentation is unchanged", () => {
  const first = {
    ...snapshot(),
    items: [
      snapshot().items[0],
      {
        ...snapshot().items[0],
        target: "Imitation",
        goal: "Copy a modeled action",
      },
    ],
  };
  const reordered = {
    ...first,
    items: [...first.items].reverse(),
  };

  assert.deepEqual(buildEntryRevisionChanges(first, reordered), []);
});

test("reports only the educator target fields that changed", () => {
  const baseTarget = snapshot().items[0];
  const before = {
    ...snapshot(),
    items: [
      baseTarget,
      {
        ...baseTarget,
        target: "Following Directions",
        goal: "Complete a worksheet",
        score: 1,
        observation: "Completed with support.",
      },
      {
        ...baseTarget,
        target: "Attention",
        goal: "Attend during story time",
        score: 2,
        observation: "Sat with peers.",
      },
    ],
  };
  const after = {
    ...before,
    items: [
      before.items[2],
      {
        ...before.items[1],
        observation: "Completed with full support.",
      },
      before.items[0],
    ],
  };

  assert.deepEqual(buildEntryRevisionChanges(before, after), [
    {
      path: "items.following directions.observation",
      label: "Following Directions: Observation",
      before: "Completed with support.",
      after: "Completed with full support.",
    },
  ]);
});
