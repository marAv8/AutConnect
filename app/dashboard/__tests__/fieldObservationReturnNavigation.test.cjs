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

const dashboardNavigation = require(path.join(
  root,
  "app/dashboard/dashboardNavigation.ts"
));
const fieldNavigation = require(path.join(
  root,
  "app/dashboard/fieldObservationNavigation.ts"
));
const orbitRestoration = require(path.join(
  root,
  "app/dashboard/dashboardOrbitRestoration.ts"
));

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

function supervisorOrbitState(clientId = "client-b") {
  const grid = dashboardNavigation.gridNavigationProvenance(
    "supervisor",
    "root-a",
    "client-a"
  );
  const orbit = dashboardNavigation.orbitNavigationProvenance(grid, clientId);
  return {
    [dashboardNavigation.SUPERVISOR_DASHBOARD_HISTORY_KEY]: {
      mode: "orbit",
      activeClientId: clientId,
      navigation: orbit,
    },
    __NA: true,
  };
}

function createOrigin(overrides = {}) {
  return fieldNavigation.createFieldObservationDashboardOrigin({
    clientId: "client-b",
    token: "token-b",
    historyState: supervisorOrbitState(),
    currentHref: "https://local.test/dashboard?clientId=client-b&view=orbit",
    sameOrigin: "https://local.test",
    ...overrides,
  });
}

test("grid to Client B to Field Observation adds one entry and explicit Back restores Client B", () => {
  const history = [
    { url: "/dashboard", state: { mode: "grid" } },
    {
      url: "/dashboard?clientId=client-b&view=orbit",
      state: supervisorOrbitState(),
    },
  ];
  let index = 1;
  const origin = createOrigin();
  assert.ok(origin);

  history.push({
    url: fieldNavigation.fieldObservationDestinationUrl("client-b", origin.token),
    state: { __NA: true },
  });
  index += 1;

  const resolved = fieldNavigation.resolveFieldObservationDashboardOrigin({
    clientId: "client-b",
    currentHref: `https://local.test${history[index].url}`,
    sameOrigin: "https://local.test",
    storedOrigin: JSON.stringify(origin),
  });
  assert.equal(resolved?.returnHref, history[index - 1].url);

  const calls = { prevented: 0, replaced: [], backed: 0 };
  fieldNavigation.runFieldObservationBackNavigation({
    event: {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => { calls.prevented += 1; },
    },
    clientId: "client-b",
    hasTrustedOrigin: Boolean(resolved),
    back: () => { index -= 1; calls.backed += 1; },
    replace: (href) => calls.replaced.push(href),
  });

  assert.equal(index, 1);
  assert.equal(history[index].url, "/dashboard?clientId=client-b&view=orbit");
  assert.equal(calls.prevented, 1);
  assert.equal(calls.backed, 1);
  assert.deepEqual(calls.replaced, []);

  index += 1;
  assert.match(history[index].url, /field-observation\/client-b/);
});

test("browser Back and Forward preserve the existing orbit and Field Observation entries", () => {
  const origin = createOrigin();
  const history = [
    { url: "/dashboard", state: { mode: "grid" } },
    {
      url: origin.returnHref,
      state: supervisorOrbitState(),
    },
    {
      url: fieldNavigation.fieldObservationDestinationUrl("client-b", origin.token),
      state: { __NA: true },
    },
  ];
  let index = 2;

  index -= 1;
  assert.equal(history[index].url, "/dashboard?clientId=client-b&view=orbit");
  assert.equal(
    history[index].state[dashboardNavigation.SUPERVISOR_DASHBOARD_HISTORY_KEY]
      .activeClientId,
    "client-b"
  );

  index += 1;
  assert.match(history[index].url, /dashboardOrigin=token-b/);
});

test("Field Observation return marker is exact to Client and provider arrangement across repeated returns", () => {
  const originalState = supervisorOrbitState();
  const presentationKey = "client-b|supervisor-b|provider-a|supervisor-b";
  const attachedState = orbitRestoration.attachDashboardOrbitReturnMarker({
    historyState: originalState,
    clientId: "client-b",
    rootId: "root-a",
    presentationKey,
  });

  const restored = orbitRestoration.readDashboardOrbitReturnMarker({
    historyState: attachedState,
    clientId: "client-b",
    presentationKey,
  });
  assert.ok(restored);
  // The marker belongs to the history entry, so Forward followed by Back can
  // restore the same already-viewed presentation without manufacturing layers.
  assert.deepEqual(
    orbitRestoration.readDashboardOrbitReturnMarker({
      historyState: attachedState,
      clientId: "client-b",
      presentationKey,
    }),
    restored
  );

  for (const mismatch of [
    { clientId: "client-a", presentationKey },
    { clientId: "client-b", presentationKey: `${presentationKey}|changed` },
  ]) {
    assert.equal(
      orbitRestoration.readDashboardOrbitReturnMarker({
        historyState: attachedState,
        ...mismatch,
      }),
      null
    );
  }

  assert.equal(attachedState.__NA, true);
});

