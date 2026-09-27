import type {} from "@/diagnostics/firstActivationProbeTypes";
export type DashboardTraceControl =
  | "guide"
  | "grid-client"
  | "client-list"
  | "more"
  | "inbox"
  | "theme"
  | "team-focus"
  | "provider-action"
  | "visibility-private"
  | "visibility-team";

export type DashboardTraceState =
  | "documentation-open"
  | "documentation-update"
  | "documentation-closing"
  | "documentation-closed"
  | "inbox-open"
  | "inbox-closed"
  | "theme-light"
  | "theme-dark"
  | "hydrated"
  | "grid"
  | "orbit"
  | "focused-workflow"
  | "menu-open"
  | "menu-closed"
  | "visibility-private"
  | "visibility-team";

type DashboardTraceApi = {
  record: (
    kind: "handler" | "state",
    detail: { target?: DashboardTraceControl; state?: DashboardTraceState }
  ) => void;
};

declare global {
  interface Window {
    __autConnectDashboardTrace?: DashboardTraceApi & {
      read: () => unknown[];
      clear: () => void;
      disable: () => void;
    };
  }
}

const firstActivationHandlers: Partial<Record<DashboardTraceControl, string>> = {
  guide: "guide-handler", "grid-client": "grid-client-handler", "client-list": "client-list-handler",
  inbox: "inbox-handler", theme: "theme-handler", "provider-action": "provider-menu-handler",
};

export function traceDashboardInteractionHandled(control: DashboardTraceControl) {
  if (typeof window !== "undefined" && window.__autConnectFirstActivationProbe) {
    const label = firstActivationHandlers[control];
    if (label) window.__autConnectFirstActivationProbe.mark(label);
  }
  if (process.env.NODE_ENV === "production") return;
  window.__autConnectDashboardTrace?.record("handler", { target: control });
}

export function traceDashboardInteractionState(state: DashboardTraceState) {
  if (process.env.NODE_ENV === "production") return;
  window.__autConnectDashboardTrace?.record("state", { state });
}
