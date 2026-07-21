"use client";

/**
 * Supervisor-only actions anchored at the lower-left of the dashboard.
 * The parent controller owns menu state and mode changes; this component keeps
 * the grid/orbit menu presentation separate from client workflow logic.
 */

import Link from "next/link";
import type { CSSProperties, RefObject } from "react";

type Props = {
  mode: "grid" | "orbit";
  menuOpen: boolean;
  activeClientId?: string;
  menuRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onClose: () => void;
  onOpenLinkClient: () => void;
  onOpenRemoveClient: () => void;
  onOpenInsights: () => void;
};

const menuStackStyle: CSSProperties = {
  position: "relative",
  width: 58,
  height: 58,
};

const menuPanelStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  bottom: "calc(100% + 16px)",
  display: "grid",
  gap: 12,
  minWidth: 154,
  padding: 0,
  justifyItems: "center",
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const menuActionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 42,
  border: "none",
  borderRadius: 14,
  background: "var(--note-neo-surface)",
  textAlign: "center",
  textDecoration: "none",
  padding: "0 16px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 650,
  color: "rgb(0 0 0 / 82%)",
  boxShadow: "var(--note-neo-control)",
};

const menuButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 58,
  height: 58,
  borderRadius: "50%",
  border: "none",
  background: "var(--note-neo-surface)",
  color: "var(--foreground)",
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "var(--note-neo-control)",
};

const menuDotRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 10,
};

const menuDotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "currentColor",
  display: "block",
};

export default function SupervisorDashboardMenu({
  mode,
  menuOpen,
  activeClientId,
  menuRef,
  onToggle,
  onClose,
  onOpenLinkClient,
  onOpenRemoveClient,
  onOpenInsights,
}: Props) {
  return (
    <div ref={menuRef} style={menuStackStyle}>
      {menuOpen ? (
        <div style={menuPanelStyle}>
          {mode === "grid" ? (
            <>
              <Link
                href="/portal/supervisor/create-client"
                className="soft-link"
                style={menuActionStyle}
              >
                Add Client
              </Link>
              <button type="button" onClick={onOpenLinkClient} style={menuActionStyle}>
                Link Client
              </button>
              <button type="button" onClick={onOpenRemoveClient} style={menuActionStyle}>
                Remove Client
              </button>
            </>
          ) : (
            <>
              {activeClientId ? (
                <Link
                  href={`/portal/supervisor/edit-providers/${activeClientId}`}
                  onClick={onClose}
                  className="soft-link"
                  style={menuActionStyle}
                >
                  Care Team
                </Link>
              ) : null}
              <button type="button" onClick={onOpenInsights} style={menuActionStyle}>
                Insights
              </button>
            </>
          )}
        </div>
      ) : null}
      <button
        type="button"
        className="material-control"
        onClick={onToggle}
        aria-expanded={menuOpen}
        aria-label="More"
        style={menuButtonStyle}
      >
        <MenuDots />
      </button>
    </div>
  );
}

function MenuDots() {
  return (
    <span aria-hidden="true" style={menuDotRowStyle}>
      <span style={menuDotStyle} />
      <span style={menuDotStyle} />
      <span style={menuDotStyle} />
    </span>
  );
}
