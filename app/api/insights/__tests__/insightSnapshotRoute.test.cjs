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

const lensKeys = [
  "observations",
  "patterns",
  "context",
  "confidence",
  "significance",
];
let currentSession = null;
let assignment = null;
let currentContext = null;
let assignmentQuery = null;
let contextCalls = [];
let snapshotCalls = 0;
let synthesisCalls = 0;
let guardedContextualCalls = 0;

function snapshotFor(context) {
  return {
    clientId: context.client.id,
    generatedAt: "2026-08-18T12:00:00.000Z",
    lenses: Object.fromEntries(
      lensKeys.map((lens) => [lens, { label: lens, findings: [] }])
    ),
  };
}

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
      buildInsightContext: async (...args) => {
        contextCalls.push(args);
        if (currentContext instanceof Error) throw currentContext;
        return currentContext;
      },
    };
  }
  if (request === "./insightSnapshot") {
    return {
      buildInsightSnapshot: (context) => {
        snapshotCalls += 1;
        return snapshotFor(context);
      },
    };
  }
  if (request === "./insightsEngine") {
    return {
      parseQuestion: () => ({ intent: "summary" }),
      buildInsight: async () => ({ summary: "Legacy POST answer" }),
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
    return {
      synthesizeInsight: async () => {
        synthesisCalls += 1;
        return null;
      },
    };
  }
  if (request === "./guardedContextualInsight") {
    return {
      buildGuardedContextualInsight: () => {
        guardedContextualCalls += 1;
        return { summary: "Guarded lens answer" };
      },
    };
  }
  if (request === "@/app/libs/insights/categories") {
    return { isInsightCategory: (value) => value === "overview" };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { GET, POST } = require("../route.ts");
Module._load = originalLoad;

function reset() {
  currentSession = null;
  assignment = null;
  currentContext = null;
  assignmentQuery = null;
  contextCalls = [];
  snapshotCalls = 0;
  synthesisCalls = 0;
  guardedContextualCalls = 0;
}

function getRequest(clientId = "client-1") {
  return new Request(
    `http://localhost/api/insights?clientId=${encodeURIComponent(clientId)}`
  );
}

function postRequest() {
  return new Request("http://localhost/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: "client-1",
      category: "overview",
      question: "Give me an overview.",
    }),
  });
}

function lensPostRequest() {
  return new Request("http://localhost/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: "client-1",
      lens: "patterns",
      question: "What pattern is recorded?",
    }),
  });
}

test("GET snapshot rejects unauthenticated requests", async () => {
  reset();
  const response = await GET(getRequest());
  assert.equal(response.status, 401);
  assert.equal(assignmentQuery, null);
  assert.equal(contextCalls.length, 0);
});

test("GET snapshot rejects authenticated non-supervisors", async () => {
  reset();
  currentSession = { providerId: "provider-1", role: "Educator" };
  const response = await GET(getRequest());
  assert.equal(response.status, 401);
  assert.equal(assignmentQuery, null);
  assert.equal(contextCalls.length, 0);
});

test("GET snapshot requires a client ID", async () => {
  reset();
  const response = await GET(
    new Request("http://localhost/api/insights?clientId=%20%20")
  );
  assert.equal(response.status, 400);
  assert.equal(contextCalls.length, 0);
});

test("GET snapshot blocks cross-client access before context loading", async () => {
  reset();
  currentSession = { providerId: "supervisor-1", role: "Supervisor" };
  assignment = null;
  const response = await GET(getRequest("client-not-assigned"));
  assert.equal(response.status, 403);
  assert.equal(contextCalls.length, 0);
  assert.deepEqual(assignmentQuery.where, {
    clientId: "client-not-assigned",
    providerId: "supervisor-1",
    revokedAt: null,
    role: "Supervisor",
  });
});

test("GET snapshot returns 404 when an authorized client no longer exists", async () => {
  reset();
  currentSession = { providerId: "supervisor-1", role: "Supervisor" };
  assignment = { id: "assignment-1" };
  currentContext = null;
  const response = await GET(getRequest());
  assert.equal(response.status, 404);
  assert.equal(contextCalls.length, 1);
  assert.equal(snapshotCalls, 0);
});

test("GET snapshot converts an unexpected server failure into a JSON error response", async () => {
  reset();
  currentSession = { providerId: "provider-1", role: "Supervisor" };
  assignment = { id: "assignment-1" };
  currentContext = new Error("simulated context failure");
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await GET(getRequest());
    assert.equal(response.status, 500);
    assert.deepEqual(response.payload, {
      error: "Insights could not complete the request. Please try again.",
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("GET snapshot returns five lenses from neutral context without synthesis", async () => {
  reset();
  currentSession = { providerId: "supervisor-1", role: "Supervisor" };
  assignment = { id: "assignment-1" };
  currentContext = { client: { id: "client-1" } };

  const response = await GET(getRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.payload.lenses), lensKeys);
  assert.equal(snapshotCalls, 1);
  assert.equal(synthesisCalls, 0);
  assert.deepEqual(contextCalls[0][1], { intent: "summary" });
  assert.deepEqual(contextCalls[0][2], {
    viewerProviderId: "supervisor-1",
    includeCaseSupport: true,
  });
});

test("legacy POST question behavior remains available", async () => {
  reset();
  currentSession = { providerId: "supervisor-1", role: "Supervisor" };
  assignment = { id: "assignment-1" };
  currentContext = { client: { id: "client-1" } };

  const response = await POST(postRequest());

  assert.equal(response.status, 200);
  assert.equal(response.payload.summary, "Legacy POST answer");
  assert.equal(snapshotCalls, 0);
});

test("lens POST questions use the guarded deterministic snapshot path", async () => {
  reset();
  currentSession = { providerId: "supervisor-1", role: "Supervisor" };
  assignment = { id: "assignment-1" };
  currentContext = { client: { id: "client-1" } };

  const response = await POST(lensPostRequest());

  assert.equal(response.status, 200);
  assert.equal(response.payload.summary, "Guarded lens answer");
  assert.equal(guardedContextualCalls, 1);
  assert.equal(synthesisCalls, 0);
});
