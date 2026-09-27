/* Opt-in diagnostic probe. Application activation is gated by the dashboard flag.
 * No text, values, URLs, attributes containing identifiers, or network writes.
 * Call __autConnectFirstActivationProbe.stop() to remove instrumentation.
 */
function installFirstActivationProbe() {
  if (window.__autConnectFirstActivationProbe) return;
  const routeIsFlagged = () => window.location.pathname === '/dashboard' && new URLSearchParams(window.location.search).getAll('debugFirstActivation').length === 1 && new URLSearchParams(window.location.search).get('debugFirstActivation') === '1';
  const dashboardOnly = routeIsFlagged();
  let stopSubscriber = null;
  const stopOutsideDashboard = () => {
    if (dashboardOnly && !routeIsFlagged()) { window.__autConnectFirstActivationProbe?.stop(); return true; }
    return false;
  };
  const events = [];
  let sequence = 0;
  let active = true;
  const startedAt = performance.now();
  const now = () => Math.round(performance.now() * 10) / 10;
  const record = (kind, detail = {}) => {
    if (!active) return;
    events.push({ sequence: ++sequence, at: now(), kind, ...detail });
    if (events.length > 600) events.splice(64, events.length - 600);
  };
  const selectors = [
    ['guide', '.dashboard-info-control'], ['more', '[data-dashboard-trace-control="more"]'],
    ['inbox', '[data-dashboard-trace-control="inbox"]'], ['theme', '[data-dashboard-trace-control="theme"]'],
    ['provider-plus', '[data-dashboard-trace-control="provider-action"]'],
    ['client-list', '.dashboard-client-list-control'], ['grid-client', '[data-client-grid-mode] .glass-client-badge'],
    ['guide-dialog', '.dashboard-product-guide'], ['inbox-menu', '.dashboard-inbox-menu'],
    ['provider-menu', '.provider-action-menu'], ['provider-backdrop', '.provider-action-menu-backdrop'],
    ['workflow', '[data-dashboard-trace-layer="workflow-overlay"]'], ['more-surface', '.dashboard-action-surface'],
    ['carousel', '.client-carousel-stage'], ['dock', '.dashboard-utility-dock'],
    ['footer', '.dashboard-utility-footer-region'], ['stage', '.dashboard-client-stage-region'],
    ['workspace', '.dashboard-workspace-layout'], ['shell', '.dashboard-shared-shell'],
  ];
  const ids = new WeakMap();
  let nextId = 0;
  const identity = node => {
    if (!node || (typeof node !== 'object' && typeof node !== 'function')) return 0;
    if (!ids.has(node)) ids.set(node, ++nextId);
    return ids.get(node);
  };
  const category = node => {
    if (node === window) return 'window';
    if (node === document) return 'document';
    if (!(node instanceof Element)) return 'other';
    return selectors.find(([, selector]) => node.matches(selector))?.[0] || 'unclassified';
  };
  const control = node => {
    if (!(node instanceof Element)) return category(node);
    for (const [name, selector] of selectors) if (node.closest(selector)) return name;
    return 'unclassified';
  };
  const style = node => {
    const css = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { node: identity(node), category: category(node), tag: ['HTML', 'BODY', 'DIV', 'SECTION', 'MAIN', 'NAV', 'BUTTON', 'A', 'SPAN', 'SVG', 'PATH', 'INPUT', 'TEXTAREA', 'SELECT', 'HEADER', 'FORM'].includes(node.tagName.toUpperCase()) ? node.tagName.toUpperCase() : 'OTHER',
      pointerEvents: css.pointerEvents, touchAction: css.touchAction, position: css.position,
      opacity: css.opacity, visibility: css.visibility, display: css.display,
      zIndex: css.zIndex, transformed: css.transform !== 'none',
      inert: !!node.closest('[inert]'), disabled: node.matches(':disabled'),
      rect: [rect.x, rect.y, rect.width, rect.height].map(Math.round) };
  };
  const ancestors = node => {
    const result = [];
    while (node instanceof Element && result.length < 12) { result.push(style(node)); node = node.parentElement; }
    return result;
  };
  const state = () => ({
    grid: !!document.querySelector('[data-client-grid-mode]'), orbit: !!document.querySelector('.client-carousel-stage'),
    providerMenu: !!document.querySelector('.provider-action-menu'),
    closingMenu: !!document.querySelector('.provider-action-menu--closing'),
    providerBackdrop: !!document.querySelector('.provider-action-menu-backdrop'),
    workflow: !!document.querySelector('[data-dashboard-trace-layer="workflow-overlay"]'),
    guide: !!document.querySelector('.dashboard-product-guide'), inbox: !!document.querySelector('.dashboard-inbox-menu'),
    dark: !!document.documentElement?.classList.contains('dark'),
    inertCount: document.querySelectorAll('[inert]').length,
    shells: document.querySelectorAll('.dashboard-shared-shell').length,
    workspaceNode: identity(document.querySelector('.dashboard-workspace-layout')),
  });
  const surfaceState = () => selectors.filter(([name]) => ['guide-dialog', 'inbox-menu', 'provider-menu', 'workflow'].includes(name))
    .flatMap(([name, selector]) => {
      const node = document.querySelector(selector);
      if (!node) return [];
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      const chain = ancestors(node);
      return [{ surface: name, ...style(node), painted: box.width > 0 && box.height > 0 && chain.every(item => item.opacity !== '0' && item.visibility !== 'hidden' && item.display !== 'none'), hitOwner: control(hit), ownsCenterHit: node.contains(hit) }];
    });
  const historyState = () => {
    const clean = layer => ({ present: !!layer, mode: ['grid', 'orbit'].includes(layer?.mode) ? layer.mode : 'other' });
    return { provider: clean(history.state?.autConnectProviderDashboardLayer), supervisor: clean(history.state?.autConnectDashboardLayer) };
  };
  const originals = { add: EventTarget.prototype.addEventListener, remove: EventTarget.prototype.removeEventListener,
    push: history.pushState, replace: history.replaceState };
  const listeners = [];
  const watchTypes = new Set(['popstate', 'pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'click', 'keydown']);
  const capture = options => typeof options === 'boolean' ? options : !!options?.capture;
  function add(type, callback, options) {
    const result = originals.add.call(this, type, callback, options);
    if (watchTypes.has(type)) record('listener-add', { type, target: category(this), node: identity(this), callback: identity(callback), capture: capture(options) });
    return result;
  }
  function remove(type, callback, options) {
    const result = originals.remove.call(this, type, callback, options);
    if (watchTypes.has(type)) record('listener-remove', { type, target: category(this), node: identity(this), callback: identity(callback), capture: capture(options) });
    return result;
  }
  EventTarget.prototype.addEventListener = add;
  EventTarget.prototype.removeEventListener = remove;
  const observeHistory = method => function(...args) {
    const result = originals[method].apply(this, args);
    if (!stopOutsideDashboard()) record('history-' + method, historyState());
    return result;
  };
  const push = observeHistory('push');
  const replace = observeHistory('replace');
  history.pushState = push;
  history.replaceState = replace;
  const listen = (target, type, callback, options) => {
    originals.add.call(target, type, callback, options);
    listeners.push(() => originals.remove.call(target, type, callback, options));
  };
  const onEvent = phase => event => {
    if (event.composedPath().some(node => node instanceof Element && node.hasAttribute('data-first-activation-diagnostic'))) return;
    const contact = event.changedTouches?.[0] || event;
    const x = contact.clientX, y = contact.clientY;
    const eventAt = event.timeStamp > performance.timeOrigin ? event.timeStamp - performance.timeOrigin : event.timeStamp;
    const detail = { type: event.type, phase, target: control(event.target), targetNode: identity(event.target),
      eventAt: Math.round(eventAt * 10) / 10, dispatchLagMs: Math.max(0, Math.round(performance.now() - eventAt)),
      trusted: event.isTrusted, defaultPrevented: event.defaultPrevented, ...state() };
    if (phase === 'document-capture' && Number.isFinite(x) && Number.isFinite(y)) {
      detail.point = [Math.round(x), Math.round(y)];
      detail.expectedControls = selectors.slice(0, 7).filter(([, selector]) => [...document.querySelectorAll(selector)].some(node => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      })).map(([name]) => name);
      detail.surfaces = surfaceState();
      detail.hit = document.elementsFromPoint(x, y).slice(0, 8).map(style);
      detail.ancestors = ancestors(event.target);
      detail.pointerCaptured = event.target instanceof Element && Number.isInteger(event.pointerId) && event.target.hasPointerCapture(event.pointerId);
    }
    record('input', detail);
  };
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'touchstart', 'touchend', 'touchcancel', 'click']) {
    listen(window, type, onEvent('window-capture'), { capture: true, passive: true });
    listen(document, type, onEvent('document-capture'), { capture: true, passive: true });
    listen(document, type, onEvent('document-bubble'), { passive: true });
  }
  listen(window, 'popstate', () => { if (!stopOutsideDashboard()) record('popstate', historyState()); }, { passive: true });
  listen(window, 'pageshow', event => record('pageshow', { persisted: event.persisted }), { passive: true });
  listen(window, 'pagehide', event => record('pagehide', { persisted: event.persisted }), { passive: true });
  let lastState = '';
  const snapshot = () => {
    if (!active || stopOutsideDashboard()) return;
    const value = state(); const key = JSON.stringify(value);
    if (key !== lastState) { lastState = key; record('state', { ...value, surfaces: surfaceState() }); }
  };
  const observer = new MutationObserver(snapshot);
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'inert', 'aria-expanded'] });
  const performanceObservers = [];
  const supportedPerformanceTypes = typeof PerformanceObserver !== 'undefined'
    ? (PerformanceObserver.supportedEntryTypes || []) : [];
  for (const type of ['longtask', 'event']) {
    if (!supportedPerformanceTypes.includes(type)) continue;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) record('performance', { type, start: Math.round(entry.startTime), duration: Math.round(entry.duration) });
    });
    try {
      observer.observe({ type, buffered: false }); performanceObservers.push(observer);
    } catch { observer.disconnect(); }
  }
  window.__autConnectFirstActivationProbe = {
    startedAt,
    onStop: callback => {
      stopSubscriber = callback;
      return () => { if (stopSubscriber === callback) stopSubscriber = null; };
    },
    // Records contain only JSON data; support Safari versions without structuredClone.
    read: () => JSON.parse(JSON.stringify(events)),
    // Optional Web Inspector logpoint; fixed labels only, no arbitrary payload.
    mark: label => {
      if (['guide-handler', 'inbox-handler', 'theme-handler', 'provider-menu-handler',
        'client-list-handler', 'grid-client-handler', 'provider-listener-attached',
        'provider-listener-cleaned', 'owner-effect-active'].includes(label)) record('logpoint', { label });
    },
    snapshot: () => { snapshot(); return { ...state(), history: historyState() }; },
    stop: () => {
      active = false; events.length = 0; sequence = 0; lastState = ""; observer.disconnect(); performanceObservers.forEach(item => item.disconnect()); listeners.forEach(remove => remove());
      if (EventTarget.prototype.addEventListener === add) EventTarget.prototype.addEventListener = originals.add;
      if (EventTarget.prototype.removeEventListener === remove) EventTarget.prototype.removeEventListener = originals.remove;
      if (history.pushState === push) history.pushState = originals.push;
      if (history.replaceState === replace) history.replaceState = originals.replace;
      delete window.__autConnectFirstActivationProbe;
      const notifyStop = stopSubscriber; stopSubscriber = null; notifyStop?.();
    },
  };
  record('installed', { readyState: document.readyState, performanceTypes: ['longtask', 'event'].filter(type => supportedPerformanceTypes.includes(type)) });
  snapshot();

}
// Importable by the flagged dashboard; still runnable as a standalone inspector probe.
if (typeof module === "object" && module.exports) module.exports = installFirstActivationProbe;
else installFirstActivationProbe();
