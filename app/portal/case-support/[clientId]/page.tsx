import {
  createCaseSupportCase,
  createCaseSupportEntry,
  markCaseSupportEntryReviewed,
  resolveCaseSupportCase,
  updateCaseSupportAccess,
} from "@/app/actions/manageCaseSupport";
import { clientDisplayCode } from "@/app/libs/clientIdentity";
import {
  formatProviderDisplayName,
  formatStoredProviderDisplayName,
} from "@/app/libs/providerDisplayName";
import { ContextualHelp } from "@/components/ContextualHelp";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseSupportSuccessToast } from "./CaseSupportSuccessToast";
import { CaseSupportWorkspaceCarousel } from "./CaseSupportWorkspaceCarousel";
import workspaceStyles from "./CaseSupportWorkspaceCarousel.module.css";
import { ProviderCaseSupportCarousel } from "./ProviderCaseSupportCarousel";
import { ResolutionConfidenceControl } from "./ResolutionConfidenceControl";

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
  resolved?: string;
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
      revokedAt: null,
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
            where: { revokedAt: null },
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
  const supportCases = await db.caseSupportCase.findMany({
    where: {
      clientId,
      status: { in: ["OPEN", "RESOLVED", "ARCHIVED"] },
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

  const openSupportCase = supportCases.find(({ status }) => status === "OPEN");
  const supportCase = isSupervisor
    ? openSupportCase
    : openSupportCase ?? supportCases.find(({ status }) => status !== "OPEN");
  const resolvedCases = isSupervisor
    ? supportCases
        .filter(({ status }) => status !== "OPEN")
        .sort(
          (first, second) =>
            (second.resolvedAt ?? second.updatedAt).getTime() -
            (first.resolvedAt ?? first.updatedAt).getTime()
        )
    : [];
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
    ? formatProviderDisplayName(
        supportCase.ownerSupervisor.firstName,
        supportCase.ownerSupervisor.lastName
      )
    : "";
  const isOwner = supportCase?.ownerSupervisorId === session.providerId;
  const membership = supportCase?.members.find(
    ({ providerId }) => providerId === session.providerId
  );
  const canContribute = Boolean(
    isOwner || membership?.accessLevel === "CONTRIBUTOR"
  );
  const canAddUpdates = canContribute && supportCase?.status === "OPEN";
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
  const coordinations = (supportCase?.coordinations ??
    []) as CaseCoordinationView[];
  const caseActivity = [
    ...originalEntries.map((entry) => ({
      kind: "UPDATE" as const,
      occurredAt: entry.occurredAt,
      createdAt: entry.createdAt,
      entry,
    })),
    ...coordinations.map((coordination) => ({
      kind: "COORDINATION" as const,
      occurredAt: coordination.occurredAt,
      createdAt: coordination.createdAt,
      coordination,
    })),
  ].sort(
    (first, second) =>
      second.occurredAt.getTime() - first.occurredAt.getTime() ||
      second.createdAt.getTime() - first.createdAt.getTime()
  );
  const accessEvents =
    supportCase?.auditEvents.filter((event) =>
      ["CASE_CREATED", "ACCESS_GRANTED", "ACCESS_REVOKED"].includes(
        event.action
      )
    ) ?? [];
  const simplifiedEntryIds = simplifiedDocumentationEntryIds(
    supportCase?.auditEvents ?? []
  );
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
  const providerOriginatingRequest = !isSupervisor
    ? supportCase?.originatingRequests.find(
        ({ requesterId }) => requesterId === session.providerId
      ) ?? supportCase?.originatingRequests[0]
    : undefined;
  const providerResolutionEvent = !isSupervisor
    ? supportCase?.auditEvents.find(({ action }) => action === "CASE_RESOLVED")
    : undefined;
  const providerResolutionSummary = auditDetailString(
    providerResolutionEvent?.details,
    "resolutionSummary"
  );
  const providerResolutionConfidence = auditDetailString(
    providerResolutionEvent?.details,
    "resolutionConfidence"
  );
  const providerCaseActivity = !isSupervisor && supportCase
    ? [
        ...supportCase.originatingRequests.map((request) => ({
          kind: "REQUEST" as const,
          occurredAt: request.occurredAt ?? request.createdAt,
          createdAt: request.createdAt,
          request,
        })),
        ...originalEntries.map((entry) => ({
          kind: "UPDATE" as const,
          occurredAt: entry.occurredAt,
          createdAt: entry.createdAt,
          entry,
        })),
        ...coordinations.map((coordination) => ({
          kind: "COORDINATION" as const,
          occurredAt: coordination.occurredAt,
          createdAt: coordination.createdAt,
          coordination,
        })),
        ...(providerResolutionEvent
          ? [
              {
                kind: "RESOLUTION" as const,
                occurredAt:
                  supportCase.resolvedAt ?? providerResolutionEvent.createdAt,
                createdAt: providerResolutionEvent.createdAt,
                event: providerResolutionEvent,
              },
            ]
          : []),
      ].sort(
        (first, second) =>
          first.occurredAt.getTime() - second.occurredAt.getTime() ||
          first.createdAt.getTime() - second.createdAt.getTime()
      )
    : [];
  const successMessage =
    query.created === "1"
      ? "Case Support created."
      : query.saved === "1"
        ? isSupervisor
          ? "Documentation saved."
          : "Update saved."
        : query.coordinationSaved === "1"
          ? "Coordination saved."
          : query.accessUpdated === "1"
            ? "Access updated."
            : query.requestOpened === "1"
              ? "Request opened as Case Support."
              : query.reviewed === "1"
                ? "Documentation marked as reviewed."
                : query.resolved === "1"
                  ? "Case resolved and moved to history."
                  : null;
  const resolvedCasesCard = (
    <section className="paper-surface case-support-card">
      <h2 className="case-support-section-title">Resolved Cases</h2>

      {resolvedCases.length === 0 ? (
        <div className="case-support-empty">No resolved cases yet.</div>
      ) : (
        <div className={workspaceStyles.historyList}>
          {resolvedCases.map((resolvedCase) => {
            const resolvedEntries = resolvedCase.entries.filter(
              ({ amendsEntryId }) => !amendsEntryId
            );
            const resolutionEvent = resolvedCase.auditEvents.find(
              ({ action }) => action === "CASE_RESOLVED"
            );
            const resolutionSummary = auditDetailString(
              resolutionEvent?.details,
              "resolutionSummary"
            );
            const resolutionConfidence = auditDetailString(
              resolutionEvent?.details,
              "resolutionConfidence"
            );
            const resolvedOwnerName =
              formatProviderDisplayName(
                resolvedCase.ownerSupervisor.firstName,
                resolvedCase.ownerSupervisor.lastName
              );
            const resolvedSimplifiedEntryIds =
              simplifiedDocumentationEntryIds(resolvedCase.auditEvents);

            return (
              <details
                key={resolvedCase.id}
                className="paper-surface case-support-case-group case-support-case-group--resolved"
              >
                <summary className="case-support-case-group-summary">
                  <div>
                    <h3 className="case-support-case-title">
                      {resolvedCase.title}
                    </h3>
                    <div className="case-support-request-meta case-support-case-group-date">
                      {(resolvedCase.resolvedAt ?? resolvedCase.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </summary>
                <div className="case-support-case-group-body case-support-stack">
                  <section className="case-support-card">
                    <CaseReadSection
                      label="Support concern"
                      value={resolvedCase.concern}
                    />
                    <CaseReadSection
                      label="Desired outcome"
                      value={resolvedCase.desiredOutcome}
                    />
                    {resolutionSummary ? (
                      <CaseReadSection
                        label="Resolution summary"
                        value={resolutionSummary}
                      />
                    ) : null}
                    {resolutionConfidence ? (
                      <CaseReadSection
                        label="Resolution confidence"
                        value={resolutionConfidenceLabel(
                          resolutionConfidence
                        )}
                      />
                    ) : null}
                    {resolvedCase.originatingRequests.length > 0 ? (
                      <details className="case-support-origin-request">
                        <summary>Original provider request</summary>
                        <div className="case-support-request-summary">
                          {resolvedCase.originatingRequests.map((request) => (
                            <div key={request.id}>
                              {request.title ? (
                                <CaseReadSection
                                  label="Request title"
                                  value={request.title}
                                />
                              ) : null}
                              <strong>
                                {formatProviderDisplayName(
                                  request.requester.firstName,
                                  request.requester.lastName
                                )}
                              </strong>
                              {request.occurredAt ? (
                                <div className="case-support-request-meta">
                                  Event {request.occurredAt.toLocaleString()}
                                </div>
                              ) : null}
                              <p>{request.concern}</p>
                              <strong>Requested support</strong>
                              <p>{request.requestedSupport}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </section>

                  <details className="case-support-history-section">
                    <summary>Documentation ({resolvedEntries.length})</summary>
                    <div className="case-support-history-section-body case-support-timeline">
                      {resolvedEntries.length === 0 ? (
                        <div className="case-support-compact-empty">
                          No documentation was added.
                        </div>
                      ) : (
                        resolvedEntries.map((entry) => (
                          <CaseEntry
                            key={entry.id}
                            entry={entry}
                            clarifications={resolvedCase.entries.filter(
                              ({ amendsEntryId }) => amendsEntryId === entry.id
                            )}
                            clientId={clientId}
                            canClarify={false}
                            caseId={resolvedCase.id}
                            canReview={false}
                            defaultOpen={false}
                            activityLabel="UPDATE"
                            hideLegacyCompatibilityFacts={resolvedSimplifiedEntryIds.has(
                              entry.id
                            )}
                          />
                        ))
                      )}
                    </div>
                  </details>

                  <details className="case-support-history-section">
                    <summary>
                      Coordination ({resolvedCase.coordinations.length})
                    </summary>
                    <div className="case-support-history-section-body case-support-timeline">
                      {resolvedCase.coordinations.length === 0 ? (
                        <div className="case-support-compact-empty">
                          No coordination was recorded.
                        </div>
                      ) : (
                        resolvedCase.coordinations.map((coordination) => (
                          <CoordinationEntry
                            key={coordination.id}
                            coordination={coordination}
                          />
                        ))
                      )}
                    </div>
                  </details>

                  <details className="case-support-history-section">
                    <summary>
                      People and access ({resolvedCase.members.length + 1})
                    </summary>
                    <div className="case-support-history-section-body">
                      <AccessPerson
                        name={resolvedOwnerName}
                        role="Supervisor · Owner"
                      />
                      {resolvedCase.members.map(({ id, provider }) => (
                        <AccessPerson
                          key={id}
                          name={formatProviderDisplayName(
                            provider.firstName,
                            provider.lastName
                          )}
                          role={roleLabel(provider.role)}
                        />
                      ))}
                    </div>
                  </details>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
  const initialWorkspaceCard =
    query.resolved === "1"
      ? 4
      : query.saved === "1" || query.reviewed === "1"
        ? 0
        : query.accessUpdated === "1"
          ? 2
          : query.compose === "1" || Boolean(clarificationTarget)
            ? 1
            : 0;
  const initialProviderCard =
    canAddUpdates &&
    (query.compose === "1" || Boolean(clarificationTarget))
      ? 1
      : 0;

  return (
    <main className="case-support-page">
      {successMessage ? (
        <CaseSupportSuccessToast message={successMessage} />
      ) : null}
      <Link
        href={`/dashboard?clientId=${clientId}&view=orbit`}
        className="back-link"
      >
        Back
      </Link>

      <header className="case-support-heading">
        {isSupervisor ? (
          <>
            <div style={{ fontSize: 15, opacity: 0.62 }}>{initials}</div>
            <div className="case-support-title-with-help">
              <h1>Case Support</h1>
              <ContextualHelp
                title="About Case Support"
                explanation="This is a restricted agency support record. Access is granted explicitly, and every access change is preserved."
              />
            </div>
          </>
        ) : (
          <h1>Case Support</h1>
        )}
      </header>

      {latestProviderRequest && !supportCase ? (
        <ProviderRequestUpdate request={latestProviderRequest} />
      ) : null}

      {!supportCase && isSupervisor && resolvedCases.length > 0 ? (
        resolvedCasesCard
      ) : !supportCase && !hasAgencyAssignment ? (
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
      ) : isSupervisor ? (
        <CaseSupportWorkspaceCarousel initialCard={initialWorkspaceCard}>
          <section className="paper-surface case-support-card">
            <h2 className="case-support-section-title">Case Overview</h2>
            <h3 className="case-support-case-title">{supportCase.title}</h3>
            <CaseReadSection
              label="Support concern"
              value={supportCase.concern}
            />
            <CaseReadSection
              label="Desired outcome"
              value={supportCase.desiredOutcome}
            />
            {supportCase.originatingRequests.length > 0 ? (
              <details className="case-support-origin-request">
                <summary>Original provider request</summary>
                <div className="case-support-request-summary">
                  {supportCase.originatingRequests.map((request) => (
                    <div key={request.id}>
                      {request.title ? (
                        <CaseReadSection
                          label="Request title"
                          value={request.title}
                        />
                      ) : null}
                      <strong>
                        {formatProviderDisplayName(
                          request.requester.firstName,
                          request.requester.lastName
                        )}
                      </strong>
                      <div className="case-support-request-meta">
                        {roleLabel(request.requester.role)} · Submitted{" "}
                        {request.createdAt.toLocaleString()}
                      </div>
                      {request.occurredAt ? (
                        <div className="case-support-request-meta">
                          Event {request.occurredAt.toLocaleString()}
                        </div>
                      ) : (
                        <div className="case-support-request-meta">
                          Event time was not captured for this legacy request.
                        </div>
                      )}
                      <CaseReadSection
                        label="Support concern"
                        value={request.concern}
                      />
                      <CaseReadSection
                        label="Requested support"
                        value={request.requestedSupport}
                      />
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            {caseActivity.length === 0 ? (
              <p className={workspaceStyles.activityEmpty}>No updates yet.</p>
            ) : (
              <details
                className={workspaceStyles.activity}
                open={query.saved === "1" || query.reviewed === "1"}
              >
                <summary className={workspaceStyles.activitySummary}>
                  <span>Case activity</span>
                  <span
                    className={workspaceStyles.historyCount}
                    aria-label={`${caseActivity.length} case activit${caseActivity.length === 1 ? "y" : "ies"}`}
                  >
                    {caseActivity.length}
                  </span>
                </summary>
                <div className={workspaceStyles.activityList}>
                  {caseActivity.map((activity) =>
                    activity.kind === "UPDATE" ? (
                      <CaseEntry
                        key={`update-${activity.entry.id}`}
                        entry={activity.entry}
                        clarifications={entries.filter(
                          ({ amendsEntryId }) =>
                            amendsEntryId === activity.entry.id
                        )}
                        clientId={clientId}
                        canClarify={
                          activity.entry.authorId === session.providerId
                        }
                        caseId={supportCase.id}
                        canReview={Boolean(isOwner)}
                        reviewEvent={reviewByEntryId.get(activity.entry.id)}
                        activityLabel="UPDATE"
                        hideLegacyCompatibilityFacts={simplifiedEntryIds.has(
                          activity.entry.id
                        )}
                      />
                    ) : (
                      <CoordinationEntry
                        key={`coordination-${activity.coordination.id}`}
                        coordination={activity.coordination}
                        activityLabel="COORDINATION"
                      />
                    )
                  )}
                </div>
              </details>
            )}
          </section>

          {canContribute ? (
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
                isSupervisor
              />
            )
          ) : (
            <section className="paper-surface case-support-card">
              <h2 className="case-support-section-title">
                Add Update
              </h2>
              <p className="case-support-request-copy">
                Contributor access is required to add documentation.
              </p>
            </section>
          )}

          <section className="paper-surface case-support-card">
            <div className="case-support-title-with-help">
              <h2 className="case-support-section-title">Case Access</h2>
              <ContextualHelp
                title="About case access"
                explanation="Only the case owner and explicitly listed providers can open this record."
              />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <AccessPerson name={ownerName} role="Supervisor · Owner" />
              {supportCase.members.map(({ id, accessLevel, provider }) => (
                <AccessPerson
                  key={id}
                  name={formatProviderDisplayName(
                    provider.firstName,
                    provider.lastName
                  )}
                  role={`${roleLabel(provider.role)} · ${accessLevelLabel(accessLevel)}`}
                />
              ))}
            </div>
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
            ) : null}
            <details className="case-support-origin-request">
              <summary>Access History</summary>
              <div className="case-support-details-body">
                <div style={{ display: "grid", gap: 12 }}>
                  {accessEvents.map((event) => (
                    <div className="case-support-audit-event" key={event.id}>
                      <div>{auditLabel(event.action, event.details)}</div>
                      <div style={{ fontSize: 13, opacity: 0.6 }}>
                        {formatProviderDisplayName(
                          event.actor.firstName,
                          event.actor.lastName
                        )} ·{" "}
                        {event.createdAt.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </section>

          <section className="paper-surface case-support-card">
            <div className="case-support-title-with-help">
              <h2 className="case-support-section-title">Resolve Case</h2>
              <ContextualHelp
                title="About resolution confidence"
                explanation="This records the supervisor’s certainty at closure. It does not score the client or evaluate the provider."
              />
            </div>
            {isOwner ? (
              <form
                action={resolveCaseSupportCase}
                className="case-support-resolution-form"
              >
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="caseId" value={supportCase.id} />
                <ResolutionConfidenceControl />
                <CaseTextArea
                  label="Resolution summary"
                  name="resolutionSummary"
                  hint="Summarize the outcome and any remaining follow-up."
                  compact
                />
                <div className="case-support-primary-action">
                  <button
                    type="submit"
                    className="material-control action-secondary"
                  >
                    Mark Case Resolved
                  </button>
                </div>
              </form>
            ) : (
              <p className="case-support-request-copy">
                Only the current case owner can resolve this case.
              </p>
            )}
          </section>

          {resolvedCasesCard}
        </CaseSupportWorkspaceCarousel>
      ) : (
        <ProviderCaseSupportCarousel initialCard={initialProviderCard}>
          <section className="paper-surface case-support-card">
            <h2 className="case-support-section-title">Case Overview</h2>
            <h3 className="case-support-case-title">{supportCase.title}</h3>
            <div className="case-support-facts-grid">
              <CaseFact
                label="Status"
                value={caseStatusLabel(supportCase.status)}
              />
              <CaseFact
                label="Date opened"
                value={supportCase.createdAt.toLocaleString()}
              />
              <CaseFact label="Supervisor" value={ownerName} />
              {providerOriginatingRequest?.occurredAt ? (
                <CaseFact
                  label="Event date and time"
                  value={providerOriginatingRequest.occurredAt.toLocaleString()}
                />
              ) : null}
            </div>
            <CaseReadSection
              label="Support concern"
              value={
                providerOriginatingRequest?.concern ?? supportCase.concern
              }
            />
            <CaseReadSection
              label="Desired outcome"
              value={
                providerOriginatingRequest?.requestedSupport ??
                supportCase.desiredOutcome
              }
            />
            {supportCase.status !== "OPEN" && providerResolutionConfidence ? (
              <CaseReadSection
                label="Resolution confidence"
                value={resolutionConfidenceLabel(
                  providerResolutionConfidence
                )}
              />
            ) : null}
            {supportCase.status !== "OPEN" && providerResolutionSummary ? (
              <CaseReadSection
                label="Resolution summary"
                value={providerResolutionSummary}
              />
            ) : null}

            {providerCaseActivity.length === 0 ? (
              <p className={workspaceStyles.activityEmpty}>No updates yet.</p>
            ) : (
              <details
                className={workspaceStyles.activity}
                open={query.saved === "1"}
              >
                <summary className={workspaceStyles.activitySummary}>
                  <span>Case activity</span>
                  <span
                    className={workspaceStyles.historyCount}
                    aria-label={`${providerCaseActivity.length} case activit${providerCaseActivity.length === 1 ? "y" : "ies"}`}
                  >
                    {providerCaseActivity.length}
                  </span>
                </summary>
                <div className={workspaceStyles.activityList}>
                  {providerCaseActivity.map((activity) => {
                    if (activity.kind === "REQUEST") {
                      const requesterName =
                        formatProviderDisplayName(
                          activity.request.requester.firstName,
                          activity.request.requester.lastName
                        );
                      return (
                        <article
                          key={`request-${activity.request.id}`}
                          className="case-support-entry case-support-stack"
                        >
                          <div className="case-support-eyebrow">REQUEST</div>
                          <h3>
                            {activity.request.title?.trim() ||
                              "Original provider request"}
                          </h3>
                          <div className="case-support-entry-meta">
                            {requesterName} ·{" "}
                            {activity.occurredAt.toLocaleString()}
                          </div>
                          <CaseReadSection
                            label="Support concern"
                            value={activity.request.concern}
                          />
                          <CaseReadSection
                            label="Desired outcome"
                            value={activity.request.requestedSupport}
                          />
                        </article>
                      );
                    }
                    if (activity.kind === "UPDATE") {
                      return (
                        <CaseEntry
                          key={`update-${activity.entry.id}`}
                          entry={activity.entry}
                          clarifications={entries.filter(
                            ({ amendsEntryId }) =>
                              amendsEntryId === activity.entry.id
                          )}
                          clientId={clientId}
                          canClarify={
                            canAddUpdates &&
                            activity.entry.authorId === session.providerId
                          }
                          caseId={supportCase.id}
                          canReview={false}
                          reviewEvent={reviewByEntryId.get(activity.entry.id)}
                          defaultOpen={false}
                          activityLabel="UPDATE"
                          hideLegacyCompatibilityFacts
                        />
                      );
                    }
                    if (activity.kind === "COORDINATION") {
                      return (
                        <CoordinationEntry
                          key={`coordination-${activity.coordination.id}`}
                          coordination={activity.coordination}
                          activityLabel="COORDINATION"
                        />
                      );
                    }
                    return (
                      <article
                        key={`resolution-${activity.createdAt.toISOString()}`}
                        className="case-support-entry case-support-stack"
                      >
                        <div className="case-support-eyebrow">RESOLUTION</div>
                        <h3>Case resolved</h3>
                        <div className="case-support-entry-meta">
                          {activity.occurredAt.toLocaleString()}
                        </div>
                        {providerResolutionConfidence ? (
                          <CaseReadSection
                            label="Resolution confidence"
                            value={resolutionConfidenceLabel(
                              providerResolutionConfidence
                            )}
                          />
                        ) : null}
                        {providerResolutionSummary ? (
                          <CaseReadSection
                            label="Resolution summary"
                            value={providerResolutionSummary}
                          />
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </details>
            )}
          </section>

          {canAddUpdates ? (
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
                isSupervisor={false}
                simplifiedProvider
              />
            )
          ) : null}
        </ProviderCaseSupportCarousel>
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
    formatProviderDisplayName(
      request.recipientSupervisor.firstName,
      request.recipientSupervisor.lastName
    );
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

function CoordinationEntry({
  coordination,
  activityLabel,
}: {
  coordination: CaseCoordinationView;
  activityLabel?: string;
}) {
  const isExternal = coordination.path === "EXTERNAL";
  const authorName =
    formatProviderDisplayName(
      coordination.author.firstName,
      coordination.author.lastName
    );
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
            {activityLabel ??
              (isExternal ? "EXTERNAL FOLLOW-UP" : "INTERNAL COORDINATION")}
          </div>
          <h3>
            {activityLabel
              ? `${isExternal ? "External follow-up" : "Internal coordination"} · ${coordinationStatusLabel(coordination.status)}`
              : coordinationStatusLabel(coordination.status)}
          </h3>
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
  simplifiedProvider = false,
  submitLabel = "Add to timeline",
}: {
  clientId: string;
  caseId: string;
  isSupervisor: boolean;
  simplifiedProvider?: boolean;
  submitLabel?: string;
}) {
  if (isSupervisor || simplifiedProvider) {
    return (
      <form
        action={createCaseSupportEntry}
        className="paper-surface case-support-card"
      >
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="caseId" value={caseId} />
        {simplifiedProvider ? (
          <input
            type="hidden"
            name="documentationMode"
            value="SIMPLIFIED"
          />
        ) : null}
        <h2 className="case-support-section-title">Add Update</h2>

        <div className="case-support-form-grid">
          <CaseInput
            label="Date and time"
            name="occurredAt"
            type="datetime-local"
            defaultValue={localDateTimeValue(new Date())}
            required
          />
          <CaseSelect
            label={isSupervisor ? "Source" : "Initiated by"}
            name="requestSource"
            options={[
              ["", "Select one"],
              ["SELF_INITIATED", "Provider"],
              ["CLASSROOM_STAFF", "Classroom staff"],
              [
                "SCHOOL_ADMINISTRATION",
                isSupervisor ? "School administration" : "School administrator",
              ],
              ["AGENCY_SUPERVISOR", "Agency supervisor"],
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
          label="Outcome observed"
          name="observableOutcome"
          hint="Record what changed, remained the same, or was not observed."
          required
        />

        <FormActions clientId={clientId} submitLabel="Save Update" />
      </form>
    );
  }

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

      <FormActions clientId={clientId} submitLabel={submitLabel} />
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
  defaultOpen,
  activityLabel,
  hideLegacyCompatibilityFacts = false,
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
  defaultOpen?: boolean;
  activityLabel?: string;
  hideLegacyCompatibilityFacts?: boolean;
}) {
  const authorName =
    formatProviderDisplayName(entry.author.firstName, entry.author.lastName);
  const latestActivityAt = clarifications.reduce(
    (latest, clarification) =>
      clarification.createdAt > latest ? clarification.createdAt : latest,
    entry.createdAt
  );
  const isReviewed = Boolean(
    reviewEvent && reviewEvent.createdAt >= latestActivityAt
  );
  const reviewerName = reviewEvent
    ? formatProviderDisplayName(
        reviewEvent.actor.firstName,
        reviewEvent.actor.lastName
      )
    : "";

  return (
    <details
      className={`case-support-entry${isReviewed ? " is-reviewed" : ""}`}
      open={defaultOpen ?? !isReviewed}
    >
      <summary className="case-support-entry-summary">
        <div>
          <div className="case-support-eyebrow">
            {activityLabel ?? entryTypeLabel(entry.entryType)}
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
          value={requestSourceLabel(
            entry.requestSource,
            hideLegacyCompatibilityFacts
          )}
        />
        {!hideLegacyCompatibilityFacts ? (
          <CaseFact
            label="Assigned client coverage"
            value={coverageLabel(entry.coverageStatus)}
          />
        ) : null}
        {entry.requestedBy ? (
          <CaseFact label="Requested by" value={entry.requestedBy} />
        ) : null}
        {entry.durationMinutes ? (
          <CaseFact
            label="Approximate duration"
            value={`${entry.durationMinutes} minutes`}
          />
        ) : null}
        {!hideLegacyCompatibilityFacts ? (
          <CaseFact
            label="Schedule impact"
            value={scheduleImpactLabel(entry.scheduleImpacts)}
          />
        ) : null}
        </div>

      <CaseReadSection label="What occurred" value={entry.whatOccurred} />
      <CaseReadSection
        label="Support provided"
        value={entry.supportProvided}
      />
      <CaseReadSection
        label={
          hideLegacyCompatibilityFacts
            ? "Outcome observed"
            : "Observable outcome"
        }
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
          <div key={providerId} className="case-support-provider-access-row">
            <span className="case-support-provider-identity">
              <strong>
                {formatProviderDisplayName(
                  provider.firstName,
                  provider.lastName
                )}
              </strong>
              <small>{roleLabel(role)}</small>
            </span>
            <label className="case-support-provider-access-control">
              <input
                type="checkbox"
                name="providerIds"
                value={providerId}
                defaultChecked={selectedProviderIds.has(providerId)}
              />
              <span>Case access</span>
            </label>
          </div>
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

function accessLevelLabel(accessLevel: string) {
  return accessLevel === "VIEWER" ? "Viewer" : "Contributor";
}

function caseStatusLabel(status: string) {
  return status === "OPEN"
    ? "Open"
    : status === "ARCHIVED"
      ? "Archived"
      : "Resolved";
}

function entryTypeLabel(entryType: string) {
  return entryType === "SUPERVISOR_COORDINATION"
    ? "COORDINATION UPDATE"
    : "PROVIDER ACCOUNT";
}

function requestSourceLabel(value: string, simplified = false) {
  const labels: Record<string, string> = {
    CLASSROOM_STAFF: "Classroom staff",
    SCHOOL_ADMINISTRATION: "School administration",
    AGENCY_SUPERVISOR: "Agency supervisor",
    SAFETY_NEED: "Immediate safety need",
    SELF_INITIATED: "Provider noticed a need",
    OTHER: "Other",
    UNCLEAR: "Unclear",
  };
  return simplified && value === "SELF_INITIATED"
    ? "Provider"
    : (labels[value] ?? value);
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

function resolutionConfidenceLabel(value: string) {
  const labels: Record<string, string> = {
    CONFIDENT: "Confident",
    UNSURE: "Unsure",
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

function simplifiedDocumentationEntryIds(
  events: Array<{ action: string; details: unknown }>
) {
  const entryIds = new Set<string>();

  for (const event of events) {
    if (
      event.action !== "DOCUMENTATION_ADDED" ||
      !event.details ||
      typeof event.details !== "object" ||
      Array.isArray(event.details)
    ) {
      continue;
    }
    const details = event.details as Record<string, unknown>;
    if (
      details.documentationMode === "SIMPLIFIED" &&
      typeof details.entryId === "string"
    ) {
      entryIds.add(details.entryId);
    }
  }

  return entryIds;
}

function auditLabel(action: string, details: unknown) {
  const record =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  const providerName =
    typeof record.providerName === "string"
      ? formatStoredProviderDisplayName(record.providerName)
      : "provider";

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

function auditDetailString(details: unknown, key: string) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}
