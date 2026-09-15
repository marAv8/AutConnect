/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "../platformAdminPolicy.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleShim = { exports: {} };
new Function("module", "exports", "require", "process", compiled)(
  moduleShim,
  moduleShim.exports,
  require,
  process
);
const {
  isPlatformAdminEmail,
  parsePlatformAdminEmails,
} = moduleShim.exports;

test("platform administrator emails are normalized and explicitly allow-listed", () => {
  const configured = " Owner@AutConnect.test, security@autconnect.test ";
  assert.equal(isPlatformAdminEmail("owner@autconnect.test", configured), true);
  assert.equal(isPlatformAdminEmail("outsider@autconnect.test", configured), false);
  assert.deepEqual(
    [...parsePlatformAdminEmails(configured)],
    ["owner@autconnect.test", "security@autconnect.test"]
  );
});

test("an empty allow-list grants no platform administration", () => {
  assert.equal(isPlatformAdminEmail("owner@autconnect.test", ""), false);
});
