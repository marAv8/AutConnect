/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
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

const searchPolicy = require(path.join(
  root,
  "src/lib/clientTeamOrganizationSearch.ts"
));
const actions = read("app/actions/manageClientTeam.ts");
const page = read("app/portal/supervisor/edit-providers/[clientId]/page.tsx");
const panel = read(
  "app/portal/supervisor/edit-providers/[clientId]/ClientTeamPanel.tsx"
);

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test("organization search trims and collapses whitespace with a documented minimum", () => {
  assert.equal(searchPolicy.ORGANIZATION_SEARCH_MIN_LENGTH, 2);
  assert.equal(
    searchPolicy.normalizeOrganizationSearchQuery("  local   TEST school  "),
    "local TEST school"
  );
});

test("empty and too-short organization searches disclose nothing", () => {
  assert.deepEqual(searchPolicy.organizationSearchValidation("   "), {
    normalizedQuery: "",
    isEmpty: true,
    isTooShort: false,
  });
  assert.equal(searchPolicy.organizationSearchValidation("s").isTooShort, true);
  assert.match(actions, /normalizedQuery\.length < ORGANIZATION_SEARCH_MIN_LENGTH\) return \[\]/);
});

test("eligible organizations use bounded partial case-insensitive name matching and minimal metadata", () => {
  const searchAction = actions.slice(
    actions.indexOf("export async function searchOrganizationsForClient"),
    actions.indexOf("export async function inviteClientOrganization")
  );
  assert.match(searchAction, /name: \{ contains: normalizedQuery, mode: "insensitive" \}/);
  assert.match(searchAction, /take: ORGANIZATION_RESULT_LIMIT/);
  assert.match(searchAction, /select: \{ id: true, name: true, type: true \}/);
  assert.doesNotMatch(
    searchAction,
    /email|memberships|providerClients|caseCode|firstName|lastName|entries/
  );
});

test("lead, active, pending, and incompatible relationships are excluded while revoked history may be reinvited", () => {
  const searchAction = actions.slice(
    actions.indexOf("export async function searchOrganizationsForClient"),
    actions.indexOf("export async function inviteClientOrganization")
  );
  assert.match(searchAction, /clientOrganizations:[\s\S]*none:[\s\S]*clientId/);
  assert.match(searchAction, /status: \{ not: "REVOKED" \}/);
  assert.match(searchAction, /revokedAt: null/);
  assert.match(actions, /lead\.organizationId === organizationId/);
  assert.match(actions, /status: "REVOKED", revokedAt: \{ not: null \}/);
});

test("organization search requires exact Team Manager authority and performs no mutation", () => {
  const searchAction = actions.slice(
    actions.indexOf("export async function searchOrganizationsForClient"),
    actions.indexOf("export async function inviteClientOrganization")
  );
  assert.match(searchAction, /requireCurrentProvider\(\)/);
  assert.match(searchAction, /requireTeamManager\(tx, actor\.id, clientId\)/);
  assert.doesNotMatch(searchAction, /\.(?:create|createMany|update|updateMany|delete|upsert)\(/);
  assert.doesNotMatch(searchAction, /revalidatePath|redirect\(/);
});

test("submitted query, validation, results, and no-results feedback stay in Invite Organization context", () => {
  assert.doesNotMatch(page, /searchParams|organizationSearchValidation/);
  assert.match(panel, /normalizeOrganizationSearchQuery\(organizationInput\)/);
  assert.match(panel, /value=\{organizationInput\}/);
  assert.match(panel, /id="invite-organization"[\s\S]*tabIndex=\{-1\}/);
  assert.match(panel, /organizationInputRef\.current\?\.focus\(\)/);
  assert.match(panel, /Enter at least \{ORGANIZATION_SEARCH_MIN_LENGTH\} characters/);
  assert.match(panel, /No eligible organizations found/);
});

test("searches remain in place and Provider eligibility remains approval-gated", () => {
  assert.match(panel, /event\.preventDefault\(\)/);
  assert.match(panel, /organizationSearchPending\.current/);
  assert.match(panel, /providerSearchPending\.current/);
  assert.doesNotMatch(panel, /method="get"|window\.location|location\.href/);
  assert.doesNotMatch(panel, /router\.(?:push|replace)|history\.(?:pushState|replaceState)/);
  assert.match(actions, /activeClientOrganizationWhere\(clientId, organizationId\)/);
  assert.match(actions, /if \(!participation\) throw new Error\("That organization is not active for this client\."\)/);
  assert.match(actions, /providerClients: \{ none: \{ clientId, revokedAt: null \} \}/);
});
