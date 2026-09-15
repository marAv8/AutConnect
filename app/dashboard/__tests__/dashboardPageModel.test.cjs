/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
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

const { prepareDashboardClients } = require("../dashboardPageModel.ts");

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

const now = new Date("2026-09-04T19:00:00.000Z");
const focusPeriod = new Date("2026-09-02T17:00:00.000Z");
const author = {
  firstName: "Sally",
  lastName: "Supervisor",
  role: "Supervisor",
};
const signal = {
  sessionDate: "2026-09-03T07:00:00.000Z",
  color: "blue",
  reason: "fixture",
  explanation: "Fixture signal",
  confidence: "moderate",
  observedAt: "2026-09-03T18:00:00.000Z",
  expiresAt: null,
  status: "proposed",
  requiresSupervisorReview: false,
  isUnread: true,
  evidence: [],
};

function clientsFixture() {
  return [
    {
      id: "client-b",
      firstName: "Daniel",
      lastName: "Hart",
      providerClients: [
        {
          role: "BehaviorTherapist",
          organizationId: "agency-1",
          organization: { type: "AGENCY" },
          provider: { id: "viewer", firstName: "Vera", lastName: "Viewer" },
        },
        {
          role: "Supervisor",
          organizationId: "agency-1",
          organization: { type: "AGENCY" },
          provider: { id: "supervisor", firstName: "Sue", lastName: "Lead" },
        },
        {
          role: "Educator",
          organizationId: "school-1",
          organization: { type: "SCHOOL" },
          provider: { id: "educator", firstName: "Ed", lastName: "Teach" },
        },
      ],
      entries: [
        {
          id: "current-shared",
          providerId: "supervisor",
          kind: "SessionNote",
          visibility: "Shared",
          status: "COMPLETED",
          reads: [{ readAt: null }],
        },
        {
          id: "current-private",
          providerId: "viewer",
          kind: "ClinicalNote",
          visibility: "Private",
          status: "IN_PROGRESS",
          reads: [],
        },
      ],
      teamFocusItems: [
        {
          id: "inactive-newer",
          title: "Daniel inactive",
          content: "Inactive for Daniel Hart",
          isActive: false,
          displayStartedAt: focusPeriod,
          createdAt: new Date("2026-09-04T16:00:00.000Z"),
          updatedAt: new Date("2026-09-04T18:00:00.000Z"),
          author,
        },
        {
          id: "expired-active",
          title: "Daniel expired",
          content: "Expired for Daniel",
          isActive: true,
          displayStartedAt: new Date("2026-08-20T17:00:00.000Z"),
          createdAt: new Date("2026-08-20T17:00:00.000Z"),
          updatedAt: new Date("2026-09-04T17:00:00.000Z"),
          author,
        },
        {
          id: "active-current",
          title: "Daniel Hart plan",
          content: "Support Daniel during transitions",
          isActive: true,
          displayStartedAt: focusPeriod,
          createdAt: new Date("2026-09-02T17:00:00.000Z"),
          updatedAt: new Date("2026-09-04T16:00:00.000Z"),
          author,
        },
        {
          id: "revision-older",
          title: "Earlier plan for Daniel",
          content: "Prompt Daniel Hart once",
          isActive: false,
          displayStartedAt: focusPeriod,
          createdAt: new Date("2026-09-02T17:00:00.000Z"),
          updatedAt: new Date("2026-09-03T16:00:00.000Z"),
          author,
        },
      ],
      caseSupportCases: [{ id: "case-1" }],
    },
    {
      id: "client-a",
      firstName: "Maya",
      lastName: "Stone",
      providerClients: [
        {
          role: "Caregiver",
          organizationId: null,
          organization: null,
          provider: { id: "caregiver", firstName: "Casey", lastName: "Parent" },
        },
      ],
      entries: [],
      teamFocusItems: [],
      caseSupportCases: [],
    },
  ];
}

const recentEntries = [
  {
    id: "recent-b-2",
    clientId: "client-b",
    providerId: "supervisor",
    status: "COMPLETED",
  },
  {
    id: "recent-a-1",
    clientId: "client-a",
    providerId: "caregiver",
    status: "IN_PROGRESS",
  },
  {
    id: "recent-b-1",
    clientId: "client-b",
    providerId: "viewer",
    status: "IN_PROGRESS",
  },
];

