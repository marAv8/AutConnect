import { CLINICAL_TIME_ZONE } from "../libs/dateTime";

export const CLIENT_LIST_ENTRANCE_PREVIEW_PARAM = "replayClientListEntrance";
export const CLIENT_LIST_ENTRANCE_DURATION_MS = 600;
export const CLIENT_LIST_ENTRANCE_MAX_STAGGER_MS = 42;
export const CLIENT_LIST_ENTRANCE_TRAVEL_PX = 14;
export const CLIENT_LIST_ENTRANCE_SCALE = 0.98;
export const CLIENT_LIST_ENTRANCE_OPACITY = 0.92;
export const CLIENT_LIST_ENTRANCE_EASING = "cubic-bezier(0.22, 1.12, 0.36, 1)";

export const ARRIVAL_SPRING_OMEGA = 16;
export const ARRIVAL_FAST_SPRING_OMEGA = 28;
export const ARRIVAL_SPRING_FRAME_COUNT = 121;
export const ARRIVAL_CLIENT_START_SCALE = 0.72;
export const ARRIVAL_CLIENT_DURATION_MS = 1000;
export const ARRIVAL_CLIENT_DAMPING = 0.6;
export const ARRIVAL_PROVIDER_START_SCALE = 0.7;
export const ARRIVAL_PROVIDER_DURATION_MS = 620;
export const ARRIVAL_PROVIDER_FIRST_DELAY_MS = 0;
export const ARRIVAL_PROVIDER_STAGGER_MS = 32;
export const ARRIVAL_PROVIDER_DAMPING = 0.55;
export const ARRIVAL_ACTION_START_SCALE = 0.68;
export const ARRIVAL_ACTION_DURATION_MS = 580;
export const ARRIVAL_ACTION_FOLLOW_DELAY_MS = 28;
export const ARRIVAL_ACTION_DAMPING = 0.58;
export const ARRIVAL_UTILITY_START_SCALE = 0.7;
export const ARRIVAL_UTILITY_DURATION_MS = 620;
export const ARRIVAL_UTILITY_FIRST_DELAY_MS = 0;
export const ARRIVAL_UTILITY_STAGGER_MS = 32;

export type DashboardArrivalPhase = "grid" | "orbit" | "utilities";

export type DashboardArrivalCoordinator = {
  shouldStart: (phase: DashboardArrivalPhase) => boolean;
};

// The preview allowance is document-scoped: a full reload replays it for
// review, while SPA remounts and history restoration do not.
const previewClaims = new Set<string>();

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINICAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type ClientListEntranceOffset = { x: number; y: number };

export function clientListEntranceDayKey(value: Date | string | number) {
  const parts = Object.fromEntries(
    dayFormatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isClientListEntrancePreview(
  search = typeof window === "undefined" ? "" : window.location.search
) {
  if (process.env.NODE_ENV !== "development") return false;
  return new URLSearchParams(search).get(CLIENT_LIST_ENTRANCE_PREVIEW_PARAM) === "1";
}

// Keep the explicit local preview opt-in when dashboard history normalizes URLs.
// This does not enable replay in production or modify the daily allowance.
export function preserveClientListEntrancePreview(destination: string) {
  if (typeof window === "undefined" || !isClientListEntrancePreview()) return destination;
  if (destination !== "/dashboard" && !destination.startsWith("/dashboard?")) return destination;
  const url = new URL(destination, window.location.origin);
  url.searchParams.set(CLIENT_LIST_ENTRANCE_PREVIEW_PARAM, "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function claimClientListDailyEntrance(
  accountId: string,
  now = new Date(),
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage
) {
  const key = [
    "autconnect",
    "client-list-entrance",
    accountId,
    clientListEntranceDayKey(now),
  ].join(":");

  try {
    if (storage.getItem(key) === "1") return false;
    storage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

export function springScaleKeyframes(
  startScale: number,
  durationMs: number,
  damping: number,
  omega = ARRIVAL_SPRING_OMEGA
) {
  const dampedOmega = omega * Math.sqrt(1 - damping * damping);

  return Array.from({ length: ARRIVAL_SPRING_FRAME_COUNT }, (_, index) => {
    const progress = index / (ARRIVAL_SPRING_FRAME_COUNT - 1);
    const time = (progress * durationMs) / 1000;
    const displacement =
      Math.exp(-damping * omega * time) *
      (Math.cos(dampedOmega * time) +
        ((damping * omega) / dampedOmega) *
          Math.sin(dampedOmega * time));
    const scale =
      index === ARRIVAL_SPRING_FRAME_COUNT - 1
        ? 1
        : 1 - (1 - startScale) * displacement;

    return { transform: `scale(${scale})`, offset: progress };
  });
}

export function createDashboardArrivalCoordinator(
  accountId: string
): DashboardArrivalCoordinator {
  let eligible: boolean | null = null;
  const startedPhases = new Set<DashboardArrivalPhase>();

  const resolveEligibility = () => {
    if (eligible !== null) return eligible;

    if (isClientListEntrancePreview()) {
      eligible = !previewClaims.has(accountId);
      previewClaims.add(accountId);
      return eligible;
    }

    eligible = claimClientListDailyEntrance(
      accountId,
      new Date(),
      window.localStorage
    );
    return eligible;
  };

  return {
    shouldStart(phase) {
      if (startedPhases.has(phase) || !resolveEligibility()) return false;
      startedPhases.add(phase);
      return true;
    },
  };
}

export function intersectsClientListViewport(
  badge: Pick<DOMRect, "top" | "right" | "bottom" | "left">,
  viewport: Pick<DOMRect, "top" | "right" | "bottom" | "left">
) {
  // Require positive visible area; touching an edge alone is still offscreen.
  return (
    Math.min(badge.right, viewport.right) > Math.max(badge.left, viewport.left) &&
    Math.min(badge.bottom, viewport.bottom) > Math.max(badge.top, viewport.top)
  );
}

export function clientListEntranceOffset({
  badge,
  viewport,
  columnCount,
}: {
  badge: Pick<DOMRect, "top" | "left" | "width" | "height">;
  viewport: Pick<DOMRect, "top" | "left" | "width" | "height">;
  columnCount: number;
}): ClientListEntranceOffset {
  const badgeCenterX = badge.left + badge.width / 2;
  const badgeCenterY = badge.top + badge.height / 2;
  const viewportCenterX = viewport.left + viewport.width / 2;
  const viewportCenterY = viewport.top + viewport.height / 2;

  if (columnCount === 2) {
    return badgeCenterX < viewportCenterX
      ? { x: -CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 }
      : { x: CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 };
  }

  if (columnCount >= 3) {
    const middleColumnRange = badge.width * 0.42;
    if (badgeCenterX < viewportCenterX - middleColumnRange) {
      return { x: -CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 };
    }
    if (badgeCenterX > viewportCenterX + middleColumnRange) {
      return { x: CLIENT_LIST_ENTRANCE_TRAVEL_PX, y: 0 };
    }
  }

  return badgeCenterY <= viewportCenterY
    ? { x: 0, y: -CLIENT_LIST_ENTRANCE_TRAVEL_PX }
    : { x: 0, y: CLIENT_LIST_ENTRANCE_TRAVEL_PX };
}
