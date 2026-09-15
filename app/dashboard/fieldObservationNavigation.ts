import { getFieldObservationDashboardHref } from "../../src/lib/fieldObservation";
import {
  SUPERVISOR_DASHBOARD_HISTORY_KEY,
  isDashboardNavigationProvenance,
} from "./dashboardNavigation";
import {
  attachDashboardOrbitReturnMarker,
} from "./dashboardOrbitRestoration";

const FIELD_OBSERVATION_ORIGIN_PARAM = "dashboardOrigin";
const FIELD_OBSERVATION_ORIGIN_STORAGE_KEY =
  "autConnectFieldObservationDashboardOrigin";
const FIELD_OBSERVATION_ORIGIN_HISTORY_KEY =
  "autConnectFieldObservationDashboardOrigin";

type FieldObservationDashboardOrigin = {
  version: 1;
  token: string;
  clientId: string;
  returnHref: string;
  rootId: string;
};

type DashboardLayer = {
  mode?: unknown;
  activeClientId?: unknown;
  navigation?: unknown;
};

function fieldObservationPath(clientId: string) {
  return `/portal/supervisor/field-observation/${encodeURIComponent(clientId)}`;
}

export function fieldObservationDestinationUrl(
  clientId: string,
  originToken?: string
) {
  const path = fieldObservationPath(clientId);
  return originToken
    ? `${path}?${FIELD_OBSERVATION_ORIGIN_PARAM}=${encodeURIComponent(originToken)}`
    : path;
}

