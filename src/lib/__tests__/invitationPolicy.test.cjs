/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "../invitationPolicy.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleShim = { exports: {} };
new Function("module", "exports", "require", compiled)(
  moduleShim,
  moduleShim.exports,
  require
);

const {
  canAcceptInvitationRole,
  invitationMembershipRole,
  isPublicProviderRole,
} = moduleShim.exports;

test("public registration excludes the supervisor role", () => {
  assert.equal(isPublicProviderRole("BehaviorTherapist"), true);
  assert.equal(isPublicProviderRole("Supervisor"), false);
});

test("supervisor invitations grant organization administration", () => {
  assert.equal(invitationMembershipRole("Supervisor"), "ADMIN");
  assert.equal(invitationMembershipRole("Educator"), "MEMBER");
});

test("an invitation cannot silently replace an existing account role", () => {
  assert.equal(canAcceptInvitationRole("", "Supervisor"), true);
  assert.equal(canAcceptInvitationRole("Supervisor", "Supervisor"), true);
  assert.equal(canAcceptInvitationRole("Educator", "Supervisor"), false);
});
