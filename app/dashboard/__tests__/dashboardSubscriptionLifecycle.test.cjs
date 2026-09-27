/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Execute the actual owner effects, not a copy of their subscription logic.
// React's setup/cleanup scheduler is controlled here to exercise retained refs
// (Strict Mode / reactivation) independently of a particular router cache.
function historyEffects(owner) {
  const filename = `app/dashboard/${owner}Dashboard.tsx`;
  const source = fs.readFileSync(filename, "utf8");
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect") {
      const text = node.getText(tree);
      if (text.includes("historyInitializedRef") || text.includes('"popstate"')) calls.push(text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(calls.length >= 2);
  return ts.transpileModule(calls.join(";\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function harness(owner) {
  const key = owner === "Supervisor" ? "autConnectDashboardLayer" : "autConnectProviderDashboardLayer";
  const listeners = new Set();
  const writes = [];
  const changes = [];
  const removed = [];
  const initial = { mode: "orbit", activeClientId: "fixture-a", navigation: {} };
  const window = {
    location: { href: "https://fixture.invalid/dashboard", origin: "https://fixture.invalid" },
    history: { state: { [key]: initial }, replaceState: (...args) => writes.push(args) },
    addEventListener(type, listener) { assert.equal(type, "popstate"); listeners.add(listener); },
    removeEventListener(type, listener) {
      assert.equal(type, "popstate");
      assert.ok(listeners.has(listener), "cleanup must remove its installed listener");
      removed.push(listener);
      listeners.delete(listener);
    },
  };
  const refs = {
    historyInitializedRef: { current: false },
    initialHistoryLayerRef: { current: {
      assignedClientIds: new Set(["fixture-a"]), clientIds: new Set(["fixture-a"]),
    } },
  };
  const render = (generation) => {
    const effects = [];
    const scope = {
      ...refs, window, DASHBOARD_HISTORY_KEY: key, PROVIDER_DASHBOARD_HISTORY_KEY: key,
      // Policy validation has its own tests; supply a validated existing entry.
      isDashboardNavigationProvenance: () => true,
      dashboardHistoryLayerMatchesLocation: () => true,
      assignedClients: [{ id: "fixture-a" }], clients: [{ id: "fixture-a" }],
      dashboardLocationKey: "fixture",
      closeDashboardMenu: () => changes.push([generation, "close"]),
      useEffect: (setup, dependencies) => effects.push({ setup, dependencies }),
    };
    for (const name of ["setMode", "setActiveClientId", "setInsightsOpen", "setPendingClientAction", "setClientActionError"]) {
      scope[name] = value => changes.push([generation, name, value]);
    }
    vm.runInNewContext(historyEffects(owner), scope);
    return () => {
      const cleanups = effects.map(effect => effect.setup());
      return () => cleanups.forEach(cleanup => cleanup?.());
    };
  };
  return { listeners, removed, changes, writes, render, window, refs,
    pop(layer) { for (const listener of listeners) listener({ state: { [key]: layer } }); },
  };
}

for (const owner of ["Supervisor", "Provider"]) {
  test(`${owner}: activation subscribes and cleanup removes that exact listener`, () => {
    const h = harness(owner);
    const cleanup = h.render(1)();
    assert.equal(h.listeners.size, 1);
    const installed = [...h.listeners][0];
    h.changes.length = 0;
    h.pop({ mode: "orbit", activeClientId: "fixture-b", insightsOpen: true });
    assert.ok(h.changes.some(change => change[1] === "setActiveClientId" && change[2] === "fixture-b"));
    cleanup();
    assert.equal(h.listeners.size, 0);
    assert.equal(h.removed[0], installed);
    h.changes.length = 0;
    h.pop({ mode: "grid" });
    assert.equal(h.changes.length, 0);
  });

  test(`${owner}: retained-ref reactivation keeps exactly one current listener for five cycles`, () => {
    const h = harness(owner);
    const activate = h.render(1);
    for (let cycle = 0; cycle < 5; cycle++) {
      const cleanup = activate();
      assert.equal(h.listeners.size, 1, `active cycle ${cycle}`);
      h.changes.length = 0;
      h.pop({ mode: "grid", activeClientId: `fixture-${cycle}` });
      assert.equal(h.changes.filter(change => change[1] === "setMode").length, 1);
      cleanup();
      assert.equal(h.listeners.size, 0);
    }
    assert.equal(h.writes.length, 0, "reactivation must not rewrite existing history");
  });

  test(`${owner}: rerun replaces closures and restores an entry whose popstate was missed`, () => {
    const h = harness(owner);
    h.render(1)()();
    const key = Object.keys(h.window.history.state)[0];
    h.window.history.state[key] = { mode: "grid", activeClientId: "fixture-a", navigation: {} };
    h.changes.length = 0;
    const cleanup = h.render(2)();
    assert.ok(h.changes.some(change => change[0] === 2 && change[1] === "setMode" && change[2] === "grid"));
    assert.equal(h.listeners.size, 1);
    h.changes.length = 0;
    h.pop({ mode: "orbit", activeClientId: "fixture-b" });
    assert.ok(h.changes.length > 0);
    assert.ok(h.changes.every(change => change[0] === 2), "no obsolete closure may run");
    cleanup();
  });

  test(`${owner}: full remount initializes anew without retaining the old subscription`, () => {
    const h = harness(owner);
    h.render(1)()();
    h.refs.historyInitializedRef.current = false;
    const cleanup = h.render(2)();
    assert.equal(h.listeners.size, 1);
    assert.equal(h.refs.historyInitializedRef.current, true);
    assert.equal(h.writes.length, 0);
    cleanup();
  });
}
