const TRACE_QUERY_PARAMETER = "debugInteractions";

/**
 * Opt-in, session-local recorder. At most 160 distinct events are retained:
 * 32 earliest unique route/kind/state lifecycle markers; 30 events starting at
 * the first identifiable utility attempt plus its first handler/result state;
 * and 96 most recent events. Lanes overlap and exports deduplicate by sequence.
 * Association follows event order and labels, not a claim about causality.
 */
export function dashboardInteractionTraceBootstrap() {
  if (process.env.NODE_ENV === "production") return "";
  return `
    (() => {
      const enabledKey = "autconnect-dashboard-interaction-trace-enabled";
      const eventsKey = "autconnect-dashboard-interaction-trace-events";
      const maxEvents = 160;
      const allowedTargets = new Set([
        "client-list", "more", "inbox", "theme", "team-focus",
        "provider-action", "more-backdrop", "provider-backdrop",
        "workflow-overlay", "visibility-private", "visibility-team",
        "diagnostic-panel", "unclassified"
      ]);
      const allowedStates = new Set([
        "bootstrap", "hydrated", "visible", "hidden", "page-restored",
        "page-loaded", "grid", "orbit", "focused-workflow", "menu-open",
        "menu-closed", "visibility-private", "visibility-team",
        "documentation-open", "documentation-update", "documentation-closing",
        "documentation-closed", "inbox-open", "inbox-closed", "theme-light", "theme-dark"
      ]);
      const allowedKinds = new Set([
        "bootstrap", "capture-start", "pageshow", "pagehide", "visibility", "pointerdown",
        "pointerup", "pointercancel", "click-capture", "click-bubble",
        "popstate", "handler", "state", "touchstart", "touchend", "touchcancel"
      ]);
      const allowedRoutes = new Set([
        "auth", "dashboard", "field-observation", "note-workflow",
        "case-support", "portal-other", "other"
      ]);

      const routeCategory = () => {
        const path = window.location.pathname;
        if (path === "/dashboard") return "dashboard";
        if (path.startsWith("/portal/supervisor/field-observation")) return "field-observation";
        if (path.startsWith("/portal/notes")) return "note-workflow";
        if (path.startsWith("/portal/case-support")) return "case-support";
        if (path.startsWith("/portal")) return "portal-other";
        if (path === "/login" || path === "/create-account" || path === "/complete-profile") return "auth";
        return "other";
      };

      const requested = new URLSearchParams(window.location.search).get("${TRACE_QUERY_PARAMETER}") === "1";
      if (requested) window.sessionStorage.setItem(enabledKey, "1");
      if (window.sessionStorage.getItem(enabledKey) !== "1") return;

      let active = true;
      const controller = new AbortController();
      const listen = (target, name, handler, options = {}) =>
        target.addEventListener(name, handler, { ...options, signal: controller.signal });
      const utilityTargets = new Set(["more", "inbox", "theme", "team-focus"]);
      const utilityStates = {
        more: ["menu-open", "menu-closed"],
        inbox: ["inbox-open", "inbox-closed"],
        theme: ["theme-light", "theme-dark"],
        "team-focus": ["focused-workflow", "orbit"]
      };
      const markerKinds = new Set(["bootstrap", "capture-start", "pageshow", "pagehide", "visibility", "popstate"]);
      const markerStates = new Set(["hydrated", "grid", "orbit", "focused-workflow"]);
      const booleanFields = ["documentationMounted", "documentationClosing", "workflowMounted", "inboxMounted", "darkTheme", "defaultPrevented", "cancelable", "persisted"];
      const natural = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
      // Validate stored records too; unknown keys/values never enter an export.
      const sanitize = (value) => {
        if (!value || !allowedKinds.has(value.kind) || !allowedRoutes.has(value.route)
          || value.target === "diagnostic-panel" || !natural(value.sequence)) return null;
        const event = {
          sequence: natural(value.sequence), document: natural(value.document) || 1,
          elapsedMs: natural(value.elapsedMs), kind: value.kind, route: value.route
        };
        if (allowedTargets.has(value.target)) event.target = value.target;
        if (allowedTargets.has(value.hitTarget)) event.hitTarget = value.hitTarget;
        if (allowedStates.has(value.state)) event.state = value.state;
        if (["loading", "interactive", "complete"].includes(value.readyState)) event.readyState = value.readyState;
        for (const key of booleanFields) if (typeof value[key] === "boolean") event[key] = value[key];
        return event;
      };
      const empty = (sequence = 0, document = 1) => ({
        version: 2, sequence, document, totalRecorded: 0, legacyHistoryUnavailable: false,
        markers: [], firstContext: [], firstAttempt: null, firstHandler: null, firstState: null, recent: []
      });
      let capture = empty();
      const restoreCapture = () => {
        try {
          const stored = JSON.parse(window.sessionStorage.getItem(eventsKey) || "null");
          if (stored?.version === 2) {
            const lane = (name, limit) => Array.isArray(stored[name])
              ? stored[name].slice(0, limit).map(sanitize).filter(Boolean) : [];
            capture = {
              ...empty(natural(stored.sequence), natural(stored.document) + 1),
              totalRecorded: natural(stored.totalRecorded),
              legacyHistoryUnavailable: stored.legacyHistoryUnavailable === true,
              markers: lane("markers", 32), firstContext: lane("firstContext", 30),
              firstAttempt: sanitize(stored.firstAttempt), firstHandler: sanitize(stored.firstHandler),
              firstState: sanitize(stored.firstState), recent: lane("recent", 96)
            };
          } else if (Array.isArray(stored)) {
            // Retain sanitized legacy context; evidence already lost by v1 cannot be recovered.
            const legacy = stored.slice(-160);
            const knownProductEvents = legacy.map(sanitize).filter(Boolean);
            capture.recent = knownProductEvents.slice(-96);
            capture.sequence = Math.max(0, ...legacy.map(event => natural(event?.sequence)));
            capture.totalRecorded = knownProductEvents.length;
            capture.legacyHistoryUnavailable = true;
            capture.document = 2;
          }
        } catch { /* An unreadable local trace starts empty. */ }
      };
      restoreCapture();
      const persist = () => window.sessionStorage.setItem(eventsKey, JSON.stringify(capture));
      const read = () => {
        const unique = new Map();
        for (const event of [...capture.markers, ...capture.firstContext, capture.firstHandler, capture.firstState, ...capture.recent]) {
          if (event) unique.set(event.sequence, event);
        }
        // Return copies: callers cannot mutate retained evidence.
        return [...unique.values()].sort((a, b) => a.sequence - b.sequence).map(event => ({ ...event }));
      };
      const changed = () => window.dispatchEvent(new CustomEvent("autconnect-dashboard-trace-updated"));
      const retain = (event) => {
        capture.totalRecorded++;
        const isMarker = markerKinds.has(event.kind) || (event.kind === "state" && markerStates.has(event.state));
        if (isMarker && capture.markers.length < 32 && !capture.markers.some(previous =>
          previous.kind === event.kind && previous.route === event.route && previous.state === event.state)) {
          capture.markers.push(event);
        }
        if (!capture.firstAttempt && utilityTargets.has(event.target)
          && ["pointerdown", "touchstart", "click-capture", "handler"].includes(event.kind)) {
          capture.firstAttempt = event;
        }
        if (capture.firstAttempt) {
          if (capture.firstContext.length < 30) capture.firstContext.push(event);
          if (!capture.firstHandler && event.kind === "handler" && event.target === capture.firstAttempt.target) {
            capture.firstHandler = event;
          }
          if (!capture.firstState && capture.firstHandler && event.sequence > capture.firstHandler.sequence
            && event.kind === "state" && utilityStates[capture.firstAttempt.target]?.includes(event.state)) {
            capture.firstState = event;
          }
        }
        capture.recent = [...capture.recent, event].slice(-96);
        persist();
        changed();
      };

      const classifyTarget = (element) => {
        if (!(element instanceof Element)) return "unclassified";
        const marked = element.closest("[data-dashboard-trace-control], [data-dashboard-trace-layer]");
        const candidate = marked?.getAttribute("data-dashboard-trace-control")
          || marked?.getAttribute("data-dashboard-trace-layer") || "unclassified";
        return allowedTargets.has(candidate) ? candidate : "unclassified";
      };
      const insidePanel = (event) => event.composedPath().some(node =>
        node instanceof Element && node.id === "autconnect-dashboard-trace-panel");
      const record = (kind, detail = {}) => {
        if (!active || !allowedKinds.has(kind) || detail.target === "diagnostic-panel") return;
        const route = routeCategory();
        const event = {
          sequence: ++capture.sequence, document: capture.document,
          elapsedMs: Math.round(performance.now()), kind,
          route: allowedRoutes.has(route) ? route : "other"
        };
        if (allowedTargets.has(detail.target)) event.target = detail.target;
        if (allowedTargets.has(detail.hitTarget)) event.hitTarget = detail.hitTarget;
        if (allowedStates.has(detail.state)) event.state = detail.state;
        event.readyState = document.readyState;
        const menu = document.querySelector('.provider-action-menu[role="menu"]');
        event.documentationMounted = Boolean(menu);
        event.documentationClosing = Boolean(menu?.classList.contains("provider-action-menu--closing"));
        event.workflowMounted = Boolean(document.querySelector('[data-dashboard-trace-layer="workflow-overlay"]'));
        event.inboxMounted = Boolean(document.querySelector(".dashboard-inbox-menu"));
        event.darkTheme = document.documentElement.classList.contains("dark");
        for (const key of ["defaultPrevented", "cancelable", "persisted"]) {
          if (typeof detail[key] === "boolean") event[key] = detail[key];
        }
        retain(event);
      };
      let resetOutput = () => {};
      const clear = () => {
        capture = empty(capture.sequence, capture.document);
        window.sessionStorage.removeItem(eventsKey);
        resetOutput();
        changed();
      };
      const fresh = () => {
        capture = empty(0, capture.document);
        resetOutput();
        record("capture-start", { state: "bootstrap" });
      };
      const disable = () => {
        active = false;
        controller.abort();
        resetOutput();
        window.sessionStorage.removeItem(enabledKey);
        window.sessionStorage.removeItem(eventsKey);
        document.getElementById("autconnect-dashboard-trace-panel")?.remove();
        delete window.__autConnectDashboardTrace;
      };
      window.__autConnectDashboardTrace = { record, read, clear, disable };

      const pointerEvent = (kind, event) => {
        if (insidePanel(event)) return;
        record(kind, {
          target: classifyTarget(event.target),
          hitTarget: classifyTarget(document.elementFromPoint(event.clientX, event.clientY)),
          defaultPrevented: event.defaultPrevented, cancelable: event.cancelable
        });
      };
      for (const kind of ["pointerdown", "pointerup", "pointercancel"]) {
        listen(document, kind, event => pointerEvent(kind, event), { capture: true, passive: true });
      }
      listen(document, "click", event => pointerEvent("click-capture", event), { capture: true });
      listen(document, "click", event => pointerEvent("click-bubble", event));
      for (const kind of ["touchstart", "touchend", "touchcancel"]) {
        listen(document, kind, (event) => {
          if (insidePanel(event)) return;
          const touch = event.changedTouches[0];
          record(kind, {
            target: classifyTarget(event.target),
            hitTarget: touch ? classifyTarget(document.elementFromPoint(touch.clientX, touch.clientY)) : "unclassified",
            defaultPrevented: event.defaultPrevented, cancelable: event.cancelable
          });
        }, { capture: true, passive: true });
      }
      listen(window, "popstate", () => record("popstate"));
      listen(window, "pageshow", event => {
        if (window.sessionStorage.getItem(enabledKey) !== "1") { disable(); return; }
        // A restored document must not overwrite evidence captured by a newer one.
        if (event.persisted) restoreCapture();
        record("pageshow", {
          state: event.persisted ? "page-restored" : "page-loaded", persisted: event.persisted
        });
      });
      listen(window, "pagehide", event => record("pagehide", { persisted: event.persisted }));
      listen(document, "visibilitychange", () => record("visibility", {
        state: document.visibilityState === "visible" ? "visible" : "hidden"
      }));
      record("bootstrap", { state: "bootstrap" });

      const mountPanel = () => {
        if (!active || document.getElementById("autconnect-dashboard-trace-panel")) return;
        const panel = document.createElement("details");
        panel.id = "autconnect-dashboard-trace-panel";
        panel.setAttribute("data-dashboard-trace-layer", "diagnostic-panel");
        panel.style.cssText = "position:fixed;right:8px;top:max(8px,env(safe-area-inset-top));z-index:2147483647;max-width:calc(100vw - 16px);max-height:calc(100dvh - 24px);overflow:auto;box-sizing:border-box;padding:7px 9px;border:1px solid rgba(127,127,127,.55);border-radius:9px;background:rgba(24,24,28,.94);color:white;font:12px/1.35 system-ui;box-shadow:0 4px 18px rgba(0,0,0,.3)";
        const summary = document.createElement("summary");
        const updateSummary = () => { summary.textContent = "Interaction trace (" + read().length + ")"; };
        updateSummary();
        const note = document.createElement("div");
        note.textContent = "Live capture continues separately. Show freezes a snapshot; Refresh snapshot replaces it. Missing events do not identify a cause.";
        note.style.cssText = "max-width:270px;margin:6px 0";
        const output = document.createElement("textarea");
        output.readOnly = true;
        output.setAttribute("aria-label", "Interaction trace output");
        output.style.cssText = "display:none;box-sizing:border-box;width:min(270px,calc(100vw - 42px));height:150px;margin-top:6px;background:#111;color:white;font:10px/1.3 monospace";
        const status = document.createElement("div");
        status.setAttribute("role", "status");
        status.style.cssText = "max-width:270px;margin-top:6px";
        let snapshot = null;
        let downloadUrl = null;
        const revokeDownload = () => {
          if (downloadUrl) URL.revokeObjectURL(downloadUrl);
          downloadUrl = null;
        };
        resetOutput = () => {
          snapshot = null;
          output.value = "";
          output.style.display = "none";
          revokeDownload();
        };
        const freeze = () => {
          const events = read();
          snapshot = JSON.stringify({
            version: 2,
            retention: { earlyUniqueMarkers: 32, firstUtilityContext: 30, firstUtilityHandlerAndState: 2, recentEvents: 96, maxRetainedEvents: maxEvents },
            totalRecorded: capture.totalRecorded,
            legacyHistoryUnavailable: capture.legacyHistoryUnavailable,
            droppedEvents: Math.max(0, capture.totalRecorded - events.length),
            firstUtility: capture.firstAttempt?.target || null,
            events
          }, null, 2);
          output.value = snapshot;
          output.style.display = "block";
          revokeDownload();
          status.textContent = "Snapshot frozen. Live capture continues separately.";
        };
        const ensureSnapshot = () => { if (snapshot === null) freeze(); return snapshot; };
        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;max-width:270px";
        const button = (label, action) => {
          const control = document.createElement("button");
          control.type = "button";
          control.textContent = label;
          control.style.cssText = "min-height:32px;padding:4px 7px;border:1px solid rgba(255,255,255,.4);border-radius:6px;background:transparent;color:inherit";
          control.addEventListener("click", action);
          return control;
        };
        const copy = button("Copy", async () => {
          const text = ensureSnapshot();
          copy.disabled = true;
          status.textContent = "Copying the displayed snapshot…";
          try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(text);
            if (active && snapshot === text) status.textContent = "Copied the displayed snapshot.";
          } catch {
            if (active && snapshot === text) status.textContent = "Automatic copy unavailable or denied. Use Select text, then your phone's Copy menu, or Download JSON.";
          } finally {
            copy.disabled = false;
          }
        });
        actions.append(
          button("Show", () => ensureSnapshot()),
          button("Refresh snapshot", freeze),
          copy,
          button("Select text", () => {
            ensureSnapshot();
            output.focus();
            output.select();
            output.setSelectionRange(0, output.value.length);
            status.textContent = "Text selected, not copied. Use your phone's Copy menu (long-press the field if needed), or Download JSON.";
          }),
          button("Download JSON", () => {
            const text = ensureSnapshot();
            try {
              revokeDownload();
              downloadUrl = URL.createObjectURL(new Blob([text], { type: "application/json" }));
              const link = document.createElement("a");
              link.href = downloadUrl;
              link.download = "autconnect-interaction-trace.json";
              panel.append(link);
              link.click();
              link.remove();
              status.textContent = "Download requested. Check your browser downloads; if unsupported, use Select text and the Copy menu.";
            } catch {
              status.textContent = "File download unavailable. Use Select text and your phone's Copy menu.";
            }
          }),
          button("Clear", () => {
            clear();
            status.textContent = "Recorded evidence and snapshot cleared. Live capture continues; sequence numbering is preserved.";
          }),
          button("Fresh capture", () => {
            fresh();
            status.textContent = "Fresh capture started: evidence cleared, sequence restarted. Sign in, try More once, then Show. Reload first if you need new page initialization.";
          }),
          button("Disable & delete", disable)
        );
        panel.append(summary, note, actions, output, status);
        document.body.append(panel);
        listen(window, "autconnect-dashboard-trace-updated", updateSummary);
      };
      if (document.readyState === "complete") mountPanel();
      else listen(window, "load", mountPanel, { once: true });
    })();
  `;
}
