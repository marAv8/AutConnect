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
