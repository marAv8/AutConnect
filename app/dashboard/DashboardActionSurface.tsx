"use client";

import type { ReactNode, RefObject } from "react";

type Props = {
  id: string;
  label: string;
  menuRef: RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
  children: ReactNode;
};

/**
 * Presentation-only action surface shared by Dashboard More menus. Capability
 * checks and action behavior remain owned by the calling dashboard.
 */
export default function DashboardActionSurface({
  id,
  label,
  menuRef,
  onDismiss,
  children,
}: Props) {
  return (
    <>
      <div
        aria-hidden="true"
        className="dashboard-action-backdrop dashboard-action-surface-backdrop"
        data-dashboard-trace-layer="more-backdrop"
        onPointerDown={onDismiss}
      />
      <div
        ref={menuRef}
        id={id}
        role="dialog"
        aria-label={label}
        className="dashboard-action-surface-material dashboard-action-surface"
      >
        <div className="dashboard-action-surface-scroll">{children}</div>
      </div>
    </>
  );
}
