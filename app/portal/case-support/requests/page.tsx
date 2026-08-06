import {
  acknowledgeCaseSupportRequest,
  convertCaseSupportRequest,
  declineCaseSupportRequest,
} from "@/app/actions/manageCaseSupport";
import { clientDisplayCode } from "@/app/libs/clientIdentity";
import { formatBadgeRole } from "@/app/libs/roles";
import { ContextualHelp } from "@/components/ContextualHelp";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { CaseSupportSuccessToast } from "../[clientId]/CaseSupportSuccessToast";

type PageQuery = {
  acknowledged?: string;
  declined?: string;
};

export default async function CaseSupportRequestsPage({
  searchParams,
}: {
  searchParams: Promise<PageQuery>;
}) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "Supervisor") {
    redirect("/dashboard");
  }

  const requests = await db.caseSupportRequest.findMany({
    where: {
      recipientSupervisorId: session.providerId,
      status: { in: ["REQUESTED", "ACKNOWLEDGED"] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      requester: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  const successMessage =
    query.acknowledged === "1"
      ? "Request acknowledged."
      : query.declined === "1"
        ? "Response sent to the provider."
        : null;

  return (
    <main className="case-support-page">
      {successMessage ? (
        <CaseSupportSuccessToast message={successMessage} />
      ) : null}

      <a href="/dashboard" className="back-link">
        Dashboard
      </a>

      <header className="case-support-heading">
        <div className="case-support-title-with-help">
          <h1>Case Support Requests</h1>
          <ContextualHelp
            title="About Case Support requests"
            explanation="Providers assigned to your clients can request review. A request remains separate from the restricted Case Support record until you open or merge it."
          />
        </div>
      </header>

      {requests.length === 0 ? (
        <section className="paper-surface case-support-card">
          <div className="case-support-empty">
            There are no requests awaiting review.
          </div>
        </section>
      ) : (
        <div className="case-support-stack">
          {requests.map((request) => {
            const requesterName =
              `${request.requester.firstName} ${request.requester.lastName}`.trim();
            const clientCode = clientDisplayCode(
              request.client.firstName,
              request.client.lastName
            );

            return (
              <article
                key={request.id}
                className="paper-surface case-support-card"
              >
                <div className="case-support-request-card-header">
                  <div>
                    <div className="case-support-eyebrow">
                      {request.status === "ACKNOWLEDGED"
                        ? "ACKNOWLEDGED"
                        : "NEW REQUEST"}
                    </div>
                    <h2 className="case-support-case-title">{clientCode}</h2>
                  </div>
                  <div className="case-support-request-meta">
                    {request.createdAt.toLocaleString()}
                  </div>
                </div>

                <div className="case-support-request-person">
                  <strong>{requesterName}</strong>
                  <span>{formatBadgeRole(request.requester.role)}</span>
                </div>

                <div className="case-support-request-summary">
                  <div>
                    <strong>Concern</strong>
                    <p>{request.concern}</p>
                  </div>
                  <div>
                    <strong>Requested support</strong>
                    <p>{request.requestedSupport}</p>
                  </div>
                </div>

                <div className="case-support-request-actions">
                  {request.status === "REQUESTED" ? (
                    <form action={acknowledgeCaseSupportRequest}>
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <button
                        type="submit"
                        className="material-control action-secondary"
                      >
                        Acknowledge
                      </button>
                    </form>
                  ) : null}

                  <form action={convertCaseSupportRequest}>
                    <input
                      type="hidden"
                      name="requestId"
                      value={request.id}
                    />
                    <button
                      type="submit"
                      className="material-control action-positive"
                    >
                      Open Case Support
                    </button>
                  </form>
                </div>

                <details className="case-support-request-decline">
                  <summary>Respond without opening a case</summary>
                  <form action={declineCaseSupportRequest}>
                    <input
                      type="hidden"
                      name="requestId"
                      value={request.id}
                    />
                    <label className="case-support-field">
                      <span>Response to provider</span>
                      <textarea
                        name="responseNote"
                        className="case-support-textarea"
                        rows={3}
                        minLength={5}
                        maxLength={1000}
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className="material-control action-secondary"
                    >
                      Send Response
                    </button>
                  </form>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
