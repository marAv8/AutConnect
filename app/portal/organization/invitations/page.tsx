import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentProvider, getManagedOrganizationIds } from "@/lib/authorization";
import { normalizeInvitationEmail } from "@/lib/organizationInvitations";
import { invitationFailureMessage, invitationHistoryStatus, type InvitationFailure } from "@/lib/organizationInvitationState";
import AdministrativeCarousel from "@/app/components/administrative/AdministrativeCarousel";
import InvitationCard from "./InvitationCards";
import styles from "../client-invitations/page.module.css";

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ issue?: string; joined?: string }> }) {
  const actor = await requireCurrentProvider();
  const account = await db.provider.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true } });
  const [invitations, managedIds, params] = await Promise.all([
    db.organizationInvitation.findMany({ where: { normalizedEmail: normalizeInvitationEmail(account.email) }, orderBy: { createdAt: "desc" }, select: { id: true, organizationId: true, normalizedEmail: true, createdAt: true, email: true, providerRole: true, membershipRole: true, acceptedAt: true, revokedAt: true, expiresAt: true, organization: { select: { name: true } } } }),
    getManagedOrganizationIds(actor.id), searchParams,
  ]);
  const failureCodes: InvitationFailure[] = ["unavailable", "expired", "revoked", "wrong-account", "role-mismatch", "inactive-account", "access-removed", "retry"];
  const issue = failureCodes.includes(params.issue as InvitationFailure) ? invitationFailureMessage(params.issue as InvitationFailure) : null;
  return <main className={styles.page}><div className={styles.container}>
    <Link href="/dashboard" className="back-link">Back to Dashboard</Link>
    <header className={styles.heading}><h1>My Organization Invitations</h1><p>Review your invitations here, even before a Client is assigned.</p></header>
    {issue && <p role="alert" className={styles.error}>{issue}</p>}
    {params.joined === "1" && <p role="status" className={styles.success}>Invitation accepted. Client assignments are managed separately.</p>}
    <AdministrativeCarousel ariaLabel="My organization invitations" navigationMode="records" scrollMode="page" cards={invitations.length ? invitations.map(invitation => ({ id: invitation.id, label: invitation.organization.name, content: <InvitationCard invitation={{ id: invitation.id, organization: invitation.organization.name, email: invitation.email, role: invitation.providerRole, membershipRole: invitation.membershipRole, status: invitationHistoryStatus(invitation, invitations), expiration: invitation.expiresAt.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" }) }} /> })) : [{ id: "empty-invitations", label: "No organization invitations", content: <p>There are no invitations for your signed-in email. If you expected one, ask your administrator to check the invited email address.</p> }]} />
    {managedIds.length > 0 && <Link className="soft-link" href="/portal/supervisor/invitations">Manage Team Invitations and Members</Link>}
  </div></main>;
}
