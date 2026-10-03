"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import styles from "./GridClientView.module.css";
import type { DashboardClient } from "./dashboardClientTypes";
import {
  ARRIVAL_PROVIDER_START_SCALE,
  ARRIVAL_PROVIDER_DURATION_MS,
  ARRIVAL_PROVIDER_STAGGER_MS,
  ARRIVAL_PROVIDER_DAMPING,
  ARRIVAL_FAST_SPRING_OMEGA,
  springScaleKeyframes,
  intersectsClientListViewport,
  type DashboardArrivalCoordinator,
} from "./clientListEntrance";

type Props = {
  clients: DashboardClient[];
  palette: string[];
  initialsOf: (firstName: string, lastName: string) => string;
  animatedClientId?: string;
  arrivalCoordinator: DashboardArrivalCoordinator;
  onClientClick: (clientId: string) => void;
  removalMode?: boolean;
  removableClientIds?: readonly string[];
  busyClientId?: string | null;
  onRemoveClient?: (clientId: string, name: string) => void;
};

export default function GridClientView({
  clients,
  palette,
  initialsOf,
  animatedClientId,
  arrivalCoordinator,
  onClientClick,
  removalMode = false,
  removableClientIds = [],
  busyClientId = null,
  onRemoveClient,
}: Props) {
  const scrollFrameRef = useRef<HTMLDivElement | null>(null);
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const badgeSlotRefs = useRef(new Map<string, HTMLDivElement>());
  const removableClientIdSet = new Set(removableClientIds);
  const clientCount = clients.length;
  const wideColumnCount = Math.max(1, Math.min(clientCount, 3));
  const wideVisibleRowCount = Math.max(
    1,
    Math.min(Math.ceil(clientCount / wideColumnCount), 3)
  );
  const narrowVisibleRowCount = Math.max(
    1,
    Math.min(Math.ceil(clientCount / 2), 3)
  );
  const clientListLayoutStyle = {
    "--client-list-wide-columns": wideColumnCount,
    "--client-list-wide-visible-rows": wideVisibleRowCount,
    "--client-list-narrow-visible-rows": narrowVisibleRowCount,
  } as CSSProperties;

  useLayoutEffect(() => {
    if (
      clients.length === 0 ||
      removalMode
    ) {
      return;
    }

    const frame = scrollFrameRef.current;
    const scrollRegion = scrollRegionRef.current;
    if (!frame || !scrollRegion) return;

    let firstFrame = 0;
    let secondFrame = 0;
    let cleanupTimer = 0;
    let settled = false;
    let scrollListenerAttached = false;
    const animations: Animation[] = [];

    const settle = () => {
      settled = true;
      animations.forEach((animation) => animation.cancel());
      animations.length = 0;
      if (scrollListenerAttached) {
        scrollRegion.removeEventListener("scroll", settleFromInput);
        scrollListenerAttached = false;
      }
      frame.dataset.clientListEntrance = "settled";
    };
    const settleFromInput = () => {
      settle();
    };

    scrollRegion.addEventListener("wheel", settleFromInput, { passive: true });
    scrollRegion.addEventListener("touchstart", settleFromInput, { passive: true });
    scrollRegion.addEventListener("pointerdown", settleFromInput, { passive: true });
    scrollRegion.addEventListener("keydown", settleFromInput);
    scrollRegion.addEventListener("focusin", settleFromInput);
    window.addEventListener("resize", settleFromInput, { passive: true });

    const startEntrance = () => {
      if (settled || document.visibilityState !== "visible") return;

      const viewportBounds = scrollRegion.getBoundingClientRect();
      const visibleSlots = clients
        .filter((client) => client.id !== animatedClientId)
        .map((client) => badgeSlotRefs.current.get(client.id))
        .filter((slot): slot is HTMLDivElement => Boolean(slot))
        .filter((slot) =>
          intersectsClientListViewport(slot.getBoundingClientRect(), viewportBounds)
        );

      if (visibleSlots.length === 0) return;

      if (!arrivalCoordinator.shouldStart("grid")) {
        settle();
        return;
      }

      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof visibleSlots[0].animate !== "function"
      ) {
        settle();
        return;
      }

      frame.dataset.clientListEntrance = "running";
      scrollRegion.addEventListener("scroll", settleFromInput, { passive: true });
      scrollListenerAttached = true;
      // Use the same stationary spring as provider badges, only for the
      // initially visible slots. Scrolling never schedules another entrance.
      const keyframes = springScaleKeyframes(
        ARRIVAL_PROVIDER_START_SCALE,
        ARRIVAL_PROVIDER_DURATION_MS,
        ARRIVAL_PROVIDER_DAMPING,
        ARRIVAL_FAST_SPRING_OMEGA
      );

      try {
        visibleSlots.forEach((slot, index) => {
          animations.push(
            slot.animate(
              keyframes,
              {
                duration: ARRIVAL_PROVIDER_DURATION_MS,
                delay: index * ARRIVAL_PROVIDER_STAGGER_MS,
                easing: "linear",
                fill: "backwards",
              }
            )
          );
        });
      } catch {
        settle();
        return;
      }

      cleanupTimer = window.setTimeout(
        settle,
        ARRIVAL_PROVIDER_DURATION_MS +
          (visibleSlots.length - 1) * ARRIVAL_PROVIDER_STAGGER_MS + 40
      );
    };

    const scheduleEntrance = () => {
      if (settled || document.visibilityState !== "visible") return;
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(startEntrance);
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleEntrance();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleEntrance();

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(cleanupTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (scrollListenerAttached) {
        scrollRegion.removeEventListener("scroll", settleFromInput);
      }
      scrollRegion.removeEventListener("wheel", settleFromInput);
      scrollRegion.removeEventListener("touchstart", settleFromInput);
      scrollRegion.removeEventListener("pointerdown", settleFromInput);
      scrollRegion.removeEventListener("keydown", settleFromInput);
      scrollRegion.removeEventListener("focusin", settleFromInput);
      window.removeEventListener("resize", settleFromInput);
      settle();
    };
  }, [animatedClientId, arrivalCoordinator, clients, removalMode]);

  return (
    <div className={styles.clientListModeFrame}>
      <div
        ref={scrollFrameRef}
        className={styles.clientListScrollFrame}
        data-client-grid-mode={removalMode ? "remove" : "browse"}
        data-client-count={clientCount}
        style={clientListLayoutStyle}
      >
        <div className={styles.clientListSurface} aria-hidden="true" />
        <div className={styles.clientListFades} aria-hidden="true" />
        <div
          ref={scrollRegionRef}
          className={`${styles.clientListScrollRegion} ${styles.containedScrollbar}`}
          data-client-list-scroll-region="true"
        >
          <div className={styles.clientBadgeGrid}>
            {clients.length === 0 && removalMode ? (
              <div className={styles.removalEmptyState} role="status">
                No assigned Clients remain.
              </div>
            ) : null}
            {clients.map((client, index) => {
              const clientName = `${client.firstName} ${client.lastName}`;
              const canRemove = removableClientIdSet.has(client.id);

              return (
                <div
                  ref={(element) => {
                    if (element) badgeSlotRefs.current.set(client.id, element);
                    else badgeSlotRefs.current.delete(client.id);
                  }}
                  className={styles.clientBadgeSlot}
                  data-client-list-badge={client.id}
                  key={client.id}
                >
                  <button
                    type="button"
                    className="glass-client-badge"
                    data-client-signal={
                      client.signal?.color !== "neutral" && client.signal?.isUnread
                        ? client.signal.color
                        : undefined
                    }
                    data-client-signal-status={
                      client.signal?.isUnread ? client.signal.status : undefined
                    }
                    aria-label={removalMode ? clientName : `Open ${clientName}`}
                    disabled={removalMode}
                    onClick={() => onClientClick(client.id)}
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      border: "none",
                      background: palette[index % palette.length],
                      color: "var(--foreground)",
                      boxShadow: "var(--shadow-dashboard-sphere)",
                      fontSize:
                        "clamp(34px, calc(var(--dashboard-grid-orb-size) * 0.283), 40px)",
                      fontWeight: 500,
                      cursor: removalMode ? "default" : "pointer",
                      animation:
                        animatedClientId === client.id
                          ? "client-bubble-in 280ms ease-out"
                          : undefined,
                    }}
                    title={initialsOf(client.firstName, client.lastName)}
                  >
                    {initialsOf(client.firstName, client.lastName)}
                  </button>
                  {removalMode && canRemove && onRemoveClient ? (
                    <button
                      type="button"
                      className={styles.removeClientControl}
                      aria-label={`Remove ${clientName} from your Dashboard`}
                      disabled={busyClientId === client.id}
                      aria-busy={busyClientId === client.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveClient(client.id, clientName);
                      }}
                    >
                      <span aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
