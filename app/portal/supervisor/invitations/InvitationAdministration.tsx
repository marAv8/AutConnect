"use client";

import { useEffect, useRef, useState } from "react";
import AdministrativeCarousel from "@/app/components/administrative/AdministrativeCarousel";
import type { OrganizationInvitationState } from "@/app/actions/manageOrganizationInvitations";
import InvitationCard, { InvitationResult, type InvitationRecord } from "../../organization/invitations/InvitationCards";
import OrganizationInvitationForm from "./OrganizationInvitationForm";
import styles from "../../organization/invitations/invitations.module.css";

type Member = { id: string; organization: string; name: string; email: string; role: string; membershipRole: string; activeAccount: boolean };
export default function InvitationAdministration({ organizations, invitations, members }: {
  organizations: Array<{ id: string; name: string }>;
  invitations: InvitationRecord[];
  members: Member[];
}) {
  const [fresh, setFresh] = useState<OrganizationInvitationState | null>(null);
  const freshRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (fresh) freshRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, [fresh]);
  const pending = invitations.filter(invitation => invitation.status === "Pending");
  const history = invitations.filter(invitation => invitation.status !== "Pending");
  const records = (items: InvitationRecord[]) => items.map(invitation => ({ id: invitation.id, label: `${invitation.status} Invitation`, content: <InvitationCard invitation={invitation} administrator onIssued={setFresh} /> }));
  return <>
    {fresh && <div ref={freshRef}><AdministrativeCarousel ariaLabel="Freshly issued invitation" navigationMode="records" scrollMode="page" cards={[{ id: "fresh-invitation", label: "Ready to Copy", content: <div className={`auth-form ${styles.content}`}>
      <p><strong>Recipient:</strong> {fresh.recipient?.email}</p>
      <p><strong>Organization:</strong> {organizations.find(organization => organization.id === fresh.recipient?.organizationId)?.name}</p>
      <p><strong>Role:</strong> {fresh.recipient?.providerRole.replace(/([a-z])([A-Z])/g, "$1 $2")}</p>
      <InvitationResult state={fresh} />
    </div> }]} /></div>}
    <h2>Pending Invitations ({pending.length})</h2>
    <AdministrativeCarousel ariaLabel="Pending staff invitations" navigationMode="records" scrollMode="page" cards={pending.length ? records(pending) : [{ id: "empty-pending", label: "No Pending Invitations", content: <p>Create an invitation below to invite someone to this organization.</p> }]} />
    {organizations.length > 0 && <details className={styles.history}><summary>Create Invitation</summary>
      <AdministrativeCarousel ariaLabel="Create staff invitation" navigationMode="records" scrollMode="page" cards={[{ id: "create-invitation", label: "Create Invitation", content: <OrganizationInvitationForm organizations={organizations} onIssued={setFresh} /> }]} />
    </details>}
    <details className={styles.history}><summary>Active Members ({members.length})</summary>
      <AdministrativeCarousel ariaLabel="Active organization members" navigationMode="records" scrollMode="page" cards={members.length ? members.map(member => ({ id: member.id, label: "Active Organization Member", content: <div className={`auth-form ${styles.content}`}>
        <p><strong>Organization:</strong> {member.organization}</p><p><strong>Person:</strong> {member.name}</p><p>{member.email}</p>
        <p><strong>Provider role:</strong> {member.role.replace(/([a-z])([A-Z])/g, "$1 $2")}</p>
        <p><strong>Membership:</strong> Active · {member.membershipRole.toLowerCase()}</p><p><strong>Account:</strong> {member.activeAccount ? "Active" : "Inactive"}</p>
        <p>Client assignments are managed on each Client’s Care Team.</p>
      </div> })) : [{ id: "empty-members", label: "No Active Members", content: <p>No active organization memberships.</p> }]} />
    </details>
    <details className={styles.history}><summary>Invitation History ({history.length})</summary>
      <AdministrativeCarousel ariaLabel="Staff invitation history" navigationMode="records" scrollMode="page" cards={history.length ? records(history) : [{ id: "empty-history", label: "No Invitation History", content: <p>Accepted, replaced, revoked and expired invitations appear here.</p> }]} />
    </details>
  </>;
}
