"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getCurrentTeamFocusVersion } from "@/app/actions/getCurrentTeamFocusVersion";
import type { DashboardTeamFocus } from "./dashboardClientTypes";
import { traceDashboardInteractionHandled } from "./dashboardInteractionTraceClient";

export const TEAM_FOCUS_OPEN_EVENT = "autconnect-open-team-focus";
export const TEAM_FOCUS_CAROUSEL_READY_EVENT =
  "autconnect-team-focus-carousel-ready";
const TEAM_FOCUS_SEEN_EVENT = "autconnect-team-focus-seen";
const TEAM_FOCUS_PULSE_DELAYS = [320, 1820, 3320] as const;

type Props = {
  clientId?: string;
  teamFocus?: DashboardTeamFocus;
  viewerProviderId: string;
  enabled?: boolean;
  canEdit?: boolean;
};

export default function TeamFocusSignalControl({
  clientId,
  teamFocus,
  viewerProviderId,
  enabled = true,
  canEdit = false,
}: Props) {
  const router = useRouter();
  const [isPulsing, setIsPulsing] = useState(false);
  const [pulseCycle, setPulseCycle] = useState(0);
  const [readyClientId, setReadyClientId] = useState<string | null>(null);
  const playedSignalEventKey = useRef<string | null>(null);
  const isAvailable = enabled && !!clientId && !!teamFocus;
  const isInteractive = enabled && !!clientId && (canEdit || !!teamFocus);
  const seenStorageKey = useMemo(
    () =>
      teamFocus
        ? [
            "autconnect",
            "team-focus-seen",
            viewerProviderId,
            teamFocus.id,
            new Date(teamFocus.updatedAt).toISOString(),
          ].join(":")
        : null,
    [teamFocus, viewerProviderId]
  );
  const currentVersion = teamFocus
    ? `${teamFocus.id}:${new Date(teamFocus.updatedAt).toISOString()}`
    : null;

  useEffect(() => {
    if (!enabled || !clientId) return;

    const markReady = (event: Event) => {
      const detail = (event as CustomEvent<{ clientId?: string }>).detail;
      if (detail?.clientId === clientId) {
        setReadyClientId(clientId);
      }
    };
    const fallback = window.setTimeout(() => {
      const stage = document.querySelector(
        `[data-team-focus-carousel-client="${clientId}"][data-team-focus-carousel-ready="true"]`
      );
      if (stage) {
        setReadyClientId(clientId);
      }
    }, 650);

    window.addEventListener(TEAM_FOCUS_CAROUSEL_READY_EVENT, markReady);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener(TEAM_FOCUS_CAROUSEL_READY_EVENT, markReady);
    };
  }, [clientId, enabled]);

  useEffect(() => {
    if (!enabled || !clientId) return;

    let cancelled = false;
    let checking = false;
    const checkForUpdate = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const nextVersion = await getCurrentTeamFocusVersion(clientId);
        if (!cancelled && nextVersion !== currentVersion) {
          router.refresh();
        }
      } catch {
        // A temporary connection issue should not interrupt the dashboard.
      } finally {
        checking = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };
    const interval = window.setInterval(() => void checkForUpdate(), 10_000);
    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clientId, currentVersion, enabled, router]);

  const hasBeenSeen = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(TEAM_FOCUS_SEEN_EVENT, onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(TEAM_FOCUS_SEEN_EVENT, onStoreChange);
      };
    },
    () =>
      !isAvailable ||
      !seenStorageKey ||
      window.localStorage.getItem(seenStorageKey) === "true",
    () => true
  );
  const isUnread = isAvailable && !hasBeenSeen;

  useEffect(() => {
    if (!isAvailable || !seenStorageKey) return;
    if (readyClientId !== clientId) return;
    if (window.localStorage.getItem(seenStorageKey) === "true") return;
    if (playedSignalEventKey.current === seenStorageKey) return;

    playedSignalEventKey.current = seenStorageKey;
    const frames: number[] = [];
    const pulseTimeouts: number[] = [];
    const startTimeouts = TEAM_FOCUS_PULSE_DELAYS.map((delay) =>
      window.setTimeout(() => {
        setIsPulsing(false);
        const frame = window.requestAnimationFrame(() => {
          setPulseCycle((current) => current + 1);
          setIsPulsing(true);
          pulseTimeouts.push(
            window.setTimeout(() => setIsPulsing(false), 1040)
          );
        });
        frames.push(frame);
      }, delay)
    );

    return () => {
      startTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      pulseTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [clientId, isAvailable, readyClientId, seenStorageKey]);

  const label = canEdit && !teamFocus
    ? "Create Team Focus"
    : !isAvailable
      ? "Team Focus is inactive"
    : isUnread
      ? canEdit
        ? "Open updated Team Focus"
        : "Read updated Team Focus"
      : canEdit
        ? "Edit Team Focus"
        : "Open Team Focus";

  return (
    <button
      type="button"
      className="material-control dashboard-round-icon-control dashboard-round-icon-control--arrival dashboard-team-focus-control"
      data-dashboard-trace-control="team-focus"
      aria-label={label}
      title={label}
      aria-disabled={!isInteractive}
      onClick={() => {
        traceDashboardInteractionHandled("team-focus");
        if (!isInteractive || !clientId) return;
        if (seenStorageKey) {
          window.localStorage.setItem(seenStorageKey, "true");
          window.dispatchEvent(new Event(TEAM_FOCUS_SEEN_EVENT));
        }
        setIsPulsing(false);
        window.dispatchEvent(
          new CustomEvent(TEAM_FOCUS_OPEN_EVENT, {
            detail: { clientId, mode: canEdit ? "edit" : "view" },
          })
        );
      }}
    >
      <span className="dashboard-utility-arrival-visual">
        <span
          aria-hidden="true"
          className={`dashboard-team-focus-signal${
            isUnread ? " dashboard-team-focus-signal--unread" : ""
          }${isPulsing ? " dashboard-team-focus-signal--pulse" : ""}`}
        >
          {isPulsing ? (
            <span
              key={`${seenStorageKey ?? "inactive"}:${pulseCycle}`}
              className="dashboard-team-focus-pulse-ring"
            />
          ) : null}
        </span>
      </span>
    </button>
  );
}
