"use client";

/**
 * Supervisor-only actions anchored at the lower-left of the dashboard.
 * The parent controller owns menu state and mode changes; this component keeps
 * the grid/orbit menu presentation separate from client workflow logic.
 */

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import DashboardActionSurface from "./DashboardActionSurface";
import TeamFocusSignalControl from "./TeamFocusSignalControl";
import DashboardInboxControl from "./DashboardInboxControl";
import type { DashboardTeamFocus } from "./dashboardClientTypes";
import type { AdministrativePresentationCapabilities } from "./administrativeCapabilities";
import { runCareTeamLinkNavigation } from "./dashboardNavigation";
import {
  traceDashboardInteractionHandled,
  traceDashboardInteractionState,
} from "./dashboardInteractionTraceClient";

import type { DashboardAttentionCounts } from "./dashboardAttentionTypes";

type Props = {
  mode: "grid" | "orbit" | "add" | "remove";
  menuOpen: boolean;
  administrativeCapabilities: AdministrativePresentationCapabilities;
  newCaseSupportRequestCount: number;
  pendingOrganizationInvitationCount: number;
  attentionCounts?: DashboardAttentionCounts;
  activeClientId?: string;
  menuRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onClose: () => void;
  onOpenCareTeam: (clientId: string) => void;
  onOpenRemoveClient: () => void;
  onOpenInsights: () => void;
  onOpenGuide: () => void;
  currentProviderId: string;
  activeTeamFocus?: DashboardTeamFocus;
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
  administrativeCapabilities,
  newCaseSupportRequestCount,
  pendingOrganizationInvitationCount,
  attentionCounts,
  activeClientId,
  menuRef,
  triggerRef,
  onToggle,
  onClose,
  onOpenCareTeam,
  onOpenRemoveClient,
  onOpenInsights,
  onOpenGuide,
  currentProviderId,
  activeTeamFocus,
}: Props) {
  const [clientAdministrationOpen, setClientAdministrationOpen] =
    useState(false);
  const hasClientAdministration =
    administrativeCapabilities.canAddClient ||
    administrativeCapabilities.canAttachExistingClient ||
    administrativeCapabilities.removableClientIds.length > 0;

  const closeMenu = () => {
    setClientAdministrationOpen(false);
    onClose();
  };
  const toggleMenu = () => {
    traceDashboardInteractionHandled("more");
    setClientAdministrationOpen(false);
    onToggle();
  };

  useEffect(() => {
    traceDashboardInteractionState(menuOpen ? "menu-open" : "menu-closed");
  }, [menuOpen]);

  return (
    <div className="dashboard-utility-controls">
      {menuOpen ? (
        <DashboardActionSurface
          id="supervisor-dashboard-more-menu"
          label="Dashboard actions"
          menuRef={menuRef}
          onDismiss={closeMenu}
        >
          {mode !== "orbit" ? (
            <>
              {hasClientAdministration ? (
                <button
                  type="button"
                  className="dashboard-action-row dashboard-menu-disclosure-trigger"
                  aria-expanded={clientAdministrationOpen}
                  aria-controls="supervisor-client-administration-menu"
                  onClick={() =>
                    setClientAdministrationOpen((isOpen) => !isOpen)
                  }
                >
                  Client Administration
                </button>
              ) : null}
              {clientAdministrationOpen ? (
                <div
                  id="supervisor-client-administration-menu"
                  className="dashboard-menu-disclosure"
                >
                  {administrativeCapabilities.canAddClient ? (
                    <Link
                      href="/portal/supervisor/create-client"
                      onClick={closeMenu}
                      className="soft-link dashboard-action-row dashboard-action-row--child"
                    >
                      Add Client
                    </Link>
                  ) : null}
                  {administrativeCapabilities.canAttachExistingClient ? (
                    <Link
                      href="/portal/organization/attach-client"
                      onClick={closeMenu}
                      className="soft-link dashboard-action-row dashboard-action-row--child"
                    >
                      Attach Existing Client
                    </Link>
                  ) : null}
                  {mode !== "remove" &&
                  administrativeCapabilities.removableClientIds.length > 0 ? (
                    <button
                      type="button"
                      className="dashboard-action-row dashboard-action-row--child dashboard-action-row--destructive"
                      onClick={() => {
                        setClientAdministrationOpen(false);
                        onOpenRemoveClient();
                      }}
                    >
                      Remove Client
                    </button>
                  ) : null}
                </div>
              ) : null}
              {administrativeCapabilities.canInviteTeam ? (
                <Link
                  href="/portal/supervisor/invitations"
                  onClick={closeMenu}
                  className="soft-link dashboard-action-row"
                >
                  Invite Team
                </Link>
              ) : null}
              {administrativeCapabilities.canAccessPlatformAdministration ? (
                <Link
                  href="/platform"
                  onClick={closeMenu}
                  className="soft-link dashboard-action-row"
                >
                  Administration
                </Link>
              ) : null}
              <button
                type="button"
                className="dashboard-action-row"
                onClick={onOpenGuide}
              >
                How AutConnect Works
              </button>
            </>
          ) : (
            <>
              {administrativeCapabilities.canAccessPlatformAdministration ? (
                <Link
                  href="/platform"
                  onClick={closeMenu}
                  className="soft-link dashboard-action-row"
                >
                  Administration
                </Link>
              ) : null}
              {activeClientId &&
              administrativeCapabilities.careTeamClientIds.includes(
                activeClientId
              ) ? (
                <Link
                  href={`/portal/supervisor/edit-providers/${activeClientId}`}
                  onClick={(event) => {
                    runCareTeamLinkNavigation({
                      event,
                      clientId: activeClientId,
                      closeMenu,
                      navigate: () => onOpenCareTeam(activeClientId),
                    });
                  }}
                  className="soft-link dashboard-action-row"
                >
                  Care Team
                </Link>
              ) : null}
              <button
                type="button"
                className="dashboard-action-row"
                onClick={onOpenInsights}
              >
                Insights
              </button>
            </>
          )}
        </DashboardActionSurface>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        className="material-control more-icon-control dashboard-round-icon-control dashboard-round-icon-control--arrival"
        data-dashboard-trace-control="more"
        onClick={toggleMenu}
        aria-expanded={menuOpen}
        aria-controls="supervisor-dashboard-more-menu"
        aria-label="More"
      >
        <span className="dashboard-utility-arrival-visual">
          <MenuDots />
        </span>
      </button>
      <DashboardInboxControl
        attentionCounts={attentionCounts}
        canAccessCaseSupport
        canReviewOrganizationInvitations={
          administrativeCapabilities.canReviewOrganizationInvitations
        }
        caseSupportCount={newCaseSupportRequestCount}
        organizationInvitationCount={pendingOrganizationInvitationCount}
        onNavigate={closeMenu}
      />
      <ThemeToggle />
      {mode === "orbit" ? (
        <TeamFocusSignalControl
          clientId={activeClientId}
          teamFocus={activeTeamFocus}
          viewerProviderId={currentProviderId}
          canEdit
        />
      ) : null}
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
