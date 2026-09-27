/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "app/portal/supervisor/create-client/CreateClientProvidersForm.tsx"),
  "utf8"
);
const styles = fs.readFileSync(
  path.join(root, "app/portal/supervisor/create-client/CreateClientProvidersForm.module.css"),
  "utf8"
);

test("responsible organization keeps the native select as the interactive control", () => {
  assert.match(source, /<select[\s\S]*name="organizationId"/);
  assert.match(source, /value=\{organizationId\}/);
  assert.match(source, /onChange=\{\(event\) => \{/);
  assert.match(source, /required/);
  assert.match(source, /ref=\{organizationSelectRef\}/);
});

test("responsible organization presents its complete selected label in a wrapping field", () => {
  assert.match(source, /\{selectedOrganizationLabel\}/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(styles, /width: 100%;/);
  assert.match(styles, /min-width: 0;/);
  assert.match(styles, /overflow-wrap: anywhere;/);
  assert.match(styles, /white-space: normal;/);
  assert.doesNotMatch(styles, /text-overflow:\s*ellipsis/);
});
