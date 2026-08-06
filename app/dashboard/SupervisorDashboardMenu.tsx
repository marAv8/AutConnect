"use client";

/**
 * Supervisor-only actions anchored at the lower-left of the dashboard.
 * The parent controller owns menu state and mode changes; this component keeps
 * the grid/orbit menu presentation separate from client workflow logic.
 */

import Link from "next/link";
import type { CSSProperties, RefObject } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";

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
  onOpenGuide: () => void;
};

const menuStackStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "auto",
  height: 52,
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
  minHeight: 44,
  textAlign: "center",
  textDecoration: "none",
  padding: "0 16px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 650,
};

const menuButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: "1px solid rgb(35 45 55 / 14%)",
  background: "var(--note-neo-surface)",
  color: "var(--foreground)",
  fontSize: 24,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow:
    "0 1px 2px rgb(35 45 55 / 9%), 0 6px 14px rgb(35 45 55 / 11%), inset 0 1px 0 rgb(255 255 255 / 92%)",
};

const menuDotRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  height: 10,
};

const menuDotStyle: CSSProperties = {
  width: 4,
  height: 4,
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
  onOpenGuide,
}: Props) {
  return (
    <div ref={menuRef} style={menuStackStyle}>
      {menuOpen ? (
        <div className="dashboard-more-menu" style={menuPanelStyle}>
          {mode === "grid" ? (
            <>
              <Link
                href="/portal/supervisor/create-client"
                className="soft-link dashboard-menu-action action-positive"
                style={menuActionStyle}
              >
                Add Client
              </Link>
              <button
                type="button"
                className="dashboard-menu-action action-secondary"
                onClick={onOpenLinkClient}
                style={menuActionStyle}
              >
                Link Client
              </button>
              <button
                type="button"
                className="dashboard-menu-action dashboard-menu-action--destructive"
                onClick={onOpenRemoveClient}
                style={menuActionStyle}
              >
                Remove Client
              </button>
              <button
                type="button"
                className="dashboard-menu-action action-secondary"
                onClick={onOpenGuide}
                style={menuActionStyle}
              >
                How AutConnect Works
              </button>
            </>
          ) : (
            <>
              {activeClientId ? (
                <Link
                  href={`/portal/supervisor/edit-providers/${activeClientId}`}
                  onClick={onClose}
                  className="soft-link dashboard-menu-action action-secondary"
                  style={menuActionStyle}
                >
                  Care Team
                </Link>
              ) : null}
              <button
                type="button"
                className="dashboard-menu-action action-secondary"
                onClick={onOpenInsights}
                style={menuActionStyle}
              >
                Insights
              </button>
            </>
          )}
        </div>
      ) : null}
      <button
        type="button"
        className="material-control more-icon-control dashboard-round-icon-control"
        onClick={onToggle}
        aria-expanded={menuOpen}
        aria-label="More"
        style={menuButtonStyle}
      >
        <MenuDots />
      </button>
      <ThemeToggle />
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
