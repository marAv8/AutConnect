"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useEffect } from "react";
import DashboardActionSurface from "./DashboardActionSurface";
import { useDismissibleMenu } from "./useDismissibleMenu";
import {
  traceDashboardInteractionHandled,
  traceDashboardInteractionState,
} from "./dashboardInteractionTraceClient";

type Props = {
  canAttachExistingClient: boolean;
  onOpenGuide: () => void;
};

export default function ProviderDashboardMoreMenu({
  canAttachExistingClient,
  onOpenGuide,
}: Props) {
  const {
    open,
    closeMenu,
    toggleMenu,
    runMenuAction,
    triggerRef,
    menuRef,
  } = useDismissibleMenu();

  useEffect(() => {
    traceDashboardInteractionState(open ? "menu-open" : "menu-closed");
  }, [open]);

  return (
    <div className="dashboard-provider-more-stack">
      {open ? (
        <DashboardActionSurface
          id="provider-dashboard-more-menu"
          label="Dashboard actions"
          menuRef={menuRef}
          onDismiss={closeMenu}
        >
          {canAttachExistingClient ? (
            <Link href="/portal/supervisor/invitations" className="soft-link dashboard-action-row" onClick={closeMenu}>Team Invitations and Members</Link>
          ) : null}
          {canAttachExistingClient ? (
            <Link
              href="/portal/organization/attach-client"
              className="soft-link dashboard-action-row"
              onClick={closeMenu}
            >
              Attach Existing Client
            </Link>
          ) : null}
          <button
            type="button"
            className="dashboard-action-row"
            onClick={() => runMenuAction(onOpenGuide)}
          >
            How AutConnect Works
          </button>
        </DashboardActionSurface>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        className="material-control more-icon-control dashboard-round-icon-control dashboard-round-icon-control--arrival"
        data-dashboard-trace-control="more"
        onClick={() => {
          traceDashboardInteractionHandled("more");
          toggleMenu();
        }}
        aria-expanded={open}
        aria-controls="provider-dashboard-more-menu"
        aria-label="More"
      >
        <span className="dashboard-utility-arrival-visual">
          <MoreHorizontal aria-hidden="true" size={24} strokeWidth={2} />
        </span>
      </button>
    </div>
  );
}