test("return entrance marker contains identity but no stale layout geometry", () => {
  const marker = orbitRestoration.attachDashboardOrbitReturnMarker({
    historyState: supervisorOrbitState(),
    clientId: "client-b",
    rootId: "root-a",
    presentationKey: "client-b|supervisor-b|provider-a|supervisor-b",
  });
  const restored = orbitRestoration.readDashboardOrbitReturnMarker({
    historyState: marker,
    clientId: "client-b",
    presentationKey: "client-b|supervisor-b|provider-a|supervisor-b",
  });

  assert.deepEqual(Object.keys(restored).sort(), [
    "clientId",
    "owner",
    "presentationKey",
    "rootId",
    "version",
  ]);
});

test("Field Observation navigation stores the presentation on the actual orbit entry", () => {
  const priorWindow = global.window;
  const stored = new Map();
  let historyState = supervisorOrbitState();
  global.window = {
    history: {
      get state() {
        return historyState;
      },
      replaceState(nextState) {
        historyState = nextState;
      },
    },
    location: {
      href: "https://local.test/dashboard?clientId=client-b&view=orbit",
      origin: "https://local.test",
    },
    sessionStorage: {
      setItem(key, value) {
        stored.set(key, value);
      },
    },
  };

  try {
    const destination = fieldNavigation.prepareFieldObservationNavigation(
      "client-b",
      "client-b|supervisor-b|provider-a|supervisor-b"
    );
    assert.match(destination, /dashboardOrigin=/);
    assert.ok(
      orbitRestoration.readDashboardOrbitReturnMarker({
        historyState,
        clientId: "client-b",
        presentationKey: "client-b|supervisor-b|provider-a|supervisor-b",
      })
    );
    assert.equal(stored.size, 1);
  } finally {
    global.window = priorWindow;
  }
});

test("presentation restoration cannot be attached to a different Dashboard history entry", () => {
  const presentationKey = "client-b|supervisor-b";
  const gridState = {
    [dashboardNavigation.SUPERVISOR_DASHBOARD_HISTORY_KEY]: {
      mode: "grid",
      activeClientId: "client-b",
      navigation: dashboardNavigation.gridNavigationProvenance(
        "supervisor",
        "root-a",
        "client-b"
      ),
    },
  };

  assert.equal(
    orbitRestoration.attachDashboardOrbitReturnMarker({
      historyState: gridState,
      clientId: "client-b",
      rootId: "root-a",
      presentationKey,
    }),
    gridState
  );
  const orbitState = supervisorOrbitState();
  assert.equal(
    orbitRestoration.attachDashboardOrbitReturnMarker({
      historyState: orbitState,
      clientId: "client-b",
      rootId: "different-root",
      presentationKey,
    }),
    orbitState
  );
});

test("direct or untrusted Field Observation entry replaces with the fixed Client orbit fallback", () => {
  const calls = { back: 0, replace: [] };
  fieldNavigation.runFieldObservationBackNavigation({
    event: {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() {},
    },
    clientId: "client / b",
    hasTrustedOrigin: false,
    back: () => { calls.back += 1; },
    replace: (href) => calls.replace.push(href),
  });

  assert.equal(calls.back, 0);
  assert.deepEqual(calls.replace, [
    "/dashboard?clientId=client%20%2F%20b&view=orbit",
  ]);
});

test("origin validation rejects mismatched Clients, unsafe destinations, and forged tokens", () => {
  assert.equal(createOrigin({ clientId: "client-a" }), null);
  assert.equal(
    createOrigin({
      currentHref: "https://evil.test/dashboard?clientId=client-b&view=orbit",
    }),
    null
  );
  assert.equal(
    createOrigin({
      currentHref:
        "https://local.test/dashboard?clientId=client-b&view=orbit&next=https://evil.test",
    }),
    null
  );

  const origin = createOrigin();
  assert.equal(
    fieldNavigation.resolveFieldObservationDashboardOrigin({
      clientId: "client-b",
      currentHref:
        "https://local.test/portal/supervisor/field-observation/client-b?dashboardOrigin=forged",
      sameOrigin: "https://local.test",
      storedOrigin: JSON.stringify(origin),
    }),
    null
  );
});