function validatedDashboardOrbitHref(
  value: string,
  clientId: string,
  sameOrigin: string
) {
  try {
    const url = new URL(value, sameOrigin);
    const keys = [...url.searchParams.keys()];
    if (
      url.origin !== sameOrigin ||
      url.pathname !== "/dashboard" ||
      url.searchParams.get("clientId") !== clientId ||
      url.searchParams.get("view") !== "orbit" ||
      keys.some((key) => key !== "clientId" && key !== "view")
    ) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function createFieldObservationDashboardOrigin({
  clientId,
  token,
  historyState,
  currentHref,
  sameOrigin,
}: {
  clientId: string;
  token: string;
  historyState: unknown;
  currentHref: string;
  sameOrigin: string;
}): FieldObservationDashboardOrigin | null {
  if (!historyState || typeof historyState !== "object") return null;
  const layer = (historyState as Record<string, unknown>)[
    SUPERVISOR_DASHBOARD_HISTORY_KEY
  ] as DashboardLayer | undefined;
  if (
    layer?.mode !== "orbit" ||
    layer.activeClientId !== clientId ||
    !isDashboardNavigationProvenance(layer.navigation, "supervisor") ||
    layer.navigation.mode !== "orbit" ||
    layer.navigation.activeClientId !== clientId
  ) {
    return null;
  }

  const returnHref = validatedDashboardOrbitHref(
    currentHref,
    clientId,
    sameOrigin
  );
  if (!returnHref) return null;

  return {
    version: 1,
    token,
    clientId,
    returnHref,
    rootId: layer.navigation.rootId,
  };
}

export function resolveFieldObservationDashboardOrigin({
  clientId,
  currentHref,
  sameOrigin,
  storedOrigin,
}: {
  clientId: string;
  currentHref: string;
  sameOrigin: string;
  storedOrigin: string | null;
}): FieldObservationDashboardOrigin | null {
  if (!storedOrigin) return null;

  try {
    const currentUrl = new URL(currentHref, sameOrigin);
    const expectedPath = fieldObservationPath(clientId);
    const token = currentUrl.searchParams.get(FIELD_OBSERVATION_ORIGIN_PARAM);
    const origin = JSON.parse(storedOrigin) as Partial<FieldObservationDashboardOrigin>;
    if (
      currentUrl.origin !== sameOrigin ||
      currentUrl.pathname !== expectedPath ||
      !token ||
      origin.version !== 1 ||
      origin.token !== token ||
      origin.clientId !== clientId ||
      typeof origin.rootId !== "string" ||
      !origin.rootId
    ) {
      return null;
    }

    const returnHref = validatedDashboardOrbitHref(
      String(origin.returnHref ?? ""),
      clientId,
      sameOrigin
    );
    return returnHref
      ? { ...(origin as FieldObservationDashboardOrigin), returnHref }
      : null;
  } catch {
    return null;
  }
}

export function hasFieldObservationDashboardOriginInHistory({
  clientId,
  currentHref,
  sameOrigin,
  historyState,
}: {
  clientId: string;
  currentHref: string;
  sameOrigin: string;
  historyState: unknown;
}) {
  if (!historyState || typeof historyState !== "object") return false;
  const origin = (historyState as Record<string, unknown>)[
    FIELD_OBSERVATION_ORIGIN_HISTORY_KEY
  ];
  if (!origin) return false;
  return Boolean(
    resolveFieldObservationDashboardOrigin({
      clientId,
      currentHref,
      sameOrigin,
      storedOrigin: JSON.stringify(origin),
    })
  );
}

function navigationToken() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function prepareFieldObservationNavigation(
  clientId: string,
  presentationKey?: string
) {
  if (typeof window === "undefined") {
    return fieldObservationDestinationUrl(clientId);
  }

  const token = navigationToken();
  const origin = createFieldObservationDashboardOrigin({
    clientId,
    token,
    historyState: window.history.state,
    currentHref: window.location.href,
    sameOrigin: window.location.origin,
  });
  if (!origin) return fieldObservationDestinationUrl(clientId);

  try {
    if (presentationKey) {
      window.history.replaceState(
        attachDashboardOrbitReturnMarker({
          historyState: window.history.state,
          clientId,
          rootId: origin.rootId,
          presentationKey,
        }),
        ""
      );
    }
    // Next's router has no public state argument, so this opaque marker bridges
    // only the pending in-app navigation and is consumed by the destination.
    window.sessionStorage.setItem(
      FIELD_OBSERVATION_ORIGIN_STORAGE_KEY,
      JSON.stringify(origin)
    );
    return fieldObservationDestinationUrl(clientId, token);
  } catch {
    return fieldObservationDestinationUrl(clientId);
  }
}

export function hasTrustedFieldObservationDashboardOrigin(clientId: string) {
  if (typeof window === "undefined") return false;
  return hasFieldObservationDashboardOriginInHistory({
    clientId,
    currentHref: window.location.href,
    sameOrigin: window.location.origin,
    historyState: window.history.state,
  });
}

export function establishFieldObservationDashboardOrigin(clientId: string) {
  if (typeof window === "undefined") return false;
  if (hasTrustedFieldObservationDashboardOrigin(clientId)) return true;

  let storedOrigin: string | null = null;
  try {
    storedOrigin = window.sessionStorage.getItem(
      FIELD_OBSERVATION_ORIGIN_STORAGE_KEY
    );
  } catch {
    return false;
  }
  const origin = resolveFieldObservationDashboardOrigin({
    clientId,
    currentHref: window.location.href,
    sameOrigin: window.location.origin,
    storedOrigin,
  });
  if (!origin) return false;

  window.history.replaceState(
    // Preserve the framework's router tree while binding trust to this entry.
    {
      ...window.history.state,
      [FIELD_OBSERVATION_ORIGIN_HISTORY_KEY]: origin,
    },
    ""
  );
  try {
    window.sessionStorage.removeItem(FIELD_OBSERVATION_ORIGIN_STORAGE_KEY);
  } catch {
    // The history entry remains the authoritative marker after transfer.
  }
  return true;
}

export function fieldObservationDashboardFallback(clientId: string) {
  return getFieldObservationDashboardHref(clientId);
}

type FieldObservationBackActivation = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
};

export function runFieldObservationBackNavigation({
  event,
  clientId,
  hasTrustedOrigin,
  back,
  replace,
}: {
  event: FieldObservationBackActivation;
  clientId: string;
  hasTrustedOrigin: boolean;
  back: () => void;
  replace: (href: string) => void;
}) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }

  event.preventDefault();
  if (hasTrustedOrigin) {
    back();
  } else {
    replace(fieldObservationDashboardFallback(clientId));
  }
  return true;
}
