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

const { createClient } = require(path.join(
  process.cwd(),
  "app/actions/createClient.ts"
));
const { assignProviderToClient } = require(path.join(
  process.cwd(),
  "app/actions/assignProviderToClient.ts"
));

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test("legacy unauthenticated Client mutation actions are unavailable", async () => {
  await assert.rejects(() => createClient({}), /legacy action is unavailable/i);
  await assert.rejects(
    () => assignProviderToClient({}),
    /legacy action is unavailable/i
  );
});

test("canonical creation establishes one lead organization and initial Team Manager", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/actions/createClientWithProviders.ts"),
    "utf8"
  );

  assert.match(source, /requireCurrentSupervisor\(\)/);
  assert.match(source, /status:\s*"ACTIVE"/);
  assert.match(source, /clientOrganization\.create\(/);
  assert.match(source, /role:\s*"LEAD"/);
  assert.match(source, /clientTeamManager\.create\(/);
  assert.match(source, /providerId:\s*supervisor\.id/);
  assert.match(source, /assignedById:\s*supervisor\.id/);
  assert.match(source, /clientTeamAuditEvent\.createMany\(/);
});

test("invalid submitted provider IDs are rejected before any creation write", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/actions/createClientWithProviders.ts"),
    "utf8"
  );
  const rejectionIndex = source.indexOf(
    "providers.length !== selectedProviderIds.size"
  );
  const clientWriteIndex = source.indexOf("tx.client.create");

  assert.ok(rejectionIndex >= 0);
  assert.ok(clientWriteIndex >= 0);
  assert.ok(rejectionIndex < clientWriteIndex);
});

test("case code is not consulted by Client authorization policies", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/clientTeamAuthorizationPolicy.ts"),
    "utf8"
  );

  assert.doesNotMatch(source, /caseCode/);
  assert.match(source, /providerId/);
  assert.match(source, /clientId/);
  assert.match(source, /revokedAt:\s*null/);
});
