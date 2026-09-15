/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const originalTsLoader = require.extensions[".ts"];
require.extensions[".ts"] = (module, filename) => {
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

const { claimPublicationAnnouncement } = require(
  path.join(process.cwd(), "app/dashboard/notePublicationFeedback.ts")
);

test.after(() => {
  require.extensions[".ts"] = originalTsLoader;
});

test("one successful publication event is announced exactly once", () => {
  const announcedEvents = new Set();
  const event = {
    clientId: "client-a",
    authorProviderId: "provider-a",
    completedEntryIds: ["entry-b", "entry-a"],
  };

  assert.equal(claimPublicationAnnouncement(announcedEvents, event), true);
  assert.equal(claimPublicationAnnouncement(announcedEvents, event), false);
  assert.equal(
    claimPublicationAnnouncement(announcedEvents, {
      ...event,
      completedEntryIds: ["entry-a", "entry-b", "entry-a"],
    }),
    false
  );
});

test("an event without a completed Entry cannot produce publication feedback", () => {
  assert.equal(
    claimPublicationAnnouncement(new Set(), {
      clientId: "client-a",
      authorProviderId: "provider-a",
      completedEntryIds: [],
    }),
    false
  );
});
