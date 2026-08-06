import { submitCaseSupportRequest } from "@/app/actions/manageCaseSupport";
import { clientDisplayCode } from "@/app/libs/clientIdentity";
import { ContextualHelp } from "@/components/ContextualHelp";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { CaseSupportSuccessToast } from "../../[clientId]/CaseSupportSuccessToast";

type PageQuery = {
  submitted?: string;
  alreadyPending?: string;
};

export default async function RequestCaseSupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<PageQuery>;
}) {
  const [{ clientId }, query, session] = await Promise.all([
    params,
    searchParams,
    getSession(),
  ]);

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
    },
    select: {
      organizationId: true,
      organization: {
        select: {
          type: true,
        },
      },
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!assignment) {
    redirect("/dashboard");
  }

  const [latestRequest, accessibleCase, eligibleSupervisor] = await Promise.all([
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
    db.caseSupportCase.findFirst({
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
      ? db.providerClient.findFirst({
          where: {
            clientId,
            role: "Supervisor",
            organizationId: assignment.organizationId,
            organization: { type: "AGENCY" },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const isPending =
    latestRequest?.status === "REQUESTED" ||
    latestRequest?.status === "ACKNOWLEDGED";
  const openedCase =
    accessibleCase ||
    (latestRequest?.status === "CASE_OPENED" ? latestRequest.linkedCase : null);
  const canRequest = Boolean(
    assignment.organizationId &&
      assignment.organization?.type === "AGENCY" &&
      eligibleSupervisor
  );
  const clientCode = clientDisplayCode(
    assignment.client.firstName,
    assignment.client.lastName
  );
  const successMessage =
    query.submitted === "1"
      ? "Request sent to the assigned supervisor."
      : query.alreadyPending === "1"
        ? "A request is already awaiting review."
        : null;

  return (
    <main className="case-support-page">
      {successMessage ? (
        <CaseSupportSuccessToast message={successMessage} />
      ) : null}

      <a
        href={`/dashboard?clientId=${clientId}&view=orbit`}
        className="back-link"
      >
        Client
      </a>

      <header className="case-support-heading">
        <div style={{ fontSize: 15, opacity: 0.62 }}>{clientCode}</div>
        <div className="case-support-title-with-help">
          <h1>Request Case Support</h1>
          <ContextualHelp
            title="About this request"
            explanation="This sends an in-app request to the supervisor assigned to this client. It does not contact a school or outside organization and should not replace an established emergency procedure."
          />
        </div>
      </header>

      {openedCase ? (
        <section className="paper-surface case-support-card">
          <div className="case-support-eyebrow">CASE OPENED</div>
          <h2 className="case-support-case-title">
            Your request is now a Case Support record.
          </h2>
          <p className="case-support-request-copy">
            You have contributor access and can add your documentation.
          </p>
          <div className="case-support-primary-action">
            <a
              href={`/portal/case-support/${clientId}`}
              className="material-control action-positive"
            >
              Open Case Support
            </a>
          </div>
        </section>
      ) : isPending && latestRequest ? (
        <section className="paper-surface case-support-card">
          <div className="case-support-eyebrow">
            {latestRequest.status === "ACKNOWLEDGED"
              ? "ACKNOWLEDGED"
              : "AWAITING REVIEW"}
          </div>
          <h2 className="case-support-case-title">
            Your request has been sent.
          </h2>
          <CaseRequestSummary
            concern={latestRequest.concern}
            requestedSupport={latestRequest.requestedSupport}
          />
          <p className="case-support-request-meta">
            Sent to{" "}
            {`${latestRequest.recipientSupervisor.firstName} ${latestRequest.recipientSupervisor.lastName}`.trim()}{" "}
            · {latestRequest.createdAt.toLocaleString()}
          </p>
        </section>
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
        <>
          {latestRequest?.status === "DECLINED" ? (
            <section className="paper-surface case-support-card">
              {latestRequest.responseNote ? (
                <>
                  <div className="case-support-eyebrow">
                    SUPERVISOR RESPONSE
                  </div>
                  <h2 className="case-support-case-title case-support-closed-response">
                    {latestRequest.responseNote}
                  </h2>
                  <div className="case-support-closed-status">
                    <strong>Request closed</strong>
                    <p>The previous request was not opened as a case.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="case-support-eyebrow">REQUEST CLOSED</div>
                  <h2 className="case-support-case-title">
                    The previous request was not opened as a case.
                  </h2>
                </>
              )}
            </section>
          ) : null}

          <form
            action={submitCaseSupportRequest}
            className="paper-surface case-support-card"
          >
            <input type="hidden" name="clientId" value={clientId} />
            <div className="case-support-field">
              <ContextualHelp
                label={<span>What needs the supervisor’s attention?</span>}
                title="Describing the concern"
                explanation="Describe observable circumstances or a communication gap. Avoid assigning blame."
                align="center"
              />
              <textarea
                name="concern"
                aria-label="What needs the supervisor’s attention?"
                className="case-support-textarea"
                rows={5}
                minLength={10}
                maxLength={2000}
                required
              />
            </div>

            <div className="case-support-field">
              <ContextualHelp
                label={<span>What support are you requesting?</span>}
                title="Requested support"
                explanation="State what you need the supervisor to clarify, coordinate, or review."
                align="center"
              />
              <textarea
                name="requestedSupport"
                aria-label="What support are you requesting?"
                className="case-support-textarea"
                rows={4}
                minLength={5}
                maxLength={1500}
                required
              />
            </div>

            <div className="case-support-request-safety-note">
              For an immediate safety concern, follow the agency or site’s
              established urgent communication procedure.
            </div>

            <div className="case-support-primary-action">
              <button
                type="submit"
                className="material-control action-positive"
              >
                Send Request
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}

function CaseRequestSummary({
  concern,
  requestedSupport,
}: {
  concern: string;
  requestedSupport: string;
}) {
  return (
    <div className="case-support-request-summary">
      <div>
        <strong>Concern</strong>
        <p>{concern}</p>
      </div>
      <div>
        <strong>Requested support</strong>
        <p>{requestedSupport}</p>
      </div>
    </div>
  );
}
