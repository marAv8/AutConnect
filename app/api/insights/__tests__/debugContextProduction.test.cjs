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

let sessionCalls = 0;
let contextCalls = 0;
const originalLoad = Module._load;
Module._load = function loadWithRouteMocks(request, parent, isMain) {
  if (request === "next/server") {
    return {
      NextResponse: {
        json: (payload, options = {}) => ({
          payload,
          status: options.status ?? 200,
        }),
      },
    };
  }
  if (request === "@/lib/session") {
    return {
      getSession: async () => {
        sessionCalls += 1;
        return { providerId: "supervisor-a", role: "Supervisor" };
      },
    };
  }
  if (request === "@/lib/db") {
    return {
      db: {
        providerClient: {
          findFirst: async () => ({ id: "assignment-a" }),
        },
      },
    };
  }
  if (request === "../insightContext") {
    return {
      buildInsightContext: async () => {
        contextCalls += 1;
        return { fictional: "sensitive context" };
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { GET } = require(
  path.join(process.cwd(), "app/api/insights/debug-context/route.ts"),
);
Module._load = originalLoad;

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test("the raw debug-context endpoint stays disabled in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDebug = process.env.INSIGHT_CONTEXT_DEBUG;
  process.env.NODE_ENV = "production";
  process.env.INSIGHT_CONTEXT_DEBUG = "true";
  sessionCalls = 0;
  contextCalls = 0;

  const response = await GET(
    new Request("http://localhost/api/insights/debug-context?clientId=client-a"),
  );

  assert.equal(response.status, 404);
  assert.equal(sessionCalls, 0);
  assert.equal(contextCalls, 0);
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDebug === undefined) delete process.env.INSIGHT_CONTEXT_DEBUG;
  else process.env.INSIGHT_CONTEXT_DEBUG = previousDebug;
});
