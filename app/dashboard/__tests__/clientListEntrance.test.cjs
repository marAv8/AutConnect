/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
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

const entrance = require(path.join(root, "app/dashboard/clientListEntrance.ts"));

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test("daily eligibility uses the configured Los Angeles calendar day per account", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const beforeMidnight = new Date("2026-09-24T06:59:59.000Z");
  const afterMidnight = new Date("2026-09-24T07:00:01.000Z");

  assert.equal(entrance.clientListEntranceDayKey(beforeMidnight), "2026-09-23");
  assert.equal(entrance.clientListEntranceDayKey(afterMidnight), "2026-09-24");
  assert.equal(entrance.claimClientListDailyEntrance("account-a", beforeMidnight, storage), true);
  assert.equal(entrance.claimClientListDailyEntrance("account-a", beforeMidnight, storage), false);
  assert.equal(entrance.claimClientListDailyEntrance("account-b", beforeMidnight, storage), true);
  assert.equal(entrance.claimClientListDailyEntrance("account-a", afterMidnight, storage), true);
});

test("storage failure skips the decorative entrance", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("unavailable");
    },
    setItem() {
      throw new Error("unavailable");
    },
  };
  assert.equal(
    entrance.claimClientListDailyEntrance("account-a", new Date(), unavailableStorage),
    false
  );
});

test("preview replay is development-only", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  assert.equal(entrance.isClientListEntrancePreview("?replayClientListEntrance=1"), true);
  assert.equal(entrance.isClientListEntrancePreview("?replayClientListEntrance=0"), false);
  process.env.NODE_ENV = "production";
  assert.equal(entrance.isClientListEntrancePreview("?replayClientListEntrance=1"), false);
  process.env.NODE_ENV = originalNodeEnv;
});

test("dashboard URL normalization retains explicit development replay without changing other destinations", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWindow = global.window;
  try {
    global.window = { location: { origin: "http://localhost:3000", search: "?replayClientListEntrance=1" } };
    process.env.NODE_ENV = "development";
    const keep = entrance.preserveClientListEntrancePreview;
    assert.equal(keep("/dashboard"), "/dashboard?replayClientListEntrance=1");
    assert.equal(keep("/dashboard?clientId=test&view=orbit"), "/dashboard?clientId=test&view=orbit&replayClientListEntrance=1");
    assert.equal(keep("/dashboard?debugFirstActivation=1"), "/dashboard?debugFirstActivation=1&replayClientListEntrance=1");
    assert.equal(keep(keep("/dashboard")), keep("/dashboard"));
    assert.equal(keep("/login"), "/login");
    global.window.location.search = "";
    assert.equal(keep("/dashboard"), "/dashboard");
    global.window.location.search = "?replayClientListEntrance=1";
    process.env.NODE_ENV = "production";
    assert.equal(keep("/dashboard"), "/dashboard");
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});

test("initially visible badges participate including clipped top and bottom rows", () => {
  const viewport = { top: 10, right: 310, bottom: 410, left: 10 };
  assert.equal(
    entrance.intersectsClientListViewport({ top: 20, right: 140, bottom: 150, left: 10 }, viewport),
    true
  );
  assert.equal(
    entrance.intersectsClientListViewport({ top: 5, right: 140, bottom: 135, left: 10 }, viewport),
    true
  );
  assert.equal(
    entrance.intersectsClientListViewport({ top: 300, right: 140, bottom: 430, left: 10 }, viewport),
    true
  );
});

test("intersection excludes offscreen, edge-only, and zero-area badges", () => {
  const viewport = { top: 10, right: 310, bottom: 410, left: 10 };
  for (const badge of [
    { top: 410, bottom: 530, left: 10, right: 130 },
    { top: 411, bottom: 531, left: 10, right: 130 },
    { top: -110, bottom: 10, left: 10, right: 130 },
    { top: 20, bottom: 140, left: 310, right: 430 },
    { top: 20, bottom: 140, left: -110, right: 10 },
    { top: 20, bottom: 20, left: 10, right: 130 },
  ]) assert.equal(entrance.intersectsClientListViewport(badge, viewport), false);
  for (const badge of [
    { top: 409.75, bottom: 530, left: 10, right: 130 },
    { top: 20, bottom: 140, left: 309.75, right: 430 },
    { top: 20, bottom: 140, left: -100, right: 10.25 },
  ]) assert.equal(entrance.intersectsClientListViewport(badge, viewport), true);
});