test("destination consumes the session marker into its exact history entry and preserves framework state", () => {
  const origin = createOrigin();
  const currentHref =
    "https://local.test/portal/supervisor/field-observation/client-b?dashboardOrigin=token-b";
  let storedOrigin = JSON.stringify(origin);
  const history = {
    state: { __NA: true, frameworkValue: "preserved" },
    replaceState(nextState) {
      this.state = nextState;
    },
  };
  const originalWindow = global.window;
  global.window = {
    history,
    location: { href: currentHref, origin: "https://local.test" },
    sessionStorage: {
      getItem: () => storedOrigin,
      removeItem: () => { storedOrigin = null; },
    },
  };

  try {
    assert.equal(
      fieldNavigation.establishFieldObservationDashboardOrigin("client-b"),
      true
    );
    assert.equal(storedOrigin, null);
    assert.equal(history.state.__NA, true);
    assert.equal(history.state.frameworkValue, "preserved");
    assert.equal(
      fieldNavigation.hasTrustedFieldObservationDashboardOrigin("client-b"),
      true
    );
  } finally {
    global.window = originalWindow;
  }
});

test("reloaded Field Observation trusts its existing history entry without adding history", () => {
  const origin = createOrigin();
  const currentHref =
    "https://local.test/portal/supervisor/field-observation/client-b?dashboardOrigin=token-b";
  const historyState = {
    __NA: true,
    autConnectFieldObservationDashboardOrigin: origin,
  };

  for (let reload = 0; reload < 2; reload += 1) {
    assert.equal(
      fieldNavigation.hasFieldObservationDashboardOriginInHistory({
        clientId: "client-b",
        currentHref,
        sameOrigin: "https://local.test",
        historyState,
      }),
      true
    );
  }
});

test("an old copied destination URL is not trusted after its transfer marker is consumed", () => {
  assert.equal(
    fieldNavigation.hasFieldObservationDashboardOriginInHistory({
      clientId: "client-b",
      currentHref:
        "https://local.test/portal/supervisor/field-observation/client-b?dashboardOrigin=token-b",
      sameOrigin: "https://local.test",
      historyState: { __NA: true },
    }),
    false
  );
});

test("repeated entry and exit adds only one Level 3 entry per active journey", () => {
  const baseHistory = ["/dashboard", "/dashboard?clientId=client-b&view=orbit"];
  for (let journey = 0; journey < 3; journey += 1) {
    const history = [...baseHistory];
    history.push(fieldNavigation.fieldObservationDestinationUrl("client-b", `token-${journey}`));
    assert.equal(history.length, 3);
    history.pop();
    assert.deepEqual(history, baseHistory);
  }
});

test("modified Back-link activation preserves native link behavior", () => {
  let prevented = false;
  let navigated = false;
  const handled = fieldNavigation.runFieldObservationBackNavigation({
    event: {
      button: 0,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => { prevented = true; },
    },
    clientId: "client-b",
    hasTrustedOrigin: true,
    back: () => { navigated = true; },
    replace: () => { navigated = true; },
  });
  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.equal(navigated, false);
});

test("direct orbit provenance has no fictional grid predecessor", () => {
  for (const owner of ["supervisor", "provider"]) {
    const direct = dashboardNavigation.directDashboardOrbitProvenance(
      owner,
      `${owner}-root`,
      "client-b"
    );
    assert.equal(direct.mode, "orbit");
    assert.equal(direct.activeClientId, "client-b");
    assert.equal(direct.hasGridPredecessor, false);
    assert.equal(
      dashboardNavigation.canReturnToDashboardGrid(direct, owner),
      false
    );
  }
});

test("Dashboard controllers replace direct orbit entries and do not synthesize an orbit push", () => {
  for (const file of ["SupervisorDashboard.tsx", "ProviderDashboard.tsx"]) {
    const source = fs.readFileSync(path.join(root, "app/dashboard", file), "utf8");
    const directBranch = source.slice(
      source.indexOf("else if ("),
      source.indexOf("} else {", source.indexOf("else if (") + 1)
    );
    assert.match(directBranch, /directDashboardOrbitProvenance/);
    assert.match(directBranch, /history\.replaceState/);
    assert.doesNotMatch(directBranch, /history\.pushState/);
  }
});

test("Field Observation reserves the browser edge while retaining interior card swipes", () => {
  const source = fs.readFileSync(
    path.join(
      root,
      "app/portal/supervisor/field-observation/[clientId]/FieldObservationForm.tsx"
    ),
    "utf8"
  );
  assert.match(source, /useGuardedSwipe\(\{[\s\S]*edgeGuard: 24/);
  assert.match(source, /onSwipeLeft: \(\) => goToCard\(1\)/);
  assert.match(source, /onSwipeRight: \(\) => goToCard\(-1\)/);
});
