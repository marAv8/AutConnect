import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseSupportRequestCarousel } from "./CaseSupportRequestCarousel";

export default async function RequestCaseSupportPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const [{ clientId }, session] = await Promise.all([params, getSession()]);

  if (!session) {
    redirect("/login");
  }
  if (session.role === "Supervisor" || session.role === "Caregiver") {
    redirect(`/dashboard?clientId=${clientId}&view=orbit`);
  }

  const assignment = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      revokedAt: null,
    },
    select: {
      organizationId: true,
      organization: {
        select: {
          type: true,
        },
      },
    },
  });

  if (!assignment) {
    redirect("/dashboard");
  }

  const [latestRequest, accessibleCases, supervisorAssignments] =
    await Promise.all([
      db.caseSupportRequest.findFirst({
        where: {
          clientId,
          requesterId: session.providerId,
        },
        orderBy: { createdAt: "desc" },
        include: {
          recipientSupervisor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          linkedCase: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      db.caseSupportCase.findMany({
        where: {
          clientId,
          status: "OPEN",
          members: {
            some: {
              providerId: session.providerId,
              revokedAt: null,
            },
          },
        },
        select: { id: true },
      }),
      assignment.organizationId && assignment.organization?.type === "AGENCY"
        ? db.providerClient.findMany({
            where: {
              clientId,
              role: "Supervisor",
              revokedAt: null,
              organizationId: assignment.organizationId,
              providerId: { not: session.providerId },
              provider: { role: "Supervisor" },
              organization: { type: "AGENCY" },
            },
            orderBy: { providerId: "asc" },
            select: {
              providerId: true,
              provider: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

  const eligibleSupervisors = Array.from(
    new Map(
      supervisorAssignments.map((supervisor) => [
        supervisor.providerId,
        supervisor,
      ])
    ).values()
  ).sort((left, right) => {
    const leftName = `${left.provider.firstName} ${left.provider.lastName}`.trim();
    const rightName = `${right.provider.firstName} ${right.provider.lastName}`.trim();
    return leftName.localeCompare(rightName);
  });

  const openedCase =
    latestRequest?.status === "CASE_OPENED" &&
    latestRequest.linkedCase?.status === "OPEN" &&
    accessibleCases.some(
      (supportCase) => supportCase.id === latestRequest.linkedCase?.id
    )
      ? latestRequest.linkedCase
      : null;
  const canRequest = Boolean(
    assignment.organizationId &&
      assignment.organization?.type === "AGENCY" &&
      eligibleSupervisors.length > 0
  );
  return (
    <main className="case-support-page">
      <Link
        href={`/dashboard?clientId=${clientId}&view=orbit`}
        className="back-link"
      >
        Back
      </Link>

      <header className="case-support-heading">
        <h1>Case Support</h1>
      </header>

      {latestRequest ? (
        <RequestStatusCard
          request={latestRequest}
          canOpenCase={Boolean(openedCase)}
          linkedCaseStatus={latestRequest.linkedCase?.status ?? null}
          clientId={clientId}
        />
      ) : !canRequest ? (
        <section className="paper-surface case-support-card">
          <div className="case-support-eyebrow">AGENCY ACCESS REQUIRED</div>
          <h2 className="case-support-case-title">
            Case Support is not available for this assignment.
          </h2>
          <p className="case-support-request-copy">
            Requests can be sent only when you and the assigned supervisor are
            explicitly linked to the same responsible agency for this client.
          </p>
        </section>
      ) : (
        <CaseSupportRequestCarousel
          clientId={clientId}
          supervisors={eligibleSupervisors.map((supervisor) => ({
            id: supervisor.providerId,
            name: formatProviderDisplayName(
              supervisor.provider.firstName,
              supervisor.provider.lastName
            ),
          }))}
        />
      )}
    </main>
  );
}

function RequestStatusCard({
  request,
  canOpenCase,
  linkedCaseStatus,
  clientId,
}: {
  request: {
    status: string;
    title: string | null;
    occurredAt: Date | null;
    concern: string;
    requestedSupport: string;
    responseNote: string | null;
    createdAt: Date;
    recipientSupervisor: {
      firstName: string;
      lastName: string;
    };
  };
  canOpenCase: boolean;
  linkedCaseStatus: string | null;
  clientId: string;
}) {
  const isOpened = request.status === "CASE_OPENED";
  const isClosedCase =
    isOpened &&
    linkedCaseStatus !== null &&
    linkedCaseStatus !== "OPEN";
  const statusLabel =
    request.status === "REQUESTED"
      ? "AWAITING REVIEW"
      : request.status === "ACKNOWLEDGED"
        ? "ACKNOWLEDGED"
        : request.status === "DECLINED"
          ? "SUPERVISOR RESPONSE"
          : isClosedCase
            ? "CLOSED"
            : "CASE OPENED";
  const statusTitle =
    request.status === "REQUESTED"
      ? "Awaiting review"
      : request.status === "ACKNOWLEDGED"
        ? "Your supervisor received this request."
        : request.status === "DECLINED"
          ? "Request closed"
          : isClosedCase
            ? "The Case Support record is closed."
            : "Your request is now a Case Support record.";
  const recipientName = formatProviderDisplayName(
    request.recipientSupervisor.firstName,
    request.recipientSupervisor.lastName
  );

  return (
    <section className="paper-surface case-support-card">
      <div className="case-support-eyebrow">{statusLabel}</div>
      <h2 className="case-support-case-title">{statusTitle}</h2>
      <CaseRequestSummary
        title={request.title}
        occurredAt={request.occurredAt}
        concern={request.concern}
        requestedSupport={request.requestedSupport}
      />
      {request.responseNote ? (
        <div className="case-support-closed-status">
          <strong>Supervisor response</strong>
          <p>{request.responseNote}</p>
        </div>
      ) : null}
      <p className="case-support-request-meta">
        Sent to {recipientName} · {request.createdAt.toLocaleString()}
      </p>
      {isOpened && canOpenCase ? (
        <div className="case-support-primary-action">
          <Link
            href={`/portal/case-support/${clientId}`}
            className="material-control action-positive"
          >
            Open Active Case
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function CaseRequestSummary({
  title,
  occurredAt,
  concern,
  requestedSupport,
}: {
  title: string | null;
  occurredAt: Date | null;
  concern: string;
  requestedSupport: string;
}) {
  return (
    <div className="case-support-request-summary">
      {title ? (
        <div>
          <strong>Case title</strong>
          <p>{title}</p>
        </div>
      ) : null}
      {occurredAt ? (
        <div>
          <strong>Event date and time</strong>
          <p>{occurredAt.toLocaleString()}</p>
        </div>
      ) : null}
      <div>
        <strong>What needs support</strong>
        <p>{concern}</p>
      </div>
      <div>
        <strong>Desired outcome</strong>
        <p>{requestedSupport}</p>
      </div>
    </div>
  );
}
