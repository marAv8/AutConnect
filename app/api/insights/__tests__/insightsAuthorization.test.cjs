/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
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

let currentSession = null;
let assignment = null;
let contextCalls = 0;
let assignmentQuery = null;

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
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
  if (request === "@/lib/db") {
    return {
      db: {
        providerClient: {
          findFirst: async (query) => {
            assignmentQuery = query;
            return assignment;
          },
        },
      },
    };
  }
  if (request === "@/lib/session") {
    return { getSession: async () => currentSession };
  }
  if (request === "./insightContext") {
    return {
      buildInsightContext: async () => {
        contextCalls += 1;
        return null;
      },
    };
  }
  if (request === "./insightsEngine") {
    return {
      parseQuestion: () => ({ intent: "summary" }),
      buildInsight: async () => ({ summary: "unused" }),
    };
  }
  if (request === "./insightAnswerContract") {
    return {
      annotateDeterministicInsight: (value) => value,
      contextualQuestionCategory: (_question, fallback) => fallback,
      shouldAttemptSynthesis: () => false,
    };
  }
  if (request === "./insightSynthesis") {
    return { synthesizeInsight: async () => null };
  }
  if (request === "@/app/libs/insights/categories") {
    return { isInsightCategory: (value) => value === "providers" };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { POST } = require("../route.ts");
Module._load = originalLoad;

function requestFor(clientId) {
  return new Request("http://localhost/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      category: "providers",
      question: "Summarize recent Field Observations.",
    }),
  });
}

test("Insights rejects unauthenticated Field Observation requests", async () => {
  currentSession = null;
  assignment = null;
  contextCalls = 0;
  assignmentQuery = null;

  const response = await POST(requestFor("client-1"));

  assert.equal(response.status, 401);
  assert.equal(contextCalls, 0);
  assert.equal(assignmentQuery, null);
});

test("Insights blocks cross-client Field Observation context before loading it", async () => {
  currentSession = { providerId: "supervisor-1", role: "Supervisor" };
  assignment = null;
  contextCalls = 0;

  const response = await POST(requestFor("client-not-assigned"));

  assert.equal(response.status, 403);
  assert.equal(contextCalls, 0);
  assert.deepEqual(assignmentQuery.where, {
    clientId: "client-not-assigned",
    providerId: "supervisor-1",
    revokedAt: null,
    role: "Supervisor",
  });
});
