"use client";

import {
  assignClientProvider,
  cancelClientOrganizationInvitation,
  inviteClientOrganization,
  revokeClientOrganization,
  revokeClientProvider,
  searchEligibleClientProviders,
  searchOrganizationsForClient,
} from "@/app/actions/manageClientTeam";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import { formatAssignmentRole } from "@/app/libs/roles";
import Link from "next/link";
import CareTeamInfo from "./CareTeamInfo";
import ClientTeamActionForm from "./ClientTeamActionForm";
import styles from "./CareTeamPage.module.css";
import { ORGANIZATION_SEARCH_MIN_LENGTH } from "@/lib/clientTeamOrganizationSearch";
import { normalizeOrganizationSearchQuery } from "@/lib/clientTeamOrganizationSearch";
import { useRef, useState, type FormEvent } from "react";

type Relationship = {
  id: string;
  role: string;
  status: string;
  requestedAt: Date;
  revokedAt: Date | null;
  revocationReason: string | null;
  organization: { id: string; name: string; type: string };
};

type ProviderOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  organization: { id: string; name: string; type: string };
};

type Assignment = {
  id: string;
  role: string;
  provider: { firstName: string; lastName: string };
  organization: { id: string; name: string; type: string } | null;
};

export default function ClientTeamPanel({
  clientId,
  relationships,
  organizationQuery,
  organizationSearchSubmitted,
  organizationSearchTooShort,
  organizationResults,
  providerQuery,
  providerOptions,
  assignments,
  pendingStaffInvitations = [],
  mode = "all",
}: {
  clientId: string;
  caseCode: string;
  relationships: Relationship[];
  organizationQuery: string;
  organizationSearchSubmitted: boolean;
  organizationSearchTooShort: boolean;
  organizationResults: Array<{ id: string; name: string; type: string }>;
  providerQuery: string;
  providerOptions: ProviderOption[];
  assignments: Assignment[];
  pendingStaffInvitations?: Array<{ id: string; email: string; providerRole: string; organization: { name: string } }>;
  mode?: "all" | "organizations" | "providers";
}) {
  const [organizationInput, setOrganizationInput] = useState(organizationQuery);
  const [organizationMatches, setOrganizationMatches] = useState(organizationResults);
  const [organizationState, setOrganizationState] = useState<
    "idle" | "loading" | "too-short" | "results" | "empty" | "error"
  >(organizationSearchTooShort ? "too-short" : organizationResults.length ? "results" : organizationSearchSubmitted ? "empty" : "idle");
  const [providerInput, setProviderInput] = useState(providerQuery);
  const [providerMatches, setProviderMatches] = useState(providerOptions);
  const [providerState, setProviderState] = useState<
    "idle" | "loading" | "too-short" | "results" | "empty" | "error"
  >(providerOptions.length ? "results" : "idle");
  const organizationSearchPending = useRef(false);
  const providerSearchPending = useRef(false);
  const organizationInputRef = useRef<HTMLInputElement>(null);
  const providerInputRef = useRef<HTMLInputElement>(null);

  const runOrganizationSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (organizationSearchPending.current) return;
    const query = normalizeOrganizationSearchQuery(organizationInput);
    setOrganizationInput(query);
    if (query.length < ORGANIZATION_SEARCH_MIN_LENGTH) {
      setOrganizationMatches([]);
      setOrganizationState("too-short");
      organizationInputRef.current?.focus();
      return;
    }
    organizationSearchPending.current = true;
    setOrganizationState("loading");
    try {
      const results = await searchOrganizationsForClient(clientId, query);
      setOrganizationMatches(results);
      setOrganizationState(results.length ? "results" : "empty");
    } catch {
      setOrganizationMatches([]);
      setOrganizationState("error");
    } finally {
      organizationSearchPending.current = false;
      organizationInputRef.current?.focus();
    }
  };

  const runProviderSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (providerSearchPending.current) return;
    const query = providerInput.trim().replace(/\s+/g, " ");
    setProviderInput(query);
    if (query.length === 1) {
      setProviderMatches([]);
      setProviderState("too-short");
      providerInputRef.current?.focus();
      return;
    }
    providerSearchPending.current = true;
    setProviderState("loading");
    try {
      const activeOrganizations = relationships.filter(
        ({ status, revokedAt }) => status === "ACTIVE" && revokedAt === null
      );
      const results = (
        await Promise.all(
          activeOrganizations.map(async ({ organization }) =>
            (await searchEligibleClientProviders(clientId, organization.id, query)).map(
              (provider) => ({ ...provider, organization })
            )
          )
        )
      ).flat();
      setProviderMatches(results);
      setProviderState(results.length ? "results" : "empty");
    } catch {
      setProviderMatches([]);
      setProviderState("error");
    } finally {
      providerSearchPending.current = false;
      providerInputRef.current?.focus();
    }
  };
  const lead = relationships.find(
    (relationship) =>
      relationship.role === "LEAD" &&
      relationship.status === "ACTIVE" &&
      relationship.revokedAt === null
  );
  const participating = relationships.filter(
    (relationship) => relationship.role === "PARTICIPATING"
  );
  const groupedProviders = groupBy(
    providerMatches,
    (provider) => `${provider.organization.id}:${provider.role}`
  );
  const groupedAssignments = groupBy(
    assignments,
    (assignment) => assignment.organization?.id ?? "legacy"
  );
  const hasActiveOrganizations = relationships.some(
    (relationship) => relationship.status === "ACTIVE" && !relationship.revokedAt
  );
  const pendingOrganizations = participating.filter(
    (relationship) => relationship.status === "PENDING" && !relationship.revokedAt
  );

  return (
    <div className={styles.panel}>
      {mode !== "providers" ? (
      <section className={styles.panelSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionStep}>Organizations</p>
            <div className={styles.headingTitleRow}>
              <h2>Client organizations</h2>
              <CareTeamInfo label="About organization access">
                Organization membership alone does not grant Client access.
              </CareTeamInfo>
            </div>
          </div>
        </div>

        <div className={styles.relationshipList}>
          {lead ? (
            <div className={styles.row}>
              <div>
                <strong>{lead.organization.name}</strong>
                <div className="form-helper-text">
                  Lead · {organizationTypeLabel(lead.organization.type)}
                </div>
              </div>
              <div className={styles.actionRow}>
                <span className={styles.statusBadge}>Lead</span>
                <span className={`${styles.statusBadge} ${styles.active}`}>Active</span>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState} role="alert">
              <h3>Lead organization unavailable</h3>
              <p>Client-team changes remain unavailable until a lead is restored.</p>
            </div>
          )}

          {participating.map((relationship) => (
            <div key={relationship.id} className={styles.row}>
              <div>
                <div className={styles.cardTitleRow}>
                  <strong>{relationship.organization.name}</strong>
                  <span className={`${styles.statusBadge} ${statusClass(relationship)}`}>
                    {relationshipLabel(relationship)}
                  </span>
                </div>
                <div className="form-helper-text">
                  Participating · {organizationTypeLabel(relationship.organization.type)}
                </div>
              </div>
              {relationship.status === "PENDING" && !relationship.revokedAt ? (
                <ClientTeamActionForm
                  action={cancelClientOrganizationInvitation}
                  fields={{ clientId, relationshipId: relationship.id }}
                  label="Cancel invitation"
                  pendingLabel="Cancelling…"
                  confirmation="Cancel this organization invitation?"
                  successMessage="Invitation cancelled."
                />
              ) : relationship.status === "ACTIVE" && !relationship.revokedAt ? (
                <ClientTeamActionForm
                  action={revokeClientOrganization}
                  fields={{ clientId, relationshipId: relationship.id }}
                  label="Revoke organization"
                  pendingLabel="Revoking…"
                  confirmation="Revoke this participating organization and its active Client assignments?"
                  successMessage="Organization access revoked."
                  className="material-control action-negative"
                />
              ) : null}
            </div>
          ))}
        </div>

        <div
          id="invite-organization"
          className={styles.subsection}
          tabIndex={-1}
        >
          <div className={styles.headingTitleRow}>
            <h3>Invite organization</h3>
            <CareTeamInfo label="About inviting organizations">
              Invite an organization to participate in this Client&apos;s care team.
            </CareTeamInfo>
          </div>
          <form
            onSubmit={runOrganizationSearch}
            className={styles.searchBlock}
            noValidate
          >
            <label htmlFor="organization-search" className={styles.visuallyHidden}>
              Organization name
            </label>
            <div className={styles.searchForm}>
              <input
                ref={organizationInputRef}
                type="search"
                id="organization-search"
                name="organizationQuery"
                value={organizationInput}
                onChange={(event) => setOrganizationInput(event.target.value)}
                placeholder="Search organizations"
                minLength={ORGANIZATION_SEARCH_MIN_LENGTH}
                aria-describedby={
                  organizationState === "too-short"
                    ? "organization-search-validation"
                    : undefined
                }
              />
              <button type="submit" className="material-control action-secondary" disabled={organizationState === "loading"}>
                {organizationState === "loading" ? "Searching…" : "Search"}
              </button>
            </div>
          </form>
          {organizationState === "too-short" ? (
            <div
              id="organization-search-validation"
              className={styles.emptyState}
              role="alert"
            >
              <h3>Enter at least {ORGANIZATION_SEARCH_MIN_LENGTH} characters</h3>
              <p>Search by part of the organization name.</p>
            </div>
          ) : organizationState === "error" ? (
            <div className={styles.emptyState} role="alert">
              <h3>Search unavailable</h3>
              <p>The organization search could not be completed. Try again.</p>
            </div>
          ) : organizationMatches.length ? (
            <div className={styles.resultList}>
              {organizationMatches.map((organization) => (
                <div key={organization.id} className={styles.resultRow}>
                  <div>
                    <strong>{organization.name}</strong>
                    <div className="form-helper-text">
                      {organizationTypeLabel(organization.type)}
                    </div>
                  </div>
                  <ClientTeamActionForm
                    action={inviteClientOrganization}
                    fields={{ clientId, organizationId: organization.id }}
                    label="Invite"
                    pendingLabel="Inviting…"
                    confirmation={`Invite ${organization.name} to participate in this Client's care team?`}
                    successMessage="Invitation sent."
                    className="material-control action-positive"
                  />
                </div>
              ))}
            </div>
          ) : organizationState === "empty" ? (
            <div className={styles.emptyState}>
              <h3>No eligible organizations found</h3>
              <p>Try a different organization name.</p>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {mode !== "organizations" ? (
      <>
      <section className={styles.panelSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionStep}>Current Care Team</p>
            <h2>Assigned providers</h2>
          </div>
        </div>

        {assignments.length ? (
          <div className={styles.teamGroups}>
            {[...groupedAssignments.entries()].map(([key, group]) => {
              const organization = group[0]?.organization;
              return (
                <div key={key} className={styles.group}>
                  <h3 className={styles.groupHeading}>
                    {organization
                      ? `${organization.name} · ${organizationTypeLabel(organization.type)}`
                      : "Legacy assignments"}
                  </h3>
                  {group.map((assignment) => (
                    <div key={assignment.id} className={styles.assignmentRow}>
                      <div className={styles.providerIdentity}>
                        <strong>
                          {formatProviderDisplayName(
                            assignment.provider.firstName,
                            assignment.provider.lastName
                          )}
                        </strong>
                        <div className={styles.providerMeta}>
                          <span>{formatAssignmentRole(assignment.role)}</span>
                          <span>
                            {organization?.name ?? "Legacy assignment"}
                          </span>
                          {organization ? (
                            <span>{organizationTypeLabel(organization.type)}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.actionRow}>
                        <span className={`${styles.statusBadge} ${styles.active}`}>
                          Active
                        </span>
                        <ClientTeamActionForm
                          action={revokeClientProvider}
                          fields={{ clientId, assignmentId: assignment.id }}
                          label="Remove"
                          pendingLabel="Removing…"
                          confirmation="Remove this provider from the active Client team? Historical records will remain."
                          successMessage="Provider removed."
                          className="material-control action-negative"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>No providers assigned</h3>
            <p>Assign an eligible provider from an active Client organization below.</p>
          </div>
        )}
      </section>

      <section className={styles.panelSection}>
        <div className={styles.sectionHeading}>
          <div className={styles.headingTitleRow}>
            <h2>Add a provider</h2>
            <CareTeamInfo label="About eligible providers">
              Eligible providers appear only from active Client organizations.
              Results are grouped by active organization and Provider role. Staff must accept organization membership before they can be assigned.
            </CareTeamInfo>
          </div>
        </div>
        <form onSubmit={runProviderSearch} className={styles.searchBlock} noValidate>
          <label htmlFor="provider-search" className={styles.visuallyHidden}>
            Provider name
          </label>
          <div className={styles.searchForm}>
            <input
              ref={providerInputRef}
              type="search"
              id="provider-search"
              name="providerQuery"
              value={providerInput}
              onChange={(event) => setProviderInput(event.target.value)}
              placeholder="Search providers"
            />
            <button type="submit" className="material-control action-secondary" disabled={providerState === "loading"}>
              {providerState === "loading" ? "Filtering…" : "Filter"}
            </button>
          </div>
        </form>

        {providerState === "too-short" ? (
          <div className={styles.emptyState} role="alert">
            <h3>Enter at least 2 characters</h3>
            <p>Search by part of the Provider&apos;s first or last name.</p>
          </div>
        ) : providerState === "error" ? (
          <div className={styles.emptyState} role="alert">
            <h3>Search unavailable</h3>
            <p>The Provider search could not be completed. Try again.</p>
          </div>
        ) : groupedProviders.size ? (
          <div className={styles.providerGroups}>
            {[...groupedProviders.entries()].map(([key, providers]) => {
              const first = providers[0];
              if (!first) return null;
              return (
                <div key={key} className={styles.group}>
                  <h3 className={styles.groupHeading}>
                    {first.organization.name} · {organizationTypeLabel(first.organization.type)} · {formatAssignmentRole(first.role)}
                  </h3>
                  {providers.map((provider) => (
                    <div key={`${provider.organization.id}:${provider.id}`} className={styles.resultRow}>
                      <div className={styles.providerIdentity}>
                        <strong>
                          {formatProviderDisplayName(provider.firstName, provider.lastName)}
                        </strong>
                        <div className={styles.providerMeta}>
                          <span>{formatAssignmentRole(provider.role)}</span>
                          <span>{provider.organization.name}</span>
                          <span>{organizationTypeLabel(provider.organization.type)}</span>
                        </div>
                      </div>
                      <ClientTeamActionForm
                        action={assignClientProvider}
                        fields={{
                          clientId,
                          organizationId: provider.organization.id,
                          providerId: provider.id,
                          role: provider.role,
                        }}
                        label="Assign"
                        pendingLabel="Assigning…"
                        confirmation="Assign this provider to the active Client team?"
                        successMessage="Provider assigned."
                        className="material-control action-positive"
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>{providerState === "idle" ? "No eligible members available yet" : "No eligible providers found"}</h3>
            <p>
              {hasActiveOrganizations
                ? "Check the name, active organization membership and any pending staff invitation."
                : "Providers appear only after an organization relationship becomes active."}
            </p>
          </div>
        )}

        {pendingStaffInvitations.length > 0 && <div className={styles.emptyState}>
          <h3>Awaiting organization membership</h3>
          <p>These invited staff cannot be assigned until they accept:</p>
          {pendingStaffInvitations.map(invitation => <p key={invitation.id} style={{ overflowWrap: "anywhere" }}>{invitation.email} · {formatAssignmentRole(invitation.providerRole)} · {invitation.organization.name} · Pending</p>)}
          <Link href="/portal/supervisor/invitations" className="soft-link">Manage Staff Invitations</Link>
        </div>}
        {pendingOrganizations.length ? (
          <p className={styles.helper} role="status">
            Providers from{" "}
            {pendingOrganizations
              .map(({ organization }) => organization.name)
              .join(", ")} remain unavailable until the organization invitation is
            approved.
          </p>
        ) : null}

      </section>
      </>
      ) : null}
    </div>
  );
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function organizationTypeLabel(type: string) {
  return ({ AGENCY: "Agency", SCHOOL: "School", DISTRICT: "District", INDEPENDENT: "Independent" }[type] ?? type);
}

function relationshipLabel(relationship: Relationship) {
  if (relationship.status === "PENDING" && !relationship.revokedAt) return "Pending";
  if (relationship.status === "ACTIVE" && !relationship.revokedAt) return "Active";
  if (relationship.revocationReason === "REJECTED_BY_ORGANIZATION") return "Rejected";
  if (relationship.revocationReason === "CANCELLED_BY_TEAM_MANAGER") return "Cancelled";
  return "Revoked";
}

function statusClass(relationship: Relationship) {
  if (relationship.status === "ACTIVE" && !relationship.revokedAt) return styles.active;
  if (relationship.status === "PENDING" && !relationship.revokedAt) return styles.pending;
  return styles.revoked;
}
