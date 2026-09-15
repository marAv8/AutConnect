/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only reproduction: execute the actual owner effect bodies, without a
// Dashboard fixture, authentication substitution, or production behavior edit.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const navigationContext = vm.createContext({ exports: {}, URL });
vm.runInContext(compile(fs.readFileSync(path.join(root, 'app/dashboard/dashboardNavigation.ts'), 'utf8')), navigationContext);

function ownerEffect(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const ast = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
      const callback = node.arguments[0];
      if (callback?.getText(ast).includes('historyInitializedRef.current = true')) matches.push(callback.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(matches.length, 1, 'exactly one actual initialization/listener effect');
  return compile(`globalThis.runEffect = ${matches[0]};`);
}

for (const owner of ['Supervisor', 'Provider']) {
  test(`${owner}: setup-cleanup-setup reattaches and handles popstate`, () => {
    const role = owner.toLowerCase();
    const key = owner === 'Supervisor' ? 'autConnectDashboardLayer' : 'autConnectProviderDashboardLayer';
    const clientId = 'synthetic-client-b';
    const listeners = new Set();
    const timeline = [];
    const initialized = { current: false };
    const layer = { mode: 'orbit', activeClientId: clientId,
      navigation: { version: 1, owner: role, rootId: 'synthetic-root', mode: 'orbit', activeClientId: clientId, hasGridPredecessor: true } };
    const record = (category) => timeline.push(category);
    const context = vm.createContext({
      ...navigationContext.exports,
      historyInitializedRef: initialized,
      initialHistoryLayerRef: { current: { canOpenOrbit: false,
        assignedClientIds: new Set([clientId]), clientIds: new Set([clientId]) } },
      DASHBOARD_HISTORY_KEY: key, PROVIDER_DASHBOARD_HISTORY_KEY: key,
      setMode: (mode) => record(`mode:${mode}`), setActiveClientId: () => record('client-selected'),
      setInsightsOpen: () => {}, closeDashboardMenu: () => {},
      setPendingClientAction: () => {}, setClientActionError: () => {},
      window: {
        location: { href: `http://localhost/dashboard?clientId=${clientId}&view=orbit`, origin: 'http://localhost' },
        history: { state: { [key]: layer }, replaceState: () => record('replace') },
        addEventListener: (type, listener) => { assert.equal(type, 'popstate'); listeners.add(listener); record('attach'); },
        removeEventListener: (type, listener) => { assert.equal(type, 'popstate'); listeners.delete(listener); record('cleanup'); },
      },
    });
    vm.runInContext(ownerEffect(`app/dashboard/${owner}Dashboard.tsx`), context);
    const cleanup = context.runEffect();
    assert.equal(listeners.size, 1, 'first setup attaches');
    for (const listener of listeners) listener({ state: { [key]: { ...layer, mode: 'grid' } } });
    assert.ok(timeline.includes('mode:grid'), 'first subscription handles popstate');
    cleanup();
    assert.equal(listeners.size, 0, 'cleanup detaches');
    assert.equal(initialized.current, true, 'initialization ref is retained');
    context.runEffect();
    const callsBefore = timeline.length;
    for (const listener of listeners) listener({ state: { [key]: layer } });
    console.log(JSON.stringify({ owner: role, timeline, afterReplay: { attached: listeners.size, invoked: timeline.length > callsBefore, initialized: initialized.current } }));
    assert.equal(listeners.size, 1, 'second setup must reattach after cleanup');
    assert.ok(timeline.length > callsBefore, 'restored subscription must invoke owner');
  });
}
