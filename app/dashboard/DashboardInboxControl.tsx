"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useDismissibleMenu } from "./useDismissibleMenu";
import { emptyDashboardAttentionCounts, type DashboardAttentionCounts } from "./dashboardAttentionTypes";
import { traceDashboardInteractionHandled, traceDashboardInteractionState } from "./dashboardInteractionTraceClient";

type Props = {
  canAccessCaseSupport: boolean;
  canReviewOrganizationInvitations: boolean;
  caseSupportCount: number;
  organizationInvitationCount: number;
  attentionCounts?: DashboardAttentionCounts;
  onNavigate?: () => void;
};

export default function DashboardInboxControl({
  canAccessCaseSupport,
  canReviewOrganizationInvitations,
  caseSupportCount,
  organizationInvitationCount,
  attentionCounts = emptyDashboardAttentionCounts,
  onNavigate,
}: Props) {
  const {
    open,
    closeMenu,
    toggleMenu,
    triggerRef,
    menuRef,
  } = useDismissibleMenu();

  useEffect(() => {
    if (canReviewOrganizationInvitations) {
      traceDashboardInteractionState(open ? "inbox-open" : "inbox-closed");
    }
  }, [canReviewOrganizationInvitations, open]);

  const totalPendingCount = [
    canAccessCaseSupport ? caseSupportCount : 0,
    canReviewOrganizationInvitations ? organizationInvitationCount : 0,
    attentionCounts.organizationAccessRequests ?? 0,
    attentionCounts.myOrganizationInvitations,
    attentionCounts.clientParticipationRequests ?? 0,
  ].reduce((sum, count) => sum + count, 0);
  const icon = (
    <>
      <CaseSupportInboxIcon quiet={totalPendingCount === 0} />
      {totalPendingCount > 0 ? (
        <span className="dashboard-case-support-badge" aria-hidden="true">
          {totalPendingCount}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="dashboard-inbox-menu-stack">
      {open ? (
        <nav
          ref={menuRef}
          id="dashboard-inbox-menu"
          className="dashboard-inbox-menu"
          aria-label="Inbox destinations"
        >
          {canAccessCaseSupport ? (
            <Link
              href="/portal/case-support/requests"
              className="soft-link dashboard-inbox-menu-action"
              onClick={() => {
                closeMenu();
                onNavigate?.();
              }}
            >
              <span>Case Support Requests</span>
              {caseSupportCount > 0 ? <span>{caseSupportCount}</span> : null}
            </Link>
          ) : null}
          <Link href="/portal/organization/invitations" className="soft-link dashboard-inbox-menu-action" onClick={() => { closeMenu(); onNavigate?.(); }}>
            <span>My Organization Invitations</span>
            <span>{attentionCounts.myOrganizationInvitations}</span>
          </Link>
          {attentionCounts.organizationAccessRequests !== null ? (
            <Link href="/platform/agency-requests" className="soft-link dashboard-inbox-menu-action" onClick={() => { closeMenu(); onNavigate?.(); }}>
              <span>Organization Access Requests</span>
              <span>{attentionCounts.organizationAccessRequests}</span>
            </Link>
          ) : null}
          {attentionCounts.clientParticipationRequests !== null ? (
            <Link href="/portal/supervisor/edit-providers" className="soft-link dashboard-inbox-menu-action" onClick={() => { closeMenu(); onNavigate?.(); }}>
              <span>Client Participation Requests</span>
              <span>{attentionCounts.clientParticipationRequests}</span>
            </Link>
          ) : null}
          {canReviewOrganizationInvitations ? (
            <Link
              href="/portal/organization/client-invitations"
              className="soft-link dashboard-inbox-menu-action"
              onClick={() => {
                closeMenu();
                onNavigate?.();
              }}
            >
              <span>Client Organization Invitations</span>
              {organizationInvitationCount > 0 ? (
                <span>{organizationInvitationCount}</span>
              ) : null}
            </Link>
          ) : null}
        </nav>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        className="material-control dashboard-round-icon-control dashboard-round-icon-control--arrival dashboard-case-support-control"
        data-dashboard-trace-control="inbox"
        onClick={() => {
          traceDashboardInteractionHandled("inbox");
          toggleMenu();
        }}
        aria-expanded={open}
        aria-controls="dashboard-inbox-menu"
        aria-label={
          `Inbox, ${totalPendingCount} pending ${totalPendingCount === 1 ? "action" : "actions"}`
        }
        title="Inbox"
      >
        <span className="dashboard-utility-arrival-visual">{icon}</span>
      </button>
    </div>
  );
}

function CaseSupportInboxIcon({ quiet }: { quiet: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`dashboard-case-support-icon${
        quiet ? " dashboard-case-support-icon--quiet" : ""
      }`}
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4.5 5.5h15v13h-15z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 14.5h4.1l1.7 2h3.4l1.7-2h4.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
