import Link from "next/link";
import { redirect } from "next/navigation";
import {
  approveClientOrganization,
  rejectClientOrganization,
} from "@/app/actions/manageClientTeam";
import { requireCurrentProvider } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { InvitationDecisionButton } from "./InvitationDecisionButtons";
import InvitationInfo from "./InvitationInfo";
import styles from "./page.module.css";
import { AdministrativeCarouselSections } from "@/app/components/administrative/AdministrativeCarousel";

const INBOX_PATH = "/portal/organization/client-invitations";

async function approveInvitationWithFeedback(formData: FormData) {
  "use server";
  let result = "approved";
  try {
    await approveClientOrganization(formData);
  } catch {
    result = "error";
  }
  redirect(`${INBOX_PATH}?result=${result}`, "replace");
}

async function rejectInvitationWithFeedback(formData: FormData) {
  "use server";
  let result = "rejected";
  try {
    await rejectClientOrganization(formData);
  } catch {
    result = "error";
  }
  redirect(`${INBOX_PATH}?result=${result}`, "replace");
}

const invitationSelect = {
  id: true,
  status: true,
  requestedAt: true,
  revokedAt: true,
  revocationReason: true,
  organization: { select: { name: true } },
  requestedBy: { select: { firstName: true, lastName: true } },
  client: {
    select: {
      caseCode: true,
      clientOrganizations: {
        where: { role: "LEAD" as const, status: "ACTIVE" as const, revokedAt: null },
        take: 1,
        select: { organization: { select: { name: true } } },
      },
    },
  },
};

export default async function ClientOrganizationInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const [session, filters] = await Promise.all([getSession(), searchParams]);
  if (!session) redirect("/login");
  const provider = await requireCurrentProvider();
  const administeredOrganizations = await db.organizationMembership.findMany({
    where: {
      providerId: provider.id,
      active: true,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { organizationId: true },
  });
  const organizationIds = administeredOrganizations.map(
    ({ organizationId }) => organizationId
  );
  const [pendingInvitations, decidedInvitations] = organizationIds.length
    ? await Promise.all([
        db.clientOrganization.findMany({
          where: {
            organizationId: { in: organizationIds },
            role: "PARTICIPATING",
            status: "PENDING",
            revokedAt: null,
          },
          orderBy: { requestedAt: "asc" },
          take: 50,
          select: invitationSelect,
        }),
        db.clientOrganization.findMany({
          where: {
            organizationId: { in: organizationIds },
            role: "PARTICIPATING",
            OR: [{ status: "ACTIVE" }, { revokedAt: { not: null } }],
          },
          orderBy: [{ revokedAt: "desc" }, { requestedAt: "desc" }],
          take: 50,
          select: invitationSelect,
        }),
      ])
    : [[], []];

  const feedback =
    filters.result === "approved"
      ? "Invitation approved."
      : filters.result === "rejected"
        ? "Invitation rejected."
        : filters.result === "error"
          ? "The invitation could not be updated. Refresh and try again."
          : "";

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/dashboard" className="back-link">
          Back to Dashboard
        </Link>

        <header className={styles.heading}>
          <p className={styles.eyebrow}>Organization administration</p>
          <div className={styles.headingTitleRow}>
            <h1>Organization Invitations</h1>
            <InvitationInfo label="About organization invitations">
            Review requests for an organization you directly administer to join a
              Client&apos;s care team. How access works: approving allows eligible
              providers to be assigned; it does not automatically grant Client access
              to every organization member. District hierarchy alone never grants
              approval or Client access.
            </InvitationInfo>
          </div>
        </header>

        {feedback ? (
          <div
            className={filters.result === "error" ? styles.error : styles.success}
            role={filters.result === "error" ? "alert" : "status"}
          >
            {feedback}
          </div>
        ) : null}

        <AdministrativeCarouselSections
          ariaLabel="Organization invitation inbox"
          initialCardId={filters.result ? "pending" : undefined}
          sections={[
            { id: "pending", label: "Pending" },
            { id: "decided", label: "Previously Decided" },
          ]}
        >
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div className={styles.sectionHeadingCopy}>
              <div className={styles.sectionTitleRow}>
                <h2>Pending</h2>
                <span className={styles.countBadge}>{pendingInvitations.length}</span>
              </div>
              <p>Approve or reject invitations addressed to your organization.</p>
            </div>
          </div>

          {pendingInvitations.length ? (
            <div className={styles.list}>
              {pendingInvitations.map((invitation) => (
                <article key={invitation.id} className={styles.invitationCard}>
                  <div className={styles.invitationBody}>
                    <div className={styles.cardTitleRow}>
                      <h3>{invitation.organization.name}</h3>
                      <span className={`${styles.statusBadge} ${styles.pending}`}>
                        Pending
                      </span>
                    </div>
                    <dl className={styles.metadata}>
                      <div><dt>Client</dt><dd>Case {invitation.client.caseCode}</dd></div>
                      <div>
                        <dt>Lead organization</dt>
                        <dd>{invitation.client.clientOrganizations[0]?.organization.name ?? "Unavailable"}</dd>
                      </div>
                      <div><dt>Requested</dt><dd>{invitation.requestedAt.toLocaleDateString()}</dd></div>
                      <div>
                        <dt>Requested by</dt>
                        <dd>{invitation.requestedBy.firstName} {invitation.requestedBy.lastName}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className={styles.actions}>
                    <form action={approveInvitationWithFeedback}>
                      <input type="hidden" name="relationshipId" value={invitation.id} />
                      <InvitationDecisionButton className="material-control action-positive" confirmation="Approve this organization for Client participation?" pendingLabel="Approving…">
                        Approve
                      </InvitationDecisionButton>
                    </form>
                    <form action={rejectInvitationWithFeedback}>
                      <input type="hidden" name="relationshipId" value={invitation.id} />
                      <InvitationDecisionButton className="material-control action-secondary" confirmation="Reject this Client organization invitation?" pendingLabel="Rejecting…">
                        Reject
                      </InvitationDecisionButton>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>You&apos;re all caught up</h3>
              <p>No pending Client invitations for organizations you administer.</p>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Previously decided</h2>
              <p>Recent approvals, rejections, cancellations, and revocations.</p>
            </div>
          </div>
          {decidedInvitations.length ? (
            <div className={styles.historyList}>
              {decidedInvitations.map((invitation) => (
                <article key={invitation.id} className={styles.historyRow}>
                  <div>
                    <strong>{invitation.organization.name}</strong>
                    <div className="form-helper-text">Case {invitation.client.caseCode} · Requested {invitation.requestedAt.toLocaleDateString()}</div>
                  </div>
                  <span className={styles.statusBadge}>{decidedLabel(invitation)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyHistory}>No previously decided invitations.</p>
          )}
        </section>

        </AdministrativeCarouselSections>

      </div>
    </main>
  );
}

function decidedLabel(invitation: { status: string; revokedAt: Date | null; revocationReason: string | null }) {
  if (invitation.status === "ACTIVE" && !invitation.revokedAt) return "Approved";
  if (invitation.revocationReason === "REJECTED_BY_ORGANIZATION") return "Rejected";
  if (invitation.revocationReason === "CANCELLED_BY_TEAM_MANAGER") return "Cancelled";
  return "Revoked";
}
