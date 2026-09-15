/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const pagePath = path.join(__dirname, "../page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");
const originalTsxLoader = Module._extensions[".tsx"];
const originalLoad = Module._load;

const state = {
  session: { providerId: "fictional-supervisor", role: "Supervisor" },
  supervisorResult: { id: "fictional-supervisor", role: "Supervisor" },
  supervisorError: null,
  redirects: [],
  organizationQueries: 0,
  providerQueries: 0,
};

const redirectSignal = Symbol("redirect");
const createClientWithProviders = async () => undefined;

Module._extensions[".tsx"] = function loadTypeScriptJsx(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

Module._load = function loadWithPageMocks(request, parent, isMain) {
  if (request === "@/lib/session") {
    return { getSession: async () => state.session };
  }
  if (request === "@/lib/authorization") {
    return {
      getManagedOrganizationIds: async () => ["fictional-organization"],
      requireCurrentSupervisor: async () => {
        if (state.supervisorError) throw state.supervisorError;
        return state.supervisorResult;
      },
    };
  }
  if (request === "@/lib/db") {
    return {
      db: {
        organization: {
          findMany: async () => {
            state.organizationQueries += 1;
            return [];
          },
        },
        provider: {
          findMany: async () => {
            state.providerQueries += 1;
            return [];
          },
        },
      },
    };
  }
  if (request === "@/app/actions/createClientWithProviders") {
    return { createClientWithProviders };
  }
  if (request === "next/navigation") {
    return {
      redirect: (destination) => {
        state.redirects.push(destination);
        throw redirectSignal;
      },
    };
  }
  if (request === "next/link" || request === "./CreateClientProvidersForm") {
    return { __esModule: true, default: () => null };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const CreateClientPage = require(pagePath).default;

test.after(() => {
  Module._extensions[".tsx"] = originalTsxLoader;
  Module._load = originalLoad;
  delete require.cache[pagePath];
});

function resetState() {
  state.session = { providerId: "fictional-supervisor", role: "Supervisor" };
  state.supervisorResult = { id: "fictional-supervisor", role: "Supervisor" };
  state.supervisorError = null;
  state.redirects = [];
  state.organizationQueries = 0;
  state.providerQueries = 0;
}

test("Create Client distinguishes missing sessions from authorization and operational failures", async () => {
  resetState();
  state.session = null;
  await assert.rejects(() => CreateClientPage(), (error) => error === redirectSignal);
  assert.deepEqual(state.redirects, ["/login"]);
  assert.equal(state.organizationQueries, 0);
  assert.equal(state.providerQueries, 0);

  resetState();
  const result = await CreateClientPage();
  assert.ok(result);
  assert.deepEqual(state.redirects, []);
  assert.equal(state.organizationQueries, 1);
  assert.equal(state.providerQueries, 1);

  resetState();
  const unauthorized = new Error("Unauthorized");
  state.supervisorError = unauthorized;
  await assert.rejects(() => CreateClientPage(), (error) => error === unauthorized);
  assert.deepEqual(state.redirects, []);

  resetState();
  const operationalFailure = new Error("sensitive database detail");
  state.supervisorError = operationalFailure;
  await assert.rejects(
    () => CreateClientPage(),
    (error) => error === operationalFailure
  );
  assert.deepEqual(state.redirects, []);
  assert.equal(state.organizationQueries, 0);
  assert.equal(state.providerQueries, 0);
});

test("Create Client keeps its successful navigation and submission contracts", () => {
  assert.match(pageSource, /if \(!session\) redirect\("\/login"\)/);
  assert.match(pageSource, /await requireCurrentSupervisor\(\)/);
  assert.doesNotMatch(
    pageSource,
    /requireCurrentSupervisor\(\)\.catch|error\.message|String\(error\)/
  );
  assert.match(pageSource, /<Link href="\/dashboard"/);
  assert.match(pageSource, /onSubmit=\{createClientWithProviders\}/);
});
