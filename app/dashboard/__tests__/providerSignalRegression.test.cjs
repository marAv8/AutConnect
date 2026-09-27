/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  );
};

const { providerSignalState } = require("../providerSignalState.ts");
const {
  markDashboardProviderEntriesRead,
  projectDashboardEntrySaved,
} = require("../clientCarouselModel.ts");
const {
  millisecondsUntilNextProviderNoteSignalDay,
  providerNoteSignalDayKey,
  providerNoteSignalDayWindow,
} = require("../../libs/providerNoteSignalDay.ts");
const { sevenDayHistoryStart } = require("../../libs/documentationDay.ts");

const author = "synthetic-author";
const today = new Date("2026-09-24T19:00:00.000Z");
const signalDayKey = providerNoteSignalDayKey(today);

function entry(overrides = {}) {
  return {
    id: "synthetic-entry",
    providerId: author,
    status: "COMPLETED",
    visibility: "Shared",
    completedAt: new Date("2026-09-24T18:00:00.000Z"),
    reads: [{ readAt: null }],
    ...overrides,
  };
}

function signal(entryState, isCurrentProvider = false) {
  return providerSignalState({
    entries: [entryState],
    isCurrentProvider,
    locallyCompleted: false,
    signalDayKey,
  });
}

test("publish is full strength and successful presentation dims only that viewer", () => {
  const published = entry();
  assert.equal(signal(published).showSignal, true);
  assert.equal(signal(published).isSignalDimmed, false);

  const viewerClient = { id: "client-1", entries: [published] };
  const readForViewer = markDashboardProviderEntriesRead(
    [viewerClient],
    "client-1",
    author,
    [published.id]
  )[0].entries[0];

  assert.equal(signal(readForViewer).showSignal, true);
  assert.equal(signal(readForViewer).isSignalDimmed, true);
  assert.equal(signal(entry({ reads: [{ readAt: null }] })).isSignalDimmed, false);

  const styles = fs.readFileSync(require.resolve("../../globals.css"), "utf8");
  assert.match(
    styles,
    /\.glass-badge-action--signal-dimmed \{[\s\S]*opacity: 0\.34;/
  );
});

test("empty and failed history loads cannot acknowledge a provider note", () => {
  const overlay = fs.readFileSync(require.resolve("../DashboardNoteOverlay.tsx"), "utf8");
  assert.match(
    overlay,
    /if \(!payload\.entries\?\.length\) \{[\s\S]*setStatus\("empty"\);[\s\S]*return;[\s\S]*setHistoryData\(payload\)/
  );
  assert.match(overlay, /catch \(error\) \{[\s\S]*setStatus\("error"\)/);
  assert.match(overlay, /historyData\.presentedEntryIds\.length === 0[\s\S]*return;/);
  assert.match(overlay, /method: "POST"[\s\S]*if \(!response\.ok\) return null/);
  assert.match(overlay, /onRead\?\.\(providerId, payload\.acknowledgedEntryIds\)/);
});

test("local acknowledgement is limited to Entry IDs returned by history", () => {
  const shown = entry({ id: "shown" });
  const hidden = entry({ id: "hidden" });
  const projected = markDashboardProviderEntriesRead(
    [{ id: "client-1", entries: [shown, hidden] }],
    "client-1",
    author,
    [shown.id]
  )[0];

  assert.ok(projected.entries[0].reads[0].readAt instanceof Date);
  assert.equal(projected.entries[1].reads[0].readAt, null);

  const historyRoute = fs.readFileSync(
    require.resolve("../../api/notes/history/route.ts"),
    "utf8"
  );
  assert.match(historyRoute, /presentedEntries\.length > 0 \? entries\.map\(\(entry\) => entry\.id\) : \[\]/);
  assert.match(historyRoute, /entryIds = Array\.isArray\(body\?\.entryIds\)/);
  assert.match(historyRoute, /entryId: \{ in: acknowledgedEntryIds \}/);
});

test("published same-day update gets a new signal version while draft status does not", () => {
  const readEntry = entry({ reads: [{ readAt: today }] });
  const clients = [{ id: "client-1", entries: [readEntry], recentEntries: [] }];
  const publishedUpdate = projectDashboardEntrySaved(
    clients,
    "client-1",
    author,
    readEntry.id,
    "SessionNote",
    "Shared",
    "COMPLETED",
    author
  )[0].entries[0];
  const draftSave = projectDashboardEntrySaved(
    clients,
    "client-1",
    author,
    readEntry.id,
    "SessionNote",
    "Shared",
    "IN_PROGRESS",
    author
  )[0].entries[0];

  assert.ok(publishedUpdate.completedAt instanceof Date);
  assert.equal(draftSave.completedAt, readEntry.completedAt);

  const reactivatedForViewer = {
    ...publishedUpdate,
    completedAt: today,
    reads: [{ readAt: null }],
  };
  assert.equal(signal(reactivatedForViewer).isSignalDimmed, false);
  const reread = markDashboardProviderEntriesRead(
    [{ id: "client-1", entries: [reactivatedForViewer] }],
    "client-1",
    author,
    [reactivatedForViewer.id]
  )[0].entries[0];
  assert.equal(signal(reread).isSignalDimmed, true);

  const readStateSource = fs.readFileSync(
    require.resolve("../../libs/entryReadState.ts"),
    "utf8"
  );
  assert.match(readStateSource, /if \(reactivateForTeammates\)[\s\S]*readAt: null/);
});

test("Los Angeles midnight clears unread, read, and late-night update signals", () => {
  const beforeMidnight = new Date("2026-09-25T06:59:59.000Z");
  const midnight = new Date("2026-09-25T07:00:00.000Z");
  const lateUpdate = entry({ completedAt: beforeMidnight });

  assert.equal(
    providerSignalState({
      entries: [lateUpdate],
      isCurrentProvider: false,
      locallyCompleted: false,
      signalDayKey: providerNoteSignalDayKey(beforeMidnight),
    }).showSignal,
    true
  );
  assert.equal(
    providerSignalState({
      entries: [lateUpdate],
      isCurrentProvider: false,
      locallyCompleted: false,
      signalDayKey: providerNoteSignalDayKey(midnight),
    }).showSignal,
    false
  );
});

test("signal-day bounds and rollover delay use America/Los_Angeles", () => {
  const now = new Date("2026-09-24T19:00:00.000Z");
  const window = providerNoteSignalDayWindow(now);
  assert.equal(window.start.toISOString(), "2026-09-24T07:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-09-25T07:00:00.000Z");
  assert.equal(millisecondsUntilNextProviderNoteSignalDay(now), 43_200_000);

  const fallBackDay = providerNoteSignalDayWindow(
    new Date("2026-11-01T12:00:00.000Z")
  );
  assert.equal(fallBackDay.start.toISOString(), "2026-11-01T07:00:00.000Z");
  assert.equal(fallBackDay.end.toISOString(), "2026-11-02T08:00:00.000Z");
});

test("open and resumed dashboards check rollover and refresh server state", () => {
  const carousel = fs.readFileSync(require.resolve("../ClientCarousel.tsx"), "utf8");
  assert.match(carousel, /millisecondsUntilNextProviderNoteSignalDay\(new Date\(\)\) \+ 50/);
  assert.match(carousel, /setProviderSignalDay\(nextSignalDay\)/);
  assert.match(carousel, /setEntryMutations\(\[\]\);[\s\S]*router\.refresh\(\)/);
  assert.match(carousel, /document\.addEventListener\("visibilitychange", checkVisibleDashboard\)/);
  assert.match(carousel, /window\.addEventListener\("focus", checkForRollover\)/);
  assert.match(carousel, /window\.addEventListener\("pageshow", checkForRollover\)/);
});

test("old unread notes cannot enter the signal query or provider signal state", () => {
  const page = fs.readFileSync(require.resolve("../page.tsx"), "utf8");
  assert.match(
    page,
    /completedAt: \{[\s\S]*gte: providerNoteSignalDay\.start,[\s\S]*lt: providerNoteSignalDay\.end/
  );
  assert.doesNotMatch(page, /teammate's unread shared completion survives day rollover/);

  const oldUnread = entry({ completedAt: new Date("2026-09-23T18:00:00.000Z") });
  assert.equal(signal(oldUnread).showSignal, false);
});

test("seven-consecutive-calendar-day history stays independent of signals", () => {
  assert.equal(
    sevenDayHistoryStart(new Date(2026, 8, 24, 14)).getTime(),
    new Date(2026, 8, 18, 0).getTime()
  );
  const historyRoute = fs.readFileSync(
    require.resolve("../../api/notes/history/route.ts"),
    "utf8"
  );
  assert.match(historyRoute, /date: \{[\s\S]*gte: sevenDaysAgo/);
});

test("author completion keeps the published icon and Update Note / View Note menu", () => {
  const state = signal(entry({ reads: [{ readAt: today }] }), true);
  const orbit = fs.readFileSync(require.resolve("../ClientOrbit.tsx"), "utf8");

  assert.equal(state.showSignal, false);
  assert.equal(state.showAction, true);
  assert.equal(state.hasCompletedNote, true);
  assert.match(orbit, /<FilePenLine\b/);
  assert.match(orbit, />\s*Update Note\s*</);
  assert.match(orbit, />\s*View Note\s*</);
  assert.match(orbit, />\s*View Notes\s*</);
});
