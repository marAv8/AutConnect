import {
  acknowledgeCaseSupportRequest,
  convertCaseSupportRequest,
  declineCaseSupportRequest,
  openCaseSupportNotification,
} from "@/app/actions/manageCaseSupport";
import {
  CASE_SUPPORT_NOTIFICATION_TITLES,
  caseSupportNotificationAccessWhere,
} from "@/app/libs/caseSupportNotifications";
import { clientDisplayCode } from "@/app/libs/clientIdentity";
import { formatBadgeRole } from "@/app/libs/roles";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
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
  const notifications = await db.caseSupportNotification.findMany({
    where: {
      ...caseSupportNotificationAccessWhere(session.providerId),
      readAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      eventType: true,
      createdAt: true,
      actor: {
        select: { firstName: true, lastName: true },
      },
      case: {
        select: {
          title: true,
          client: { select: { firstName: true, lastName: true } },
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

      {notifications.length > 0 ? (
        <section className="paper-surface case-support-card">
          <h2 className="case-support-section-title">Case updates</h2>
          <div className="case-support-stack">
            {notifications.map((notification) => {
              const senderName = formatProviderDisplayName(
                notification.actor.firstName,
                notification.actor.lastName
              );
              const clientCode = clientDisplayCode(
                notification.case.client.firstName,
                notification.case.client.lastName
              );

              return (
                <form
                  key={notification.id}
                  action={openCaseSupportNotification}
                  className="case-support-confirmation"
                >
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />
                  <div className="case-support-eyebrow">NEW CASE UPDATE</div>
                  <strong>
                    {CASE_SUPPORT_NOTIFICATION_TITLES[notification.eventType]}
                  </strong>
                  <p className="case-support-section-copy">
                    {notification.case.title} · {clientCode} · {senderName} ·{" "}
                    <time dateTime={notification.createdAt.toISOString()}>
                      {notification.createdAt.toLocaleString()}
                    </time>
                  </p>
                  <div className="case-support-request-actions">
                    <button
                      type="submit"
                      className="material-control action-secondary"
                    >
                      Open case
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      ) : null}

      {requests.length === 0 ? (
        <section className="paper-surface case-support-card">
          <div className="case-support-empty">
            There are no requests awaiting review.
          </div>
        </section>
      ) : (
        <div className="case-support-stack">
          {requests.map((request) => {
            const requesterName = formatProviderDisplayName(
              request.requester.firstName,
              request.requester.lastName
            );
            const clientCode = clientDisplayCode(
              request.client.firstName,
              request.client.lastName
            );

            return (
              <details
                key={request.id}
                className="paper-surface case-support-request-item"
                open={request.status === "REQUESTED"}
              >
                <summary>
                  <div>
                    <div className="case-support-eyebrow">
                      {request.status === "ACKNOWLEDGED"
                        ? "RECEIVED"
                        : "NEW REQUEST"}
                    </div>
                    <strong>
                      {request.title?.trim() || "Case Support request"}
                    </strong>
                    <span>
                      {clientCode} · {requesterName} ·{" "}
                      {formatBadgeRole(request.requester.role)}
                    </span>
                  </div>
                  <time dateTime={request.createdAt.toISOString()}>
                    {request.createdAt.toLocaleString()}
                  </time>
                </summary>

                <div className="case-support-request-item-body">
                  <div className="case-support-request-summary">
                    {request.occurredAt ? (
                      <div>
                        <strong>Event date and time</strong>
                        <p>{request.occurredAt.toLocaleString()}</p>
                      </div>
                    ) : null}
                    <div>
                      <strong>What needs support</strong>
                      <p>{request.concern}</p>
                    </div>
                    <div>
                      <strong>Desired outcome</strong>
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
                          Mark received
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
                        Open as a case
                      </button>
                    </form>
                  </div>

                  <details className="case-support-request-decline">
                    <summary>Reply and close request</summary>
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
                        Send response and close
                      </button>
                    </form>
                  </details>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </main>
  );
}
