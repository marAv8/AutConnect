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
      target: ts.ScriptTarget.ES2021,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  managedClientWhere,
  organizationProviderWhere,
} = require("../authorizationScope.ts");

test("legacy client scope requires the current supervisor assignment", () => {
  assert.deepEqual(managedClientWhere("supervisor-1", []), {
    providerClients: {
      some: {
        providerId: "supervisor-1",
        role: "Supervisor",
        revokedAt: null,
      },
    },
  });
});

test("organization administration alone never expands legacy Client discovery", () => {
  const scope = managedClientWhere("supervisor-1", ["org-1", "org-2"]);
  assert.deepEqual(scope, {
    providerClients: {
      some: {
        providerId: "supervisor-1",
        role: "Supervisor",
        revokedAt: null,
      },
    },
  });
});

test("provider directory scope is closed when no organization is managed", () => {
  assert.deepEqual(organizationProviderWhere([]), { id: { in: [] } });
  assert.deepEqual(organizationProviderWhere(["org-1"]), {
    organizationMemberships: {
      some: { organizationId: { in: ["org-1"] }, active: true },
    },
  });
});
