import { requireCurrentPlatformAdmin } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import AgencyRequestsCarousel from "./AgencyRequestsCarousel";
import RequestHistoryCarousel from "./RequestHistoryCarousel";
import styles from "./page.module.css";

export default async function AgencyRequestsPage() {
  if (!(await getSession())) {
    redirect("/login");
  }
  await requireCurrentPlatformAdmin();
  const [requests, reviewedRequests] = await Promise.all([
    db.agencyAccessRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    db.agencyAccessRequest.findMany({
      where: { status: { in: ["APPROVED", "DECLINED"] } },
      orderBy: [{ reviewedAt: "desc" }, { updatedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        organizationName: true,
        organizationType: true,
        contactFirstName: true,
        contactLastName: true,
        contactEmail: true,
        createdAt: true,
        status: true,
        reviewedAt: true,
        approvedOrganizationId: true,
        approvedOrganization: {
          select: { name: true },
        },
      },
    }),
  ]);

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className={styles.backRow}>
          <Link href="/platform" className="back-link">
            Back
          </Link>
        </div>

        <div className={styles.titleRow}>
          <h1>Agency Access Requests</h1>
        </div>

        {requests.length === 0 ? (
          <section className={`${styles.card} ${styles.emptyCard}`}>
            <p className={styles.explanation}>
              Approve an organization and create a seven-day invitation for its
              first owner.
            </p>
            <div className={styles.emptyCopy}>
              <h2>No pending requests</h2>
              <p>
                New agency, school, and district access requests will appear here.
              </p>
            </div>
            <Link
              href="/platform"
              className={`action-secondary ${styles.returnLink}`}
            >
              Return to Administration
            </Link>
          </section>
        ) : (
          <AgencyRequestsCarousel
            requests={requests.map((request) => ({
              id: request.id,
              organizationName: request.organizationName,
              organizationType: request.organizationType,
              contactName: `${request.contactFirstName} ${request.contactLastName}`,
              contactEmail: request.contactEmail,
              submittedAt: request.createdAt.toLocaleString(),
            }))}
          />
        )}

        <section className={styles.historySection}>
          <div className={styles.historyTitleRow}>
            <h2>Request history</h2>
          </div>

          {reviewedRequests.length === 0 ? (
            <div className={styles.historyEmpty}>No reviewed requests yet.</div>
          ) : (
            <RequestHistoryCarousel
              requests={reviewedRequests.map((request) => ({
                id: request.id,
                organizationName: request.organizationName,
                organizationType: request.organizationType,
                contactName: `${request.contactFirstName} ${request.contactLastName}`,
                contactEmail: request.contactEmail,
                submittedAt: request.createdAt.toLocaleString(),
                status:
                  request.status === "APPROVED" ? "APPROVED" : "DECLINED",
                reviewedAt: request.reviewedAt?.toLocaleString() ?? null,
                organizationCreated: Boolean(request.approvedOrganizationId),
                approvedOrganizationName:
                  request.approvedOrganization?.name ?? null,
              }))}
            />
          )}
        </section>
      </div>
    </main>
  );
}
