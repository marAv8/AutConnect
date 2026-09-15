import InvitationAdministration from "./InvitationAdministration";
import { getManagedOrganizationIds, requireCurrentProvider } from "@/lib/authorization";
import { db } from "@/lib/db";
import Link from "next/link";
import { invitationStatus, invitationHistoryStatus } from "@/lib/organizationInvitationState";
import styles from "../../organization/client-invitations/page.module.css";

export default async function OrganizationInvitationsPage() {
  const actor = await requireCurrentProvider();
  const managedOrganizationIds = await getManagedOrganizationIds(actor.id);
  const [organizations, invitations, memberships] = await Promise.all([
    db.organization.findMany({ where: { id: { in: managedOrganizationIds } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.organizationInvitation.findMany({ where: { organizationId: { in: managedOrganizationIds } }, orderBy: { createdAt: "desc" }, select: { id: true, organizationId: true, normalizedEmail: true, createdAt: true, email: true, providerRole: true, membershipRole: true, acceptedAt: true, revokedAt: true, expiresAt: true, organization: { select: { name: true } } } }),
    db.organizationMembership.findMany({ where: { organizationId: { in: managedOrganizationIds }, active: true }, orderBy: { createdAt: "desc" }, select: { id: true, role: true, organization: { select: { name: true } }, provider: { select: { firstName: true, lastName: true, email: true, role: true, status: true } } } }),
  ]);
  return <main className={styles.page}><div className={styles.container}>
    <Link href="/dashboard" className="back-link">Back to Dashboard</Link>
    <header className={styles.heading}><h1>Team Invitations and Members</h1><p>{invitations.filter(invitation => invitationStatus(invitation) === "Pending").length} pending invitations · {memberships.length} active memberships</p></header>
    {organizations.length ? <InvitationAdministration organizations={organizations}
      invitations={invitations.map(invitation => ({ id: invitation.id, organization: invitation.organization.name, email: invitation.email, role: invitation.providerRole, membershipRole: invitation.membershipRole, status: invitationHistoryStatus(invitation, invitations), expiration: invitation.expiresAt.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" }) }))}
      members={memberships.map(membership => ({ id: membership.id, organization: membership.organization.name, name: `${membership.provider.firstName} ${membership.provider.lastName}`, email: membership.provider.email, role: membership.provider.role, membershipRole: membership.role, activeAccount: membership.provider.status === "ACTIVE" }))}
    /> : <p>Only active organization owners and administrators can manage staff invitations.</p>}
    <nav className="auth-link-row" aria-label="Related invitations"><Link href="/portal/organization/invitations">My Organization Invitations</Link><Link href="/portal/organization/client-invitations">Client Organization Invitations</Link></nav>
  </div></main>;
}
