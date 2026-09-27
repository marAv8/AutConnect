/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const originalLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = function loadTypeScript(module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};
const lookup = require(path.join(root, "src/lib/authorizedLookupSearch.ts"));
test.after(() => { Module._extensions[".ts"] = originalLoader; });

const providers = [
  { id: "1", firstName: "Jacob", lastName: "Smith" },
  { id: "2", firstName: "Jacob", lastName: "Santos" },
  { id: "3", firstName: "Amelia", lastName: "Jacobs" },
  { id: "4", firstName: "Maya", lastName: "Jackson" },
];

test("Provider matching supports first, last, full-name tokens and case-insensitive input", () => {
  for (const query of ["Ja", "JAC"]) {
    const matches = providers.filter((provider) => Number.isFinite(lookup.providerMatchRank(provider, query)));
    assert.deepEqual(matches.map(({ id }) => id), ["1", "2", "3", "4"]);
  }
  assert.equal(lookup.providerMatchRank(providers[0], "jac smi"), 1);
  assert.equal(lookup.providerMatchRank(providers[1], "sAn"), 0);
});

test("prefix matches rank before broader partial matches and results stop at eight", () => {
  const ranked = lookup.rankAndLimit(
    [providers[0], providers[1], ...Array.from({ length: 10 }, (_, index) => ({ id: `x${index}`, firstName: `Zajac${index}`, lastName: "Example" }))],
    (provider) => lookup.providerMatchRank(provider, "jac"),
    (provider) => `${provider.firstName} ${provider.lastName}`
  );
  assert.deepEqual(ranked.slice(0, 2).map(({ id }) => id), ["2", "1"]);
  assert.equal(ranked.length, 8);
});

test("organization ranking is partial and case-insensitive with prefix first", () => {
  const organizations = [
    { id: "1", name: "Bay Harbor Agency", type: "AGENCY" },
    { id: "2", name: "Harbor View School", type: "SCHOOL" },
    { id: "3", name: "Harbor District", type: "DISTRICT" },
  ];
  const ranked = lookup.rankAndLimit(
    organizations,
    (organization) => lookup.organizationMatchRank(organization.name, "HARBOR"),
    (organization) => organization.name
  );
  assert.deepEqual(ranked.map(({ id, type }) => [id, type]), [["3", "DISTRICT"], ["2", "SCHOOL"], ["1", "AGENCY"]]);
});

test("keyboard navigation wraps safely and empty lists have no active option", () => {
  assert.equal(lookup.nextAutocompleteIndex(-1, 3, "ArrowDown"), 0);
  assert.equal(lookup.nextAutocompleteIndex(2, 3, "ArrowDown"), 0);
  assert.equal(lookup.nextAutocompleteIndex(0, 3, "ArrowUp"), 2);
  assert.equal(lookup.nextAutocompleteIndex(0, 0, "ArrowDown"), -1);
});

test("shared combobox implements debounce, clear, states, keyboard, touch, and stable-ID actions", () => {
  const component = read("components/ui/AuthorizedAutocomplete.tsx");
  const panel = read("app/portal/supervisor/edit-providers/[clientId]/ClientTeamPanel.tsx");
  for (const contract of [
    /normalized\.length < AUTHORIZED_LOOKUP_MIN_LENGTH/,
    /window\.setTimeout/,
    /250/,
    /Loading suggestions\./,
    /No authorized organizations match this search\./,
    /No eligible Providers match this search\./,
    /Search unavailable\. Try again\./,
    /ArrowDown/,
    /ArrowUp/,
    /event\.key === "Enter"/,
    /event\.key === "Escape"/,
    /onPointerDown/,
    /role="combobox"/,
    /role="listbox"/,
    />Clear<\/button>/,
  ]) assert.match(component + panel, contract);
  assert.match(panel, /organizationId: selectedOrganization\.id/);
  assert.match(panel, /providerId: selectedProvider\.id/);
  assert.doesNotMatch(panel, /role: selectedProvider\.role/);
  assert.doesNotMatch(panel, /providerId:.*firstName|organizationId:.*name/);
});

test("server searches retain exact authority, participation, membership, status, and revocation filters", () => {
  const actions = read("app/actions/manageClientTeam.ts");
  const providerSearch = actions.slice(actions.indexOf("export async function searchEligibleClientProviders"), actions.indexOf("export async function assignClientProvider"));
  assert.match(providerSearch, /requireCurrentProvider\(\)/);
  assert.match(providerSearch, /requireTeamManager\(tx, actor\.id, clientId\)/);
  assert.match(providerSearch, /organizationMembership\.findMany/);
  assert.match(providerSearch, /active: true/);
  assert.match(providerSearch, /status: "ACTIVE"/);
  assert.match(providerSearch, /clientOrganizations:[\s\S]*clientId[\s\S]*status: "ACTIVE"[\s\S]*revokedAt: null/);
  assert.match(providerSearch, /providerClients: \{ none: \{ clientId, revokedAt: null \} \}/);
  assert.match(actions.slice(actions.indexOf("export async function assignClientProvider")), /eligibleProviderWhere\(providerId, organizationId\)/);
});

test("assigned-provider empty state stays separate from autocomplete no-match state", () => {
  const panel = read("app/portal/supervisor/edit-providers/[clientId]/ClientTeamPanel.tsx");
  assert.match(panel, /<h3>No providers assigned<\/h3>/);
  assert.match(panel, /emptyMessage="No eligible Providers match this search\."/);
});
