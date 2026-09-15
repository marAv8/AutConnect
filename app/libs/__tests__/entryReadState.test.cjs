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

let reads = [];
const db = {
  entryRead: {
    async createMany({ data, skipDuplicates }) {
      assert.equal(skipDuplicates, true);
      for (const row of data) {
        const exists = reads.some(
          (read) =>
            read.entryId === row.entryId && read.providerId === row.providerId,
        );
        if (!exists) reads.push({ ...row });
      }
      return { count: data.length };
    },
    async updateMany({ where, data }) {
      let count = 0;
      reads = reads.map((read) => {
        if (
          read.entryId !== where.entryId ||
          read.providerId !== where.providerId
        ) {
          return read;
        }
        count += 1;
        return { ...read, ...data };
      });
      return { count };
    },
    async deleteMany({ where }) {
      const before = reads.length;
      reads = reads.filter((read) => read.entryId !== where.entryId);
      return { count: before - reads.length };
    },
  },
  async $transaction(callback) {
    return callback(db);
  },
};

const originalLoad = Module._load;
Module._load = function loadWithDbMock(request, parent, isMain) {
  if (request === "@/lib/db") return { db };
  return originalLoad.call(this, request, parent, isMain);
};

const { syncEntryReadsAfterAuthorSave } = require(
  path.join(process.cwd(), "app/libs/entryReadState.ts"),
);
Module._load = originalLoad;

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test.beforeEach(() => {
  reads = [];
});

test("a shared Entry acknowledges its author and leaves active teammates unread", async () => {
  await syncEntryReadsAfterAuthorSave({
    entryId: "entry-a",
    authorProviderId: "provider-a",
    assignedProviderIds: ["provider-a", "provider-b"],
  });

  assert.equal(reads.length, 2);
  assert.ok(reads.find((read) => read.providerId === "provider-a").readAt instanceof Date);
  assert.equal(reads.find((read) => read.providerId === "provider-b").readAt, null);
});

test("same-day updates keep one row per Provider and preserve every teammate timestamp", async () => {
  const teammateReadAt = new Date("2026-08-30T18:00:00.000Z");
  reads = [
    { entryId: "entry-a", providerId: "provider-a", readAt: null },
    { entryId: "entry-a", providerId: "provider-b", readAt: teammateReadAt },
    { entryId: "entry-a", providerId: "provider-c", readAt: null },
  ];

  await syncEntryReadsAfterAuthorSave({
    entryId: "entry-a",
    authorProviderId: "provider-a",
    assignedProviderIds: ["provider-a", "provider-b", "provider-c"],
  });

  assert.equal(reads.length, 3);
  assert.ok(reads.find((read) => read.providerId === "provider-a").readAt instanceof Date);
  assert.equal(reads.find((read) => read.providerId === "provider-b").readAt, teammateReadAt);
  assert.equal(reads.find((read) => read.providerId === "provider-c").readAt, null);
});

test("unassigned Providers receive no new read state", async () => {
  await syncEntryReadsAfterAuthorSave({
    entryId: "entry-a",
    authorProviderId: "provider-a",
    assignedProviderIds: ["provider-a", "provider-b"],
  });

  assert.deepEqual(
    reads.map((read) => read.providerId),
    ["provider-a", "provider-b"],
  );
});
