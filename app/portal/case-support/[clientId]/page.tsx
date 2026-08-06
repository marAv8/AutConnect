import {
  createCaseSupportCase,
  createCaseSupportCoordination,
  createCaseSupportEntry,
  markCaseSupportEntryReviewed,
  updateCaseSupportAccess,
} from "@/app/actions/manageCaseSupport";
import { clientDisplayCode } from "@/app/libs/clientIdentity";
import { ContextualHelp } from "@/components/ContextualHelp";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { CaseSupportSuccessToast } from "./CaseSupportSuccessToast";

type PageQuery = {
  compose?: string;
  clarify?: string;
  created?: string;
  saved?: string;
  coordinate?: string;
  coordinationSaved?: string;
  accessUpdated?: string;
  requestOpened?: string;
  reviewed?: string;
};

type CaseEntryView = {
  id: string;
  authorId: string;
  amendsEntryId: string | null;
  entryType: string;
  occurredAt: Date;
  requestSource: string;
  requestedBy: string | null;
  coverageStatus: string;
  durationMinutes: number | null;
  scheduleImpacts: string[];
  whatOccurred: string;
  supportProvided: string;
  observableOutcome: string;
  communication: string | null;
  followUp: string | null;
  clarification: string | null;
  createdAt: Date;
  author: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

type CaseCoordinationView = {
  id: string;
  path: string;
  status: string;
  occurredAt: Date;
  contactOrganization: string | null;
  contactRole: string | null;
  contactName: string | null;
  communicationMethod: string | null;
  actionTaken: string;
  requestOrDecision: string;
  responseSummary: string | null;
  nextStep: string | null;
  followUpAt: Date | null;
  createdAt: Date;
  author: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

export default async function CaseSupportPage({
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

  const assignment = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
    },
    select: {
      role: true,
      organizationId: true,
      organization: {
        select: {
          name: true,
          type: true,
        },
      },
      client: {
        select: {
          firstName: true,
          lastName: true,
          providerClients: {
            orderBy: {
              provider: { firstName: "asc" },
            },
            select: {
              providerId: true,
              role: true,
              organizationId: true,
              provider: {
                select: {
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    redirect("/dashboard");
  }

  const isSupervisor = session.role === "Supervisor";
  const supportCase = await db.caseSupportCase.findFirst({
    where: {
      clientId,
      status: "OPEN",
      OR: [
        { ownerSupervisorId: session.providerId },
        {
          members: {
            some: {
              providerId: session.providerId,
              revokedAt: null,
            },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      ownerSupervisor: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      members: {
        where: { revokedAt: null },
        orderBy: { grantedAt: "asc" },
        include: {
          provider: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      entries: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: {
          author: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      coordinations: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: {
          author: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      originatingRequests: {
        orderBy: { createdAt: "asc" },
        include: {
          requester: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          actor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!supportCase && !isSupervisor) {
    redirect(`/dashboard?clientId=${clientId}&view=orbit`);
  }

  const latestProviderRequest = !isSupervisor
    ? await db.caseSupportRequest.findFirst({
        where: {
          clientId,
          requesterId: session.providerId,
          status: { in: ["REQUESTED", "ACKNOWLEDGED", "DECLINED"] },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          recipientSupervisor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      })
    : null;

  const client = assignment.client;
  const initials = clientDisplayCode(client.firstName, client.lastName);
  const ownerName = supportCase
    ? `${supportCase.ownerSupervisor.firstName} ${supportCase.ownerSupervisor.lastName}`.trim()
    : "";
  const isOwner = supportCase?.ownerSupervisorId === session.providerId;
  const membership = supportCase?.members.find(
    ({ providerId }) => providerId === session.providerId
  );
  const canContribute = Boolean(
    isOwner || membership?.accessLevel === "CONTRIBUTOR"
  );
  const activeMemberIds = new Set(
    supportCase?.members.map(({ providerId }) => providerId) ?? []
  );
  const responsibleOrganizationId =
    supportCase?.organizationId ?? assignment.organizationId;
  const selectableProviders = client.providerClients.filter(
    ({ providerId, organizationId }) =>
      providerId !== session.providerId &&
      Boolean(responsibleOrganizationId) &&
      organizationId === responsibleOrganizationId
  );
  const hasAgencyAssignment =
    assignment.organization?.type === "AGENCY" &&
    Boolean(assignment.organizationId);
  const entries = (supportCase?.entries ?? []) as CaseEntryView[];
  const originalEntries = entries.filter(({ amendsEntryId }) => !amendsEntryId);
  const clarificationTarget = query.clarify
    ? originalEntries.find(
        ({ id, authorId }) =>
          id === query.clarify && authorId === session.providerId
      )
    : undefined;
  const showComposer =
    canContribute && (query.compose === "1" || Boolean(clarificationTarget));
  const coordinationPath =
    isOwner &&
    (query.coordinate === "internal" || query.coordinate === "external")
      ? query.coordinate
      : null;
  const coordinations = (supportCase?.coordinations ??
    []) as CaseCoordinationView[];
  const accessEvents =
    supportCase?.auditEvents.filter((event) =>
      ["CASE_CREATED", "ACCESS_GRANTED", "ACCESS_REVOKED"].includes(
        event.action
      )
    ) ?? [];
  const documentationReviewEvents = supportCase
    ? await db.caseSupportAuditEvent.findMany({
        where: {
          caseId: supportCase.id,
          action: "DOCUMENTATION_REVIEWED",
        },
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      })
    : [];
  const reviewByEntryId = new Map<
    string,
    (typeof documentationReviewEvents)[number]
  >();
  for (const event of documentationReviewEvents) {
    const details = event.details;
    if (
      typeof details !== "object" ||
      details === null ||
      Array.isArray(details) ||
      !("entryId" in details) ||
      typeof details.entryId !== "string" ||
      reviewByEntryId.has(details.entryId)
    ) {
      continue;
    }
    reviewByEntryId.set(details.entryId, event);
  }
  const successMessage =
    query.created === "1"
      ? "Case Support created."
      : query.saved === "1"
        ? "Documentation saved."
        : query.coordinationSaved === "1"
          ? "Coordination saved."
          : query.accessUpdated === "1"
            ? "Access updated."
            : query.requestOpened === "1"
              ? "Request opened as Case Support."
              : query.reviewed === "1"
                ? "Documentation marked as reviewed."
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
        <div style={{ fontSize: 15, opacity: 0.62 }}>{initials}</div>
        <div className="case-support-title-with-help">
          <h1>Case Support</h1>
          <ContextualHelp
            title="About Case Support"
            explanation="This is a restricted agency support record. Access is granted explicitly, and every access change is preserved."
          />
        </div>
      </header>

      {latestProviderRequest ? (
        <ProviderRequestUpdate request={latestProviderRequest} />
      ) : null}

      {!supportCase && !hasAgencyAssignment ? (
        <section className="paper-surface case-support-card">
          <div className="case-support-eyebrow">AGENCY TEAM REQUIRED</div>
          <h2 className="case-support-case-title">
            Identify the responsible agency first.
          </h2>
          <p className="case-support-request-copy">
            Case Support cannot be opened or shared until this client’s
            supervisor and agency providers are explicitly classified as the
            same agency team.
          </p>
          <div className="case-support-primary-action">
            <a
              href={`/portal/supervisor/edit-providers/${clientId}`}
              className="material-control action-positive"
            >
              Set Agency Team
            </a>
          </div>
        </section>
      ) : !supportCase ? (
        <form
          action={createCaseSupportCase}
          className="paper-surface case-support-card"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <CaseTextField
            label="Case title"
            name="title"
            placeholder="Classroom integration support"
          />
          <CaseTextArea
            label="What needs support?"
            name="concern"
            hint="Document observable circumstances and communication gaps. Avoid assigning blame."
          />
          <CaseTextArea
            label="Desired outcome"
            name="desiredOutcome"
            hint="Describe what coordinated support should make safer, clearer, or more consistent."
            compact
          />
          <ProviderAccessChoices
            providers={selectableProviders}
            selectedProviderIds={new Set()}
          />
          <CenteredSubmit>Create Case Support</CenteredSubmit>
        </form>
      ) : (
        <div className="case-support-stack">
          <section className="paper-surface case-support-card">
            <div>
              <div className="case-support-eyebrow">OPEN CASE</div>
              <h2 className="case-support-case-title">{supportCase.title}</h2>
            </div>
            <CaseReadSection
              label="Support concern"
              value={supportCase.concern}
            />
            <CaseReadSection
              label="Desired outcome"
              value={supportCase.desiredOutcome}
            />
            <div style={{ fontSize: 13, opacity: 0.62 }}>
              Case owner: {ownerName}
            </div>
            {supportCase.originatingRequests.length > 0 ? (
              <details className="case-support-origin-request">
                <summary>Original provider request</summary>
                <div className="case-support-request-summary">
                  {supportCase.originatingRequests.map((request) => (
                    <div key={request.id}>
                      <strong>
                        {request.requester.firstName}{" "}
                        {request.requester.lastName}
                      </strong>
                      <p>{request.concern}</p>
                      <strong>Requested support</strong>
                      <p>{request.requestedSupport}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          {canContribute && !showComposer ? (
            <div className="case-support-primary-action">
              <a
                href={`/portal/case-support/${clientId}?compose=1`}
                className="material-control action-positive"
              >
                Add documentation
              </a>
            </div>
          ) : null}

          {showComposer ? (
            clarificationTarget ? (
              <ClarificationForm
                clientId={clientId}
                caseId={supportCase.id}
                entry={clarificationTarget}
              />
            ) : (
              <DocumentationForm
                clientId={clientId}
                caseId={supportCase.id}
                isSupervisor={Boolean(isOwner)}
              />
            )
          ) : null}

          <section className="paper-surface case-support-card">
            <div className="case-support-title-with-help">
              <h2 className="case-support-section-title">
                Documentation timeline
              </h2>
              <ContextualHelp
                title="About the documentation timeline"
                explanation="Entries stay in their original form. A correction is added as a linked clarification, never as a silent replacement."
              />
            </div>

            {originalEntries.length === 0 ? (
              <div className="case-support-empty">
                No documentation has been added yet.
              </div>
            ) : (
              <div className="case-support-timeline">
                {originalEntries.map((entry) => (
                  <CaseEntry
                    key={entry.id}
                    entry={entry}
                    clarifications={entries.filter(
                      ({ amendsEntryId }) => amendsEntryId === entry.id
                    )}
                    clientId={clientId}
                    canClarify={entry.authorId === session.providerId}
                    caseId={supportCase.id}
                    canReview={Boolean(isOwner)}
                    reviewEvent={reviewByEntryId.get(entry.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="paper-surface case-support-card">
            <div className="case-support-title-with-help">
              <h2 className="case-support-section-title">
                Agency coordination
              </h2>
              <ContextualHelp
                title="About agency coordination"
                explanation="Internal actions cover decisions within the agency’s authority. External follow-up records communication with a school, district, or other organization; AuthConnect does not contact them or grant them access."
              />
            </div>

            {isOwner && !coordinationPath ? (
              <div className="case-support-coordination-paths">
                <a
                  href={`/portal/case-support/${clientId}?coordinate=internal`}
                  className="case-support-path-choice"
                >
                  <strong>Record internal action</strong>
                </a>
                <a
                  href={`/portal/case-support/${clientId}?coordinate=external`}
                  className="case-support-path-choice"
                >
                  <strong>Record external follow-up</strong>
                </a>
              </div>
            ) : null}

            {coordinationPath ? (
              <CoordinationForm
                clientId={clientId}
                caseId={supportCase.id}
                path={coordinationPath}
              />
            ) : null}

            <div>
              <h3 className="case-support-subsection-title">
                Coordination history
              </h3>
              {coordinations.length === 0 ? (
                <div className="case-support-empty">
                  No coordination has been recorded yet.
                </div>
              ) : (
                <div className="case-support-timeline">
                  {coordinations.map((coordination) => (
                    <CoordinationEntry
                      key={coordination.id}
                      coordination={coordination}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <details className="paper-surface case-support-details">
            <summary>Manage access</summary>
            <div className="case-support-details-body">
              <ContextualHelp
                title="About case access"
                explanation="Only the case owner and explicitly listed providers can open this record."
              />
              {isOwner ? (
                <form
                  action={updateCaseSupportAccess}
                  className="case-support-stack"
                >
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="caseId" value={supportCase.id} />
                  <ProviderAccessChoices
                    providers={selectableProviders}
                    selectedProviderIds={activeMemberIds}
                  />
                  <CenteredSubmit>Update Access</CenteredSubmit>
                </form>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <AccessPerson name={ownerName} role="Supervisor · Owner" />
                  {supportCase.members.map(({ id, provider }) => (
                    <AccessPerson
                      key={id}
                      name={`${provider.firstName} ${provider.lastName}`.trim()}
                      role={roleLabel(provider.role)}
                    />
                  ))}
                </div>
              )}
            </div>
          </details>

          <details className="paper-surface case-support-details">
            <summary>Access history</summary>
            <div className="case-support-details-body">
              <div style={{ display: "grid", gap: 12 }}>
                {accessEvents.map((event) => (
                  <div className="case-support-audit-event" key={event.id}>
                    <div>{auditLabel(event.action, event.details)}</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>
                      {event.actor.firstName} {event.actor.lastName} ·{" "}
                      {event.createdAt.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
    </main>
  );
}

function ProviderRequestUpdate({
  request,
}: {
  request: {
    status: string;
    responseNote: string | null;
    createdAt: Date;
    acknowledgedAt: Date | null;
    respondedAt: Date | null;
    recipientSupervisor: {
      firstName: string;
      lastName: string;
    };
  };
}) {
  const supervisorName =
    `${request.recipientSupervisor.firstName} ${request.recipientSupervisor.lastName}`.trim();
  const isResponse = request.status === "DECLINED";
  const isAcknowledged = request.status === "ACKNOWLEDGED";
  const statusLabel = isResponse
    ? "SUPERVISOR RESPONSE"
    : isAcknowledged
      ? "REQUEST ACKNOWLEDGED"
      : "AWAITING REVIEW";
  const statusTime =
    request.respondedAt ?? request.acknowledgedAt ?? request.createdAt;

  return (
    <section className="paper-surface case-support-card case-support-provider-update">
      <div className="case-support-eyebrow">{statusLabel}</div>
      <h2 className="case-support-section-title">
        {isResponse
          ? `${supervisorName} responded to your request.`
          : isAcknowledged
            ? `${supervisorName} received your request.`
            : `Your request was sent to ${supervisorName}.`}
      </h2>
      {request.responseNote ? (
        <p className="case-support-provider-response">
          {request.responseNote}
        </p>
      ) : isAcknowledged ? (
        <p className="case-support-request-copy">
          The request remains open while the supervisor reviews the next step.
        </p>
      ) : (
        <p className="case-support-request-copy">
          The supervisor has not acknowledged it yet.
        </p>
      )}
      <div className="case-support-request-meta">
        Updated {statusTime.toLocaleString()}
      </div>
    </section>
  );
}

function CoordinationForm({
  clientId,
  caseId,
  path,
}: {
  clientId: string;
  caseId: string;
  path: "internal" | "external";
}) {
  const isExternal = path === "external";

  return (
    <form
      action={createCaseSupportCoordination}
      className="case-support-coordination-form"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="caseId" value={caseId} />
      <input
        type="hidden"
        name="path"
        value={isExternal ? "EXTERNAL" : "INTERNAL"}
      />

      <div>
        <div className="case-support-eyebrow">
          {isExternal ? "EXTERNAL FOLLOW-UP" : "INTERNAL COORDINATION"}
        </div>
        <div className="case-support-title-with-help">
          <h3 className="case-support-subsection-title">
            {isExternal
              ? "Record outside communication"
              : "Record an agency action"}
          </h3>
          <ContextualHelp
            title={
              isExternal
                ? "About external follow-up"
                : "About internal coordination"
            }
            explanation={
              isExternal
                ? "This is a record only. AuthConnect will not send a message, create an outside account, or imply that the recipient approved the request."
                : "Document guidance or decisions within agency authority, including deciding who will make outside contact. Once that contact occurs, record it as external follow-up."
            }
          />
        </div>
      </div>

      <div className="case-support-form-grid">
        <CaseInput
          label={
            isExternal
              ? "When did communication occur?"
              : "When did this action occur?"
          }
          name="occurredAt"
          type="datetime-local"
          defaultValue={localDateTimeValue(new Date())}
          required
        />
        <CaseSelect
          label="Current status"
          name="status"
          defaultValue={isExternal ? "AWAITING_RESPONSE" : "MONITORING"}
          options={
            isExternal
              ? [
                  ["", "Select one"],
                  ["AWAITING_RESPONSE", "Awaiting response"],
                  ["RESPONSE_RECEIVED", "Response received"],
                  ["FOLLOW_UP_NEEDED", "Follow-up needed"],
                  ["COMPLETE", "Complete"],
                ]
              : [
                  ["", "Select one"],
                  ["DOCUMENTED", "Documented"],
                  ["MONITORING", "Monitoring"],
                  ["FOLLOW_UP_NEEDED", "Follow-up needed"],
                  ["COMPLETE", "Complete"],
                ]
          }
        />
      </div>

      {isExternal ? (
        <>
          <div className="case-support-form-grid">
            <CaseInput
              label="Outside organization"
              name="contactOrganization"
              type="text"
              maxLength={200}
              placeholder="School or district"
              required
            />
            <CaseInput
              label="Recipient’s role"
              name="contactRole"
              type="text"
              maxLength={160}
              placeholder="Principal, coordinator, psychologist…"
              required
            />
            <CaseInput
              label="Recipient’s name (optional)"
              name="contactName"
              type="text"
              maxLength={160}
            />
            <CaseSelect
              label="Communication method"
              name="communicationMethod"
              options={[
                ["", "Select one"],
                ["EMAIL", "Email"],
                ["PHONE", "Phone"],
                ["IN_PERSON", "In person"],
                ["VIRTUAL_MEETING", "Virtual meeting"],
                ["WRITTEN_NOTICE", "Written notice"],
                ["OTHER", "Other"],
              ]}
            />
          </div>
          <CaseDocumentationArea
            label="What was communicated?"
            name="actionTaken"
            hint="Summarize the relevant facts shared. Do not paste an entire email or unrelated private information."
            required
          />
          <CaseDocumentationArea
            label="What clarification or action was requested?"
            name="requestOrDecision"
            hint="State the request without representing it as an instruction the agency can impose."
            required
          />
          <CaseDocumentationArea
            label="Response received"
            name="responseSummary"
            hint="Summarize a response if one has been received. Required when the status is Response received."
          />
        </>
      ) : (
        <>
          <CaseDocumentationArea
            label="Agency action or guidance"
            name="actionTaken"
            hint="Document the support, guidance, or decision taken within agency authority."
            required
          />
          <CaseDocumentationArea
            label="Authority and scope"
            name="requestOrDecision"
            hint="Clarify what the agency can determine and what remains outside its control."
            required
          />
        </>
      )}

      <CaseDocumentationArea
        label="Next step"
        name="nextStep"
        hint="Record the next responsible action or unresolved question. Optional."
      />
      <CaseInput
        label="Follow-up date (optional)"
        hint="Use this only when the supervisor plans to revisit the coordination on a specific date."
        name="followUpAt"
        type="datetime-local"
      />
      <FormActions clientId={clientId} submitLabel="Save coordination" />
    </form>
  );
}

function CoordinationEntry({
  coordination,
}: {
  coordination: CaseCoordinationView;
}) {
  const isExternal = coordination.path === "EXTERNAL";
  const authorName =
    `${coordination.author.firstName} ${coordination.author.lastName}`.trim();
  const contact = [
    coordination.contactName,
    coordination.contactRole,
    coordination.contactOrganization,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="case-support-entry">
      <div className="case-support-entry-heading">
        <div>
          <div className="case-support-eyebrow">
            {isExternal ? "EXTERNAL FOLLOW-UP" : "INTERNAL COORDINATION"}
          </div>
          <h3>{coordinationStatusLabel(coordination.status)}</h3>
          <div className="case-support-entry-meta">
            {authorName} · {coordination.occurredAt.toLocaleString()}
          </div>
        </div>
      </div>

      {isExternal ? (
        <div className="case-support-facts-grid">
          <CaseFact label="Outside contact" value={contact || "Not recorded"} />
          <CaseFact
            label="Method"
            value={communicationMethodLabel(
              coordination.communicationMethod
            )}
          />
        </div>
      ) : null}

      <CaseReadSection
        label={
          isExternal
            ? "What was communicated"
            : "Agency action or guidance"
        }
        value={coordination.actionTaken}
      />
      <CaseReadSection
        label={
          isExternal
            ? "Clarification or action requested"
            : "Authority and scope"
        }
        value={coordination.requestOrDecision}
      />
      {coordination.responseSummary ? (
        <CaseReadSection
          label="Response received"
          value={coordination.responseSummary}
        />
      ) : null}
      {coordination.nextStep ? (
        <CaseReadSection label="Next step" value={coordination.nextStep} />
      ) : null}
      {coordination.followUpAt ? (
        <CaseFact
          label="Follow-up"
          value={coordination.followUpAt.toLocaleString()}
        />
      ) : null}

      <div className="case-support-entry-meta">
        Preserved in the case record · Added{" "}
        {coordination.createdAt.toLocaleString()}
      </div>
    </article>
  );
}

function DocumentationForm({
  clientId,
  caseId,
  isSupervisor,
}: {
  clientId: string;
  caseId: string;
  isSupervisor: boolean;
}) {
  return (
    <form
      action={createCaseSupportEntry}
      className="paper-surface case-support-card"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="caseId" value={caseId} />
      <div>
        <div className="case-support-eyebrow">
          {isSupervisor ? "COORDINATION UPDATE" : "PROVIDER ACCOUNT"}
        </div>
        <div className="case-support-title-with-help">
          <h2 className="case-support-section-title">Add documentation</h2>
          <ContextualHelp
            title="About case documentation"
            explanation="Record observable facts. Helping another child is not treated as a concern by itself; the record separates support from coverage and coordination."
          />
        </div>
      </div>

      <div className="case-support-form-grid">
        <CaseInput
          label="When did this occur?"
          name="occurredAt"
          type="datetime-local"
          defaultValue={localDateTimeValue(new Date())}
          required
        />
        <CaseSelect
          label="Who initiated the request?"
          name="requestSource"
          options={[
            ["", "Select one"],
            ["CLASSROOM_STAFF", "Classroom staff"],
            ["SCHOOL_ADMINISTRATION", "School administration"],
            ["AGENCY_SUPERVISOR", "Agency supervisor"],
            ["SAFETY_NEED", "Immediate safety need"],
            ["SELF_INITIATED", "Provider noticed a need"],
            ["OTHER", "Other"],
            ["UNCLEAR", "Unclear"],
          ]}
        />
        <CaseInput
          label="Requested by (optional)"
          name="requestedBy"
          type="text"
          maxLength={160}
          placeholder="Name or role"
        />
        <CaseSelect
          label="Assigned client coverage"
          name="coverageStatus"
          options={[
            ["", "Select one"],
            ["MAINTAINED", "Maintained"],
            ["TEMPORARILY_REASSIGNED", "Temporarily reassigned"],
            ["NOT_MAINTAINED", "Not maintained"],
            ["UNCLEAR", "Unclear"],
          ]}
        />
        <CaseInput
          label="Approximate duration (minutes)"
          name="durationMinutes"
          type="number"
          min={1}
          max={720}
          placeholder="Optional"
        />
      </div>

      <ScheduleImpactChoices />
      <CaseDocumentationArea
        label="What occurred?"
        name="whatOccurred"
        hint="Describe the sequence you directly observed."
        required
      />
      <CaseDocumentationArea
        label="Support provided"
        name="supportProvided"
        hint="Describe what you did without interpreting intent."
        required
      />
      <CaseDocumentationArea
        label="Observable outcome"
        name="observableOutcome"
        hint="Record what changed, remained the same, or was not observed."
        required
      />
      <CaseDocumentationArea
        label="Communication"
        name="communication"
        hint="Who was informed, what was communicated, and when? Optional."
      />
      <CaseDocumentationArea
        label="Follow-up"
        name="followUp"
        hint="Document an agreed next step or unresolved question. Optional."
      />

      <FormActions clientId={clientId} submitLabel="Add to timeline" />
    </form>
  );
}

function ClarificationForm({
  clientId,
  caseId,
  entry,
}: {
  clientId: string;
  caseId: string;
  entry: CaseEntryView;
}) {
  return (
    <form
      action={createCaseSupportEntry}
      className="paper-surface case-support-card"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="amendsEntryId" value={entry.id} />
      <div>
        <div className="case-support-eyebrow">LINKED CLARIFICATION</div>
        <div className="case-support-title-with-help">
          <h2 className="case-support-section-title">
            Clarify your documentation
          </h2>
          <ContextualHelp
            title="About linked clarification"
            explanation="The original entry remains visible. Add only the missing or corrected fact so readers do not have to compare duplicate accounts."
          />
        </div>
      </div>
      <CaseDocumentationArea
        label="What should readers understand?"
        name="clarification"
        hint="State only the correction or added context."
        required
        maxLength={2000}
      />
      <FormActions clientId={clientId} submitLabel="Add clarification" />
    </form>
  );
}

function CaseEntry({
  entry,
  clarifications,
  clientId,
  canClarify,
  caseId,
  canReview,
  reviewEvent,
}: {
  entry: CaseEntryView;
  clarifications: CaseEntryView[];
  clientId: string;
  canClarify: boolean;
  caseId: string;
  canReview: boolean;
  reviewEvent?: {
    createdAt: Date;
    actor: { firstName: string; lastName: string };
  };
}) {
  const authorName =
    `${entry.author.firstName} ${entry.author.lastName}`.trim();
  const latestActivityAt = clarifications.reduce(
    (latest, clarification) =>
      clarification.createdAt > latest ? clarification.createdAt : latest,
    entry.createdAt
  );
  const isReviewed = Boolean(
    reviewEvent && reviewEvent.createdAt >= latestActivityAt
  );
  const reviewerName = reviewEvent
    ? `${reviewEvent.actor.firstName} ${reviewEvent.actor.lastName}`.trim()
    : "";

  return (
    <details
      className={`case-support-entry${isReviewed ? " is-reviewed" : ""}`}
      open={!isReviewed}
    >
      <summary className="case-support-entry-summary">
        <div>
          <div className="case-support-eyebrow">
            {entryTypeLabel(entry.entryType)}
          </div>
          <h3>{authorName}</h3>
          <div className="case-support-entry-meta">
            {roleLabel(entry.author.role)} ·{" "}
            {entry.occurredAt.toLocaleString()}
          </div>
        </div>
        <div className="case-support-entry-review-state">
          {isReviewed ? "Reviewed" : "New"}
        </div>
      </summary>

      <div className="case-support-entry-body">
        <div className="case-support-entry-actions">
          {canClarify ? (
            <a
              className="case-support-clarify-link"
              href={`/portal/case-support/${clientId}?clarify=${entry.id}`}
            >
              Add clarification
            </a>
          ) : null}
          {canReview && !isReviewed ? (
            <form action={markCaseSupportEntryReviewed}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="entryId" value={entry.id} />
              <button
                type="submit"
                className="case-support-review-button"
              >
                Mark reviewed
              </button>
            </form>
          ) : null}
        </div>

        <div className="case-support-facts-grid">
        <CaseFact
          label="Request source"
          value={requestSourceLabel(entry.requestSource)}
        />
        <CaseFact
          label="Assigned client coverage"
          value={coverageLabel(entry.coverageStatus)}
        />
        {entry.requestedBy ? (
          <CaseFact label="Requested by" value={entry.requestedBy} />
        ) : null}
        {entry.durationMinutes ? (
          <CaseFact
            label="Approximate duration"
            value={`${entry.durationMinutes} minutes`}
          />
        ) : null}
        <CaseFact
          label="Schedule impact"
          value={scheduleImpactLabel(entry.scheduleImpacts)}
        />
        </div>

      <CaseReadSection label="What occurred" value={entry.whatOccurred} />
      <CaseReadSection
        label="Support provided"
        value={entry.supportProvided}
      />
      <CaseReadSection
        label="Observable outcome"
        value={entry.observableOutcome}
      />
      {entry.communication ? (
        <CaseReadSection label="Communication" value={entry.communication} />
      ) : null}
      {entry.followUp ? (
        <CaseReadSection label="Follow-up" value={entry.followUp} />
      ) : null}

        {clarifications.length > 0 ? (
        <div className="case-support-clarifications">
          {clarifications.map((clarification) => (
            <div key={clarification.id} className="case-support-clarification">
              <div className="case-support-eyebrow">CLARIFICATION</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {clarification.clarification}
              </div>
              <div className="case-support-entry-meta">
                Added {clarification.createdAt.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        ) : null}

        {isReviewed && reviewEvent ? (
          <div className="case-support-reviewed-meta">
            Reviewed by {reviewerName} · {reviewEvent.createdAt.toLocaleString()}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function FieldLabelWithHelp({
  label,
  explanation,
}: {
  label: string;
  explanation: string;
}) {
  return (
    <span className="case-support-field-label">
      <span>{label}</span>
      <ContextualHelp
        title={label}
        explanation={explanation}
      />
    </span>
  );
}

function CaseInput({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="case-support-field">
      {hint ? (
        <FieldLabelWithHelp label={label} explanation={hint} />
      ) : (
        <span>{label}</span>
      )}
      <input {...props} name={props.name} />
    </label>
  );
}

function CaseSelect({
  label,
  name,
  options,
  defaultValue = "",
}: {
  label: string;
  name: string;
  options: Array<[string, string]>;
  defaultValue?: string;
}) {
  return (
    <label className="case-support-field">
      <span>{label}</span>
      <MaterialSelect
        name={name}
        required
        defaultValue={defaultValue}
        style={{ width: "100%", minHeight: 48 }}
        options={options.map(([value, text]) => ({ value, label: text }))}
      />
    </label>
  );
}

function CaseDocumentationArea({
  label,
  name,
  hint,
  required = false,
  maxLength = 4000,
}: {
  label: string;
  name: string;
  hint: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="case-support-field">
      <FieldLabelWithHelp label={label} explanation={hint} />
      <textarea
        name={name}
        required={required}
        minLength={required ? 3 : undefined}
        maxLength={maxLength}
        rows={4}
      />
    </label>
  );
}

function ScheduleImpactChoices() {
  const choices = [
    ["NONE", "None"],
    ["BREAK", "Break"],
    ["LUNCH", "Lunch"],
    ["STAFFING", "Staffing"],
    ["CLIENT_SCHEDULE", "Client schedule"],
    ["OTHER", "Other"],
    ["UNCLEAR", "Unclear"],
  ];

  return (
    <fieldset className="case-support-choice-fieldset">
      <legend>
        <FieldLabelWithHelp
          label="Schedule or staffing impact"
          explanation="Select every item that applies."
        />
      </legend>
      <div className="case-support-choice-grid">
        {choices.map(([value, label]) => (
          <label key={value}>
            <input type="checkbox" name="scheduleImpacts" value={value} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FormActions({
  clientId,
  submitLabel,
}: {
  clientId: string;
  submitLabel: string;
}) {
  return (
    <div className="case-support-form-actions">
      <a
        href={`/portal/case-support/${clientId}`}
        className="material-control"
      >
        Cancel
      </a>
      <button
        type="submit"
        className="material-control action-positive"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function CaseTextField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="case-support-field">
      <span>{label}</span>
      <input
        name={name}
        required
        minLength={3}
        maxLength={120}
        placeholder={placeholder}
      />
    </label>
  );
}

function CaseTextArea({
  label,
  name,
  hint,
  compact = false,
}: {
  label: string;
  name: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <label className="case-support-field">
      <FieldLabelWithHelp label={label} explanation={hint} />
      <textarea
        name={name}
        required
        minLength={compact ? 5 : 10}
        maxLength={compact ? 2000 : 4000}
        rows={compact ? 4 : 6}
      />
    </label>
  );
}

function ProviderAccessChoices({
  providers,
  selectedProviderIds,
}: {
  providers: Array<{
    providerId: string;
    role: string;
    provider: {
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
  selectedProviderIds: Set<string>;
}) {
  return (
    <fieldset className="case-support-choice-fieldset">
      <legend>
        <FieldLabelWithHelp
          label="Case access"
          explanation="Select only providers who belong to the responsible agency. Profession alone does not determine access."
        />
      </legend>
      <div className="case-support-provider-grid">
        {providers.map(({ providerId, role, provider }) => (
          <label key={providerId} className="provider-option">
            <input
              type="checkbox"
              name="providerIds"
              value={providerId}
              defaultChecked={selectedProviderIds.has(providerId)}
            />
            <span>
              <strong>
                {provider.firstName} {provider.lastName}
              </strong>
              <small>{roleLabel(role)}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CenteredSubmit({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <button
        type="submit"
        className="material-control action-positive"
      >
        {children}
      </button>
    </div>
  );
}

function CaseReadSection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 650 }}>{label}</div>
      <div style={{ lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

function CaseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="case-support-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AccessPerson({ name, role }: { name: string; role: string }) {
  return (
    <div className="case-support-access-person">
      <span>{name}</span>
      <span>{role}</span>
    </div>
  );
}

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function roleLabel(role: string) {
  switch (role) {
    case "BehaviorTherapist":
      return "Behavior Technician";
    case "SpeechPathologist":
      return "Speech Pathologist";
    case "OccupationalTherapist":
      return "Occupational Therapist";
    case "Caregiver":
      return "Caretaker";
    default:
      return role;
  }
}

function entryTypeLabel(entryType: string) {
  return entryType === "SUPERVISOR_COORDINATION"
    ? "COORDINATION UPDATE"
    : "PROVIDER ACCOUNT";
}

function requestSourceLabel(value: string) {
  const labels: Record<string, string> = {
    CLASSROOM_STAFF: "Classroom staff",
    SCHOOL_ADMINISTRATION: "School administration",
    AGENCY_SUPERVISOR: "Agency supervisor",
    SAFETY_NEED: "Immediate safety need",
    SELF_INITIATED: "Provider noticed a need",
    OTHER: "Other",
    UNCLEAR: "Unclear",
  };
  return labels[value] ?? value;
}

function coverageLabel(value: string) {
  const labels: Record<string, string> = {
    MAINTAINED: "Maintained",
    TEMPORARILY_REASSIGNED: "Temporarily reassigned",
    NOT_MAINTAINED: "Not maintained",
    UNCLEAR: "Unclear",
  };
  return labels[value] ?? value;
}

function coordinationStatusLabel(value: string) {
  const labels: Record<string, string> = {
    DOCUMENTED: "Documented",
    AWAITING_RESPONSE: "Awaiting response",
    RESPONSE_RECEIVED: "Response received",
    MONITORING: "Monitoring",
    FOLLOW_UP_NEEDED: "Follow-up needed",
    COMPLETE: "Complete",
  };
  return labels[value] ?? value;
}

function communicationMethodLabel(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const labels: Record<string, string> = {
    EMAIL: "Email",
    PHONE: "Phone",
    IN_PERSON: "In person",
    VIRTUAL_MEETING: "Virtual meeting",
    WRITTEN_NOTICE: "Written notice",
    OTHER: "Other",
  };
  return labels[value] ?? value;
}

function scheduleImpactLabel(values: string[]) {
  if (values.length === 0) {
    return "Not recorded";
  }
  const labels: Record<string, string> = {
    NONE: "None",
    BREAK: "Break",
    LUNCH: "Lunch",
    STAFFING: "Staffing",
    CLIENT_SCHEDULE: "Client schedule",
    OTHER: "Other",
    UNCLEAR: "Unclear",
  };
  return values.map((value) => labels[value] ?? value).join(", ");
}

function auditLabel(action: string, details: unknown) {
  const record =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  const providerName =
    typeof record.providerName === "string" ? record.providerName : "provider";

  switch (action) {
    case "CASE_CREATED":
      return "Case support opened";
    case "ACCESS_GRANTED":
      return `Access granted to ${providerName}`;
    case "ACCESS_REVOKED":
      return `Access removed for ${providerName}`;
    default:
      return "Case support updated";
  }
}
