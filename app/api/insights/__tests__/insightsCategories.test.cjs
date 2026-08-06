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

let currentContext = null;
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@/lib/sessionScoring") {
    return { normalizeItem: () => null };
  }
  if (request === "@/app/libs/dateTime") {
    return { formatClinicalDateTime: () => "Jul 29, 2026, 7:00 PM" };
  }
  if (request === "@/app/libs/entryRevision") {
    return {
      buildEntryRevisionChanges: (before, after) => {
        const changes = [];
        if (before.note !== after.note) {
          changes.push({
            path: "note",
            label: "Provider note",
            before: before.note,
            after: after.note,
          });
        }
        for (const item of after.items) {
          const previous = before.items.find(
            (candidate) => candidate.target === item.target
          );
          if (previous?.observation !== item.observation) {
            changes.push({
              path: `items.${item.target}.observation`,
              label: `${item.target}: Observation`,
              before: previous?.observation ?? null,
              after: item.observation,
            });
          }
        }
        return changes;
      },
    };
  }
  if (request === "@/app/portal/notes/view/noteHistoryRevision") {
    return {
      formatRevisionUpdate: (_before, after) =>
        after === null || after === "" ? "Removed" : String(after),
    };
  }
  if (request === "./insightContext") {
    return { buildInsightContext: async () => currentContext };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { buildInsight } = require("../insightsEngine.ts");
Module._load = originalLoad;

function baseContext() {
  return {
    documentationRecords: [],
    caseSupport: { requests: [], cases: [] },
    careTeam: [],
    providerRelationships: [],
    providerOverlap: [],
    providerGoalSeries: [],
    currentTeamFocus: null,
    sessions: [],
    precomputedStatistics: {
      providersWithSessions: 0,
      sessionCount: 0,
      assessmentItemCount: 0,
      activeGoalCount: 0,
    },
  };
}

test("overview routes Team Focus questions to the active focus instead of session counts", async () => {
  currentContext = {
    ...baseContext(),
    currentTeamFocus: {
      id: "focus-1",
      title: "Support classroom transitions",
      content: "Use the visual schedule before each transition.",
      updatedAt: "2026-07-30T14:00:00.000Z",
      authorName: "Erin Arr",
      authorRole: "Supervisor",
    },
    precomputedStatistics: {
      providersWithSessions: 6,
      sessionCount: 65,
      assessmentItemCount: 120,
      activeGoalCount: 8,
    },
  };

  const result = await buildInsight(
    "client-1",
    "What is the current Team Focus?",
    { category: "overview", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.headline, "Current Team Focus");
  assert.match(result.summary, /visual schedule/i);
  assert.doesNotMatch(result.summary, /65 completed sessions/i);
});

test("overview keeps a concise client overview as a combined summary", async () => {
  currentContext = {
    ...baseContext(),
    precomputedStatistics: {
      providersWithSessions: 6,
      sessionCount: 65,
      assessmentItemCount: 120,
      activeGoalCount: 8,
    },
  };

  const result = await buildInsight(
    "client-1",
    "Give me a concise overview of this client.",
    { category: "overview", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.headline, "Client overview");
  assert.match(result.summary, /6 providers/);
  assert.match(result.summary, /65 completed sessions/);
});

test("documentation questions identify the author from documentation evidence", async () => {
  currentContext = {
    ...baseContext(),
    documentationRecords: [
      {
        id: "entry-1",
        kind: "CommunicationObservation",
        completedAt: "2026-07-30T02:00:00.000Z",
        updatedAt: "2026-07-30T02:00:00.000Z",
        providerName: "Michelle K",
        providerRole: "SpeechPathologist",
        note: "Observed spontaneous requesting.",
        observations: [],
        revisions: [],
      },
    ],
  };

  const result = await buildInsight(
    "client-1",
    "Who filed the latest documentation?",
    { category: "documentation", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.category, "documentation");
  assert.match(result.summary, /Michelle K/);
  assert.equal(result.evidence[0].sourceId, "entry-1");
});

test("documentation count questions return the filtered record count", async () => {
  currentContext = {
    ...baseContext(),
    documentationRecords: [
      {
        id: "entry-1",
        providerName: "Michelle K",
        providerRole: "SpeechPathologist",
      },
      {
        id: "entry-2",
        providerName: "Michelle K",
        providerRole: "SpeechPathologist",
      },
      {
        id: "entry-3",
        providerName: "Casey Sch",
        providerRole: "Educator",
      },
    ],
  };

  const result = await buildInsight(
    "client-1",
    "How many completed notes are there?",
    { category: "documentation", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.headline, "Documentation count");
  assert.match(result.summary, /3 matching completed records/);
  assert.match(result.summary, /2 providers/);
});

test("case-support questions identify the requester instead of returning progress", async () => {
  currentContext = {
    ...baseContext(),
    caseSupport: {
      requests: [
        {
          id: "request-1",
          requesterName: "Tina B",
          requesterRole: "BehaviorTherapist",
          createdAt: "2026-07-30T02:00:00.000Z",
          status: "REQUESTED",
          concern: "A communication gap needs supervisor attention.",
        },
      ],
      cases: [],
    },
  };

  const result = await buildInsight(
    "client-1",
    "Who filed the latest case support request?",
    { category: "caseSupport", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.category, "caseSupport");
  assert.match(result.summary, /Tina B/);
  assert.doesNotMatch(result.summary, /care team is showing/i);
});

test("documentation updates collapse rapid saves into the exact final delta", async () => {
  const baseline = {
    note: null,
    clinicalReflection: null,
    visibility: "Shared",
    contextData: null,
    finalScore: null,
    items: [
      {
        target: "Writing",
        goal: "",
        score: 3,
        metricType: "Subjective",
        domain: "SkillAcquisition",
        rawValue: null,
        supportLevel: null,
        observation: "Completed assignment.",
      },
    ],
    abcObservations: [],
  };
  const finalSnapshot = {
    ...baseline,
    items: [
      {
        ...baseline.items[0],
        observation: "Completed assignment with one verbal prompt.",
      },
    ],
  };

  currentContext = {
    ...baseContext(),
    documentationRecords: [
      {
        id: "entry-2",
        kind: "ClassroomProgress",
        completedAt: "2026-07-30T02:00:00.000Z",
        updatedAt: "2026-07-30T02:02:00.000Z",
        providerName: "Casey Sch",
        providerRole: "Educator",
        note: null,
        observations: [],
        revisions: [
          {
            id: "revision-3",
            revisionNumber: 3,
            createdAt: "2026-07-30T02:02:00.000Z",
            createdByName: "Casey Sch",
            createdByRole: "Educator",
            snapshot: finalSnapshot,
            changes: [],
          },
          {
            id: "revision-2",
            revisionNumber: 2,
            createdAt: "2026-07-30T02:01:00.000Z",
            createdByName: "Casey Sch",
            createdByRole: "Educator",
            snapshot: finalSnapshot,
            changes: [],
          },
          {
            id: "revision-1",
            revisionNumber: 1,
            createdAt: "2026-07-30T02:00:00.000Z",
            createdByName: "Casey Sch",
            createdByRole: "Educator",
            snapshot: baseline,
            changes: [],
          },
        ],
      },
    ],
  };

  const result = await buildInsight(
    "client-1",
    "What did the educator update?",
    { category: "documentation", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].label, "Writing: Observation");
  assert.equal(
    result.evidence[0].value,
    "Completed assignment with one verbal prompt."
  );
  assert.doesNotMatch(result.summary, /Targets and responses/i);
});

test("provider comparison questions return tracked overlap", async () => {
  currentContext = {
    ...baseContext(),
    providerRelationships: [
      {
        providerId: "ot-1",
        providerName: "Kristine Bab",
        accountRole: "OccupationalTherapist",
        assignmentRole: "OccupationalTherapist",
        totalSessions: 4,
        activeGoals: [],
      },
      {
        providerId: "slp-1",
        providerName: "Michelle K",
        accountRole: "SpeechPathologist",
        assignmentRole: "SpeechPathologist",
        totalSessions: 5,
        activeGoals: [],
      },
    ],
    providerOverlap: [
      {
        providerAId: "ot-1",
        providerAName: "Kristine Bab",
        providerBId: "slp-1",
        providerBName: "Michelle K",
        sharedTargets: ["Functional communication"],
        sharedDomains: ["Communication"],
        relationshipMatches: [{}],
        uniqueDomains: {
          providerA: ["Regulation"],
          providerB: ["SkillAcquisition"],
        },
        overlappingSessions: [],
      },
    ],
  };

  const result = await buildInsight(
    "client-1",
    "How are the OT and speech-language pathologist contributing differently?",
    { category: "providers", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.headline, "Provider overlap");
  assert.match(result.summary, /Functional communication/);
  assert.match(result.summary, /Regulation/);
  assert.match(result.summary, /Skill Acquisition/);
});

test("provider observation questions return that provider's latest documentation", async () => {
  currentContext = {
    ...baseContext(),
    providerRelationships: [
      {
        providerId: "educator-1",
        providerName: "Casey Sch",
        accountRole: "Educator",
        assignmentRole: "Educator",
        totalSessions: 4,
        activeGoals: [],
      },
    ],
    documentationRecords: [
      {
        id: "entry-educator",
        kind: "ClassroomProgress",
        completedAt: "2026-07-30T15:00:00.000Z",
        updatedAt: "2026-07-30T15:00:00.000Z",
        providerId: "educator-1",
        providerName: "Casey Sch",
        providerRole: "Educator",
        note: "The client followed the visual classroom routine.",
        observations: [],
      },
    ],
  };

  const result = await buildInsight(
    "client-1",
    "What has the educator observed?",
    { category: "providers", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.headline, "Casey Sch contribution");
  assert.match(result.summary, /Classroom Progress/);
  assert.match(result.evidence[0].value, /visual classroom routine/);
});

test("progress target questions rank targets rather than providers", async () => {
  currentContext = {
    ...baseContext(),
    providerGoalSeries: [
      {
        providerId: "educator-1",
        providerName: "Casey Sch",
        goalKey: "writing",
        goalId: "goal-1",
        target: "Writing",
        goal: "Complete writing assignments",
        domain: "SkillAcquisition",
        metricType: "Subjective",
        trend: "flat",
        sessions: [
          {
            sessionId: "session-1",
            date: "2026-07-29T14:00:00.000Z",
            normalizedScore: 3,
          },
        ],
      },
      {
        providerId: "educator-1",
        providerName: "Casey Sch",
        goalKey: "directions",
        goalId: "goal-2",
        target: "Following Directions",
        goal: "Follow two-step directions",
        domain: "SkillAcquisition",
        metricType: "Subjective",
        trend: "up",
        sessions: [
          {
            sessionId: "session-2",
            date: "2026-07-29T14:00:00.000Z",
            normalizedScore: 7,
          },
        ],
      },
    ],
  };

  const result = await buildInsight(
    "client-1",
    "Which target currently needs the most support?",
    { category: "progress", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.headline, "Writing");
  assert.match(result.summary, /lowest consistency/);
  assert.doesNotMatch(result.summary, /provider group/i);
});

test("progress recognizes a named target without requiring the word target", async () => {
  currentContext = {
    ...baseContext(),
    providerGoalSeries: [
      {
        providerId: "educator-1",
        providerName: "Casey Sch",
        goalKey: "writing",
        goalId: "goal-1",
        target: "Writing",
        goal: "Complete writing assignments",
        domain: "SkillAcquisition",
        metricType: "Subjective",
        trend: "up",
        sessions: [
          {
            sessionId: "session-1",
            date: "2026-07-29T14:00:00.000Z",
            normalizedScore: 6,
          },
        ],
      },
    ],
  };

  const result = await buildInsight(
    "client-1",
    "How is Writing progressing?",
    { category: "progress", viewerProviderId: "supervisor-1" }
  );

  assert.equal(result.headline, "Writing");
  assert.match(result.summary, /is improving/);
});
