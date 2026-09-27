/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const form = read(
  "app/portal/supervisor/edit-providers/[clientId]/EditClientProvidersForm.tsx"
);
const page = read("app/portal/supervisor/edit-providers/[clientId]/page.tsx");
const panel = read(
  "app/portal/supervisor/edit-providers/[clientId]/ClientTeamPanel.tsx"
);
const styles = read(
  "app/portal/supervisor/edit-providers/[clientId]/CareTeamPage.module.css"
);
const autocomplete = read("components/ui/AuthorizedAutocomplete.tsx");
const autocompleteStyles = read("components/ui/AuthorizedAutocomplete.module.css");
const actions = read("app/actions/manageSupervisorClients.ts");
const scopedAction = actions.slice(
  actions.indexOf("export async function updateClientDetailsFromCareTeam")
);

test("medication radios are visible, explicitly labelled, grouped, and controlled", () => {
  assert.match(form, /id="medication-yes"[\s\S]*name="receivesPrescribedMedication"[\s\S]*value="true"/);
  assert.match(form, /htmlFor="medication-yes"[\s\S]*Yes/);
  assert.match(form, /id="medication-no"[\s\S]*name="receivesPrescribedMedication"[\s\S]*value="false"/);
  assert.match(form, /htmlFor="medication-no"[\s\S]*No/);
  assert.match(form, /checked=\{receivesPrescribedMedication\}/);
  assert.match(form, /checked=\{!receivesPrescribedMedication\}/);
  assert.match(styles, /\.radioInput \{[\s\S]*appearance: auto;[\s\S]*width: 20px;[\s\S]*height: 20px/);
  assert.match(styles, /\.radioInput:focus-visible \{[\s\S]*outline: 2px solid var\(--ring\)/);
  assert.doesNotMatch(styles, /\.radioChoice:has\(\.radioInput:checked\)/);
  assert.doesNotMatch(styles, /\.radioChoice \{[^}]*border:/);
  assert.doesNotMatch(styles, /\.radioChoice \{[^}]*background:/);
  assert.doesNotMatch(styles, /\.radioChoice \{[^}]*padding:/);
});

test("Care Team update maps submitted Yes and No values and returns without redirect", () => {
  assert.match(scopedAction, /medicationValue !== "true" && medicationValue !== "false"/);
  assert.match(scopedAction, /receivesPrescribedMedication: medicationValue === "true"/);
  assert.match(scopedAction, /status: "success", message: "Client details saved"/);
  assert.doesNotMatch(scopedAction, /redirect\(/);
  assert.doesNotMatch(scopedAction, /\/login/);
  assert.match(page, /onSubmit=\{updateClientDetailsFromCareTeam\}/);
  assert.match(form, /useActionState\(onSubmit, initialState\)/);
  assert.match(form, /disabled=\{pending\}/);
  assert.match(form, /role=\{state\.status === "error" \? "alert" : "status"\}/);
});

test("organization and provider searches use the shared compact autocomplete", () => {
  assert.equal((panel.match(/<AuthorizedAutocomplete/g) ?? []).length, 2);
  assert.match(autocomplete, /type="search"/);
  assert.match(autocomplete, /role="combobox"/);
  assert.match(autocomplete, /role="listbox"/);
  assert.doesNotMatch(panel + autocomplete, /<textarea/);
  assert.match(panel, /search=\{findOrganizations\}/);
  assert.match(panel, /search=\{findProviders\}/);
  assert.doesNotMatch(panel, /method="get"|action=\{`\/portal\/supervisor\/edit-providers/);
  assert.match(autocompleteStyles, /min-height: 44px/);
  assert.match(autocompleteStyles, /@media \(max-width: 520px\)/);
  assert.match(panel, /label="Organization name"/);
  assert.match(panel, /label="Provider name"/);
  assert.match(styles, /\.selectedAction/);
});