function expectedClients(canRequestCaseSupport) {
  const source = clientsFixture();
  return [
    {
      id: "client-b",
      firstName: "Daniel",
      lastName: "Hart",
      providerClients: source[0].providerClients,
      entries: source[0].entries,
      hasCaseSupportAccess: true,
      canRequestCaseSupport,
      signal,
      recentEntries: [
        { id: "recent-b-2", providerId: "supervisor", status: "COMPLETED" },
        { id: "recent-b-1", providerId: "viewer", status: "IN_PROGRESS" },
      ],
      teamFocusItems: [
        {
          id: "active-current",
          title: "DaHa plan",
          content: "Support DaHa during transitions",
          displayStartedAt: focusPeriod,
          createdAt: new Date("2026-09-02T17:00:00.000Z"),
          updatedAt: new Date("2026-09-04T16:00:00.000Z"),
          author,
          revisions: [
            {
              id: "inactive-newer",
              title: "DaHa inactive",
              content: "Inactive for DaHa",
              displayStartedAt: focusPeriod,
              createdAt: new Date("2026-09-04T16:00:00.000Z"),
              updatedAt: new Date("2026-09-04T18:00:00.000Z"),
              author,
            },
            {
              id: "revision-older",
              title: "Earlier plan for DaHa",
              content: "Prompt DaHa once",
              displayStartedAt: focusPeriod,
              createdAt: new Date("2026-09-02T17:00:00.000Z"),
              updatedAt: new Date("2026-09-03T16:00:00.000Z"),
              author,
            },
          ],
        },
      ],
    },
    {
      id: "client-a",
      firstName: "Maya",
      lastName: "Stone",
      providerClients: source[1].providerClients,
      entries: [],
      hasCaseSupportAccess: false,
      canRequestCaseSupport: false,
      signal: undefined,
      recentEntries: [
        { id: "recent-a-1", providerId: "caregiver", status: "IN_PROGRESS" },
      ],
      teamFocusItems: [],
    },
  ];
}

test("empty Client collections remain empty for every Dashboard role", () => {
  for (const viewerRole of ["Supervisor", "BehaviorTherapist", "Caregiver"]) {
    assert.deepEqual(
      prepareDashboardClients({
        clients: [],
        recentEntries: [],
        clientSignals: new Map(),
        viewerProviderId: "viewer",
        viewerRole,
        now,
      }),
      []
    );
  }
});

test("Provider projection matches the complete frozen baseline", () => {
  assert.deepEqual(
    prepareDashboardClients({
      clients: clientsFixture(),
      recentEntries,
      clientSignals: new Map([["client-b", signal]]),
      viewerProviderId: "viewer",
      viewerRole: "BehaviorTherapist",
      now,
    }),
    expectedClients(true)
  );
});

test("Supervisor and Caregiver projections retain data while disabling requests", () => {
  for (const viewerRole of ["Supervisor", "Caregiver"]) {
    assert.deepEqual(
      prepareDashboardClients({
        clients: clientsFixture(),
        recentEntries,
        clientSignals: new Map([["client-b", signal]]),
        viewerProviderId: "viewer",
        viewerRole,
        now,
      }),
      expectedClients(false)
    );
  }
});

test("projection preserves Client, Provider, Entry, and revision ordering", () => {
  const source = clientsFixture();
  const result = prepareDashboardClients({
    clients: source,
    recentEntries,
    clientSignals: new Map([["client-b", signal]]),
    viewerProviderId: "viewer",
    viewerRole: "BehaviorTherapist",
    now,
  });

  assert.deepEqual(result.map(({ id }) => id), ["client-b", "client-a"]);
  assert.deepEqual(
    result[0].providerClients.map(({ provider }) => provider.id),
    ["viewer", "supervisor", "educator"]
  );
  assert.strictEqual(result[0].providerClients, source[0].providerClients);
  assert.strictEqual(result[0].entries, source[0].entries);
  assert.deepEqual(
    result[0].teamFocusItems[0].revisions.map(({ id }) => id),
    ["inactive-newer", "revision-older"]
  );
  assert.strictEqual(result[0].signal, signal);
});
