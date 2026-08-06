"use client";

import { useEffect, useRef } from "react";
import {
  CLIENT_ORB_FONT_SIZE,
  CLIENT_ORB_SIZE,
  STATUS_BADGE_CLEARANCE,
  GRID_VISIBLE_COLUMNS,
  GRID_VISIBLE_ROWS,
  MODE_GRID_GAP,
  STATUS_BADGE_SIZE,
} from "./layoutConfig";
import ModeContentFrame from "./ModeContentFrame";

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  attached: boolean;
};

type Props = {
  clients: Client[];
  palette: string[];
  initialsOf: (firstName: string, lastName: string) => string;
  busyClientId: string | null;
  onClientClick: (client: Client) => void;
};

export default function AddClientView({
  clients,
  palette,
  initialsOf,
  busyClientId,
  onClientClick,
}: Props) {
  const trayRef = useRef<HTMLDivElement | null>(null);
  const firstAvailableClientRef = useRef<HTMLButtonElement | null>(null);
  const firstAvailableClientIndex = clients.findIndex(
    (client) => !client.attached
  );
  const visibleWidth =
    CLIENT_ORB_SIZE * GRID_VISIBLE_COLUMNS + MODE_GRID_GAP * (GRID_VISIBLE_COLUMNS - 1);
  const visibleHeight =
    CLIENT_ORB_SIZE * GRID_VISIBLE_ROWS + MODE_GRID_GAP * (GRID_VISIBLE_ROWS - 1);
  const addClientStaggerMs = 85;
  const addClientInitialDelayMs = 10;

  useEffect(() => {
    if (!clients.some((client) => !client.attached)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const tray = trayRef.current;
      const firstAvailableClient = firstAvailableClientRef.current;
      if (!tray || !firstAvailableClient) return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const trayBounds = tray.getBoundingClientRect();
      const clientBounds = firstAvailableClient.getBoundingClientRect();
      const centeredTop = Math.max(
        0,
        tray.scrollTop +
          clientBounds.top +
          clientBounds.height / 2 -
          (trayBounds.top + trayBounds.height / 2)
      );
      if (
        prefersReducedMotion ||
        !("scrollBehavior" in document.documentElement.style)
      ) {
        tray.scrollTop = centeredTop;
        return;
      }

      tray.scrollTo({ top: centeredTop, behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [clients]);

  return (
    <ModeContentFrame>
      <div
        ref={trayRef}
        className="client-cavity-tray"
        style={{
          width: "100%",
          maxWidth: visibleWidth + 196,
          margin: "0 auto",
          maxHeight: visibleHeight + STATUS_BADGE_CLEARANCE + 174,
          overflowY: "auto",
          overflowX: "hidden",
          padding: `${STATUS_BADGE_CLEARANCE + 40}px clamp(32px, 7vw, 80px) 92px`,
          boxSizing: "border-box",
          scrollbarGutter: "stable both-edges",
        }}
      >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: MODE_GRID_GAP,
              justifyContent: "center",
              justifyItems: "center",
              alignItems: "center",
              width: "100%",
              minHeight: visibleHeight,
              alignContent:
                clients.length <= GRID_VISIBLE_COLUMNS ? "center" : "flex-start",
            }}
          >
            {clients.map((client, index) => (
              <button
                key={client.id}
                ref={
                  index === firstAvailableClientIndex
                    ? firstAvailableClientRef
                    : undefined
                }
                type="button"
                className="glass-client-badge"
                disabled={busyClientId === client.id}
                onClick={() => onClientClick(client)}
                style={{
                  width: CLIENT_ORB_SIZE,
                  height: CLIENT_ORB_SIZE,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  border: "none",
                  background: palette[index % palette.length],
                  color: "var(--foreground)",
                  boxShadow: "var(--shadow-dashboard-sphere)",
                  fontSize: CLIENT_ORB_FONT_SIZE,
                  fontWeight: 500,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  animation: !client.attached ? "client-bubble-in 220ms ease-out both" : undefined,
                  animationDelay: !client.attached
                    ? `${index * addClientStaggerMs}ms`
                    : undefined,
                }}
              >
                {initialsOf(client.firstName, client.lastName)}
                {!client.attached && (
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      transform: "translate(28%, -28%)",
                      zIndex: 2,
                      width: STATUS_BADGE_SIZE,
                      height: STATUS_BADGE_SIZE,
                      borderRadius: "50%",
                      background: "var(--glass-strong)",
                      border: "none",
                      boxShadow: "var(--shadow-dashboard-badge)",
                      color: "var(--client-link-action)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      lineHeight: 1,
                      animation: "client-badge-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
                      animationDelay: `${index * addClientStaggerMs + addClientInitialDelayMs}ms`,
                    }}
                  >
                    +
                  </span>
                )}
              </button>
            ))}
          </div>
      </div>
    </ModeContentFrame>
  );
}