test("directions follow the rendered two- and three-column arrangement", () => {
  const viewport = { top: 0, left: 0, width: 600, height: 600 };
  const badge = (left, top) => ({ left, top, width: 120, height: 120 });

  assert.deepEqual(
    entrance.clientListEntranceOffset({ badge: badge(90, 100), viewport, columnCount: 2 }),
    { x: -entrance.CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 }
  );
  assert.deepEqual(
    entrance.clientListEntranceOffset({ badge: badge(390, 100), viewport, columnCount: 2 }),
    { x: entrance.CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 }
  );
  assert.deepEqual(
    entrance.clientListEntranceOffset({ badge: badge(60, 100), viewport, columnCount: 3 }),
    { x: -entrance.CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 }
  );
  assert.deepEqual(
    entrance.clientListEntranceOffset({ badge: badge(420, 100), viewport, columnCount: 3 }),
    { x: entrance.CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 }
  );
  assert.deepEqual(
    entrance.clientListEntranceOffset({ badge: badge(240, 100), viewport, columnCount: 3 }),
    { x: 0, y: -entrance.CLIENT_LIST_ENTRANCE_TRAVEL_PX }
  );
  assert.deepEqual(
    entrance.clientListEntranceOffset({ badge: badge(240, 380), viewport, columnCount: 3 }),
    { x: 0, y: entrance.CLIENT_LIST_ENTRANCE_TRAVEL_PX }
  );
  assert.deepEqual(
    entrance.clientListEntranceOffset({ badge: badge(240, 240), viewport, columnCount: 3 }),
    { x: 0, y: -entrance.CLIENT_LIST_ENTRANCE_TRAVEL_PX }
  );
});

test("the overlapping arrival remains within the brief total timing cap", () => {
  assert.ok(
    entrance.CLIENT_LIST_ENTRANCE_DURATION_MS +
      entrance.CLIENT_LIST_ENTRANCE_MAX_STAGGER_MS <=
      650
  );
});

test("approved arrival springs use the preview response and finish exactly at rest", () => {
  const providerFrames = entrance.springScaleKeyframes(
    entrance.ARRIVAL_PROVIDER_START_SCALE,
    entrance.ARRIVAL_PROVIDER_DURATION_MS,
    entrance.ARRIVAL_PROVIDER_DAMPING,
    entrance.ARRIVAL_FAST_SPRING_OMEGA
  );
  const clientFrames = entrance.springScaleKeyframes(
    entrance.ARRIVAL_CLIENT_START_SCALE,
    entrance.ARRIVAL_CLIENT_DURATION_MS,
    entrance.ARRIVAL_CLIENT_DAMPING
  );

  assert.equal(providerFrames.length, 121);
  assert.equal(providerFrames[0].transform, "scale(0.7)");
  assert.ok(
    providerFrames.some(({ transform }) =>
      Number.parseFloat(transform.slice(6, -1)) > 1
    )
  );
  assert.equal(providerFrames.at(-1).transform, "scale(1)");
  assert.equal(clientFrames[0].transform, "scale(0.72)");
  assert.equal(clientFrames.at(-1).transform, "scale(1)");
});

test("refined provider and utility springs expand immediately around full size", () => {
  const providerFrames = entrance.springScaleKeyframes(
    entrance.ARRIVAL_PROVIDER_START_SCALE,
    entrance.ARRIVAL_PROVIDER_DURATION_MS,
    entrance.ARRIVAL_PROVIDER_DAMPING,
    entrance.ARRIVAL_FAST_SPRING_OMEGA
  );
  const frameAt100Ms = providerFrames[
    Math.round(
      (100 / entrance.ARRIVAL_PROVIDER_DURATION_MS) *
        (providerFrames.length - 1)
    )
  ];
  const scaleAt100Ms = Number.parseFloat(
    frameAt100Ms.transform.slice(6, -1)
  );

  assert.equal(entrance.ARRIVAL_PROVIDER_FIRST_DELAY_MS, 0);
  assert.equal(entrance.ARRIVAL_PROVIDER_DURATION_MS, 620);
  assert.equal(entrance.ARRIVAL_PROVIDER_STAGGER_MS, 32);
  assert.equal(entrance.ARRIVAL_ACTION_DURATION_MS, 580);
  assert.equal(entrance.ARRIVAL_ACTION_FOLLOW_DELAY_MS, 28);
  assert.equal(entrance.ARRIVAL_UTILITY_FIRST_DELAY_MS, 0);
  assert.equal(entrance.ARRIVAL_UTILITY_DURATION_MS, 620);
  assert.equal(entrance.ARRIVAL_UTILITY_STAGGER_MS, 32);
  assert.ok(scaleAt100Ms >= 0.95 && scaleAt100Ms <= 1.08);
});

test("one coordinator grants every arrival phase without letting one consumer block another", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWindow = global.window;
  const values = new Map();
  try {
    process.env.NODE_ENV = "production";
    global.window = {
      location: { search: "" },
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    };
    const coordinator = entrance.createDashboardArrivalCoordinator(
      "shared-phase-account"
    );

    assert.equal(coordinator.shouldStart("grid"), true);
    assert.equal(coordinator.shouldStart("utilities"), true);
    assert.equal(coordinator.shouldStart("orbit"), true);
    assert.equal(coordinator.shouldStart("utilities"), false);
    assert.equal(
      entrance.createDashboardArrivalCoordinator("shared-phase-account")
        .shouldStart("utilities"),
      false
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});

test("development override grants utilities without clearing a consumed daily allowance", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWindow = global.window;
  const values = new Map();
  try {
    process.env.NODE_ENV = "development";
    global.window = {
      location: { search: "?replayClientListEntrance=1" },
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    };
    entrance.claimClientListDailyEntrance(
      "preview-utility-account",
      new Date(),
      global.window.localStorage
    );
    const storedKeysBefore = [...values.keys()];

    assert.equal(
      entrance.createDashboardArrivalCoordinator("preview-utility-account")
        .shouldStart("utilities"),
      true
    );
    assert.deepEqual([...values.keys()], storedKeysBefore);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
