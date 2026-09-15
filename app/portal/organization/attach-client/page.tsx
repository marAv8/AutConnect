import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentProvider } from "@/lib/authorization";
import { db } from "@/lib/db";
import AttachClientRequestForm from "./AttachClientRequestForm";
import AttachRequestAction from "./AttachRequestAction";
import styles from "./page.module.css";

export default async function AttachExistingClientPage() {
  const provider = await requireCurrentProvider().catch(() => null);
  if (!provider) redirect("/login");

  const memberships = await db.organizationMembership.findMany({
    where: {
      providerId: provider.id,
      active: true,
      role: { in: ["OWNER", "ADMIN"] },
    },
    orderBy: { organization: { name: "asc" } },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true, type: true } },
    },
  });
  const organizationIds = memberships.map(({ organizationId }) => organizationId);
  const requests = organizationIds.length
    ? await db.clientAttachRequest.findMany({
        where: { organizationId: { in: organizationIds } },
        orderBy: { requestedAt: "desc" },
        take: 50,
        select: {
          id: true,
          organizationId: true,
          requestedById: true,
          status: true,
          requestedAt: true,
          decidedAt: true,
          organization: { select: { name: true, type: true } },
        },
      })
    : [];

  const pendingRequests = requests.filter(({ status }) => status === "PENDING");
  const decidedRequests = requests.filter(({ status }) => status !== "PENDING");

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/dashboard" className="back-link">
          Back to Dashboard
        </Link>

        <header className={styles.heading}>
          <p className={styles.eyebrow}>Organization administration</p>
          <h1>Attach Existing Client</h1>
          <p>
            Ask a Client&apos;s Team Manager to approve your organization&apos;s
            participation.
          </p>
        </header>

        <section className={styles.workflowSection}>
          <div className={styles.sectionHeading}>
            <h2>Request participation</h2>
            <p>
              Submit only a case code and an organization you directly administer.
              No Client details are shown before approval.
            </p>
          </div>
          {memberships.length ? (
            <AttachClientRequestForm
              organizations={memberships.map(({ organization }) => organization)}
            />
          ) : (
            <div className={styles.emptyState} role="status">
              <h3>No eligible organization</h3>
              <p>
                An active organization OWNER or ADMIN membership is required to
                request participation.
              </p>
            </div>
          )}
        </section>

        <section className={`paper-surface ${styles.section}`}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionHeading}>
              <h2>Pending requests</h2>
              <p>Requests awaiting review by the exact Client&apos;s Team Manager.</p>
            </div>
            <span className={styles.countBadge}>{pendingRequests.length}</span>
          </div>
          {pendingRequests.length ? (
            <div className={styles.list}>
              {pendingRequests.map((request) => (
                <article key={request.id} className={styles.requestCard}>
                  <div>
                    <div className={styles.cardTitleRow}>
                      <h3>{request.organization.name}</h3>
                      <span className={styles.statusBadge}>Pending</span>
                    </div>
                    <p className={styles.metadata}>
                      Requested {request.requestedAt.toLocaleDateString()} · Client
                      details remain private
                    </p>
                  </div>
                  {request.requestedById === provider.id ? (
                    <AttachRequestAction requestId={request.id} />
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>No pending requests</h3>
              <p>Your administered organizations have no attach requests awaiting review.</p>
            </div>
          )}
        </section>

        <section className={`paper-surface ${styles.section}`}>
          <div className={styles.sectionHeading}>
            <h2>Request history</h2>
            <p>Recent outcomes without Client identity or clinical information.</p>
          </div>
          {decidedRequests.length ? (
            <div className={styles.historyList}>
              {decidedRequests.map((request) => (
                <article key={request.id} className={styles.historyRow}>
                  <div>
                    <strong>{request.organization.name}</strong>
                    <p className={styles.metadata}>
                      Requested {request.requestedAt.toLocaleDateString()}
                      {request.decidedAt
                        ? ` · Decided ${request.decidedAt.toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <span className={styles.statusBadge}>
                    {requestStatusLabel(request.status)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyHistory}>No previously decided requests.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function requestStatusLabel(status: string) {
  return (
    {
      APPROVED: "Approved",
      REJECTED: "Rejected",
      CANCELLED: "Cancelled",
    }[status] ?? status
  );
}
