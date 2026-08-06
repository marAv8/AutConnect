/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { applyDashboardEntryMutations } = require("../clientCarouselModel.ts");
const { providerSignalState } = require("../providerSignalState.ts");
const {
  activeDocumentationDate,
  sevenDayHistoryStart,
} = require("../../libs/documentationDay.ts");

function clientFixture() {
  return {
    id: "client-1",
    firstName: "Test",
    lastName: "Client",
    providerClients: [],
    entries: [
      {
        id: "entry-1",
        providerId: "provider-1",
        status: "COMPLETED",
        reads: [{ readAt: null }],
      },
    ],
    recentEntries: [],
  };
}

test("marks only the selected provider's entries as read", () => {
  const result = applyDashboardEntryMutations(
    [clientFixture()],
    [
      {
        type: "read",
        clientId: "client-1",
        authorProviderId: "provider-1",
      },
    ],
    "viewer-1"
  );

  assert.ok(result[0].entries[0].reads[0].readAt instanceof Date);
});

test("adds a saved entry to both current and recent dashboard state", () => {
  const result = applyDashboardEntryMutations(
    [clientFixture()],
    [
      {
        type: "saved",
        clientId: "client-1",
        authorProviderId: "provider-2",
        entryId: "entry-2",
        kind: "SensoryObservation",
        visibility: "Shared",
        status: "IN_PROGRESS",
      },
    ],
    "provider-2"
  );

  assert.equal(result[0].entries.length, 2);
  assert.deepEqual(result[0].recentEntries, [
    { id: "entry-2", providerId: "provider-2", status: "IN_PROGRESS" },
  ]);
});

test("does not project unread state for a private saved entry", () => {
  const result = applyDashboardEntryMutations(
    [clientFixture()],
    [
      {
        type: "saved",
        clientId: "client-1",
        authorProviderId: "provider-2",
        entryId: "entry-private",
        visibility: "Private",
      },
    ],
    "provider-2"
  );

  assert.deepEqual(result[0].entries.at(-1).reads, []);
});

test("keeps a completed provider signal visible after it is read", () => {
  const unread = providerSignalState({
    entries: [
      {
        id: "completed-entry",
        providerId: "author",
        status: "COMPLETED",
        reads: [{ readAt: null }],
      },
    ],
    isCurrentProvider: false,
    locallyCompleted: false,
  });
  const read = providerSignalState({
    entries: [
      {
        id: "completed-entry",
        providerId: "author",
        status: "COMPLETED",
        reads: [{ readAt: new Date() }],
      },
    ],
    isCurrentProvider: false,
    locallyCompleted: false,
  });

  assert.equal(unread.showSignal, true);
  assert.equal(unread.isSignalDimmed, false);
  assert.equal(read.showSignal, true);
  assert.equal(read.isSignalDimmed, true);
  assert.equal(read.showAction, true);
});

test("returns the author's completed read signal to the action control", () => {
  const state = providerSignalState({
    entries: [
      {
        id: "own-completed-entry",
        providerId: "author",
        status: "COMPLETED",
        reads: [{ readAt: new Date() }],
      },
    ],
    isCurrentProvider: true,
    locallyCompleted: false,
  });

  assert.equal(state.showSignal, false);
  assert.equal(state.isSignalDimmed, false);
  assert.equal(state.showAction, true);
});

test("starts the active documentation day at 6 a.m. and resets at midnight", () => {
  assert.equal(
    activeDocumentationDate(new Date(2026, 6, 27, 5, 59, 59)),
    null
  );
  assert.equal(
    activeDocumentationDate(new Date(2026, 6, 27, 6, 0, 0))?.getTime(),
    new Date(2026, 6, 27, 0, 0, 0).getTime()
  );
  assert.equal(
    activeDocumentationDate(new Date(2026, 6, 27, 23, 59, 59))?.getTime(),
    new Date(2026, 6, 27, 0, 0, 0).getTime()
  );
  assert.equal(
    activeDocumentationDate(new Date(2026, 6, 28, 0, 0, 0)),
    null
  );
});

test("keeps note history on a separate seven-calendar-day window", () => {
  assert.equal(
    sevenDayHistoryStart(new Date(2026, 6, 27, 14, 0, 0)).getTime(),
    new Date(2026, 6, 21, 0, 0, 0).getTime()
  );
});
