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
import { AuthorizedAutocomplete } from "@/components/ui/AuthorizedAutocomplete";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import { formatAssignmentRole } from "@/app/libs/roles";
import Link from "next/link";
import CareTeamInfo from "./CareTeamInfo";
import ClientTeamActionForm from "./ClientTeamActionForm";
import styles from "./CareTeamPage.module.css";
import { useCallback, useState } from "react";

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
  assignments,
  pendingStaffInvitations = [],
  mode = "all",
}: {
  clientId: string;
  caseCode: string;
  relationships: Relationship[];
  assignments: Assignment[];
  pendingStaffInvitations?: Array<{ id: string; email: string; providerRole: string; organization: { name: string } }>;
  mode?: "all" | "organizations" | "providers";
}) {
  const [selectedOrganization, setSelectedOrganization] = useState<{ id: string; name: string; type: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null);
  const findOrganizations = useCallback(
    (query: string) => searchOrganizationsForClient(clientId, query),
    [clientId]
  );
  const findProviders = useCallback(
    (query: string) => searchEligibleClientProviders(clientId, query),
    [clientId]
  );
  const lead = relationships.find(
    (relationship) =>
      relationship.role === "LEAD" &&
      relationship.status === "ACTIVE" &&
      relationship.revokedAt === null
  );
  const participating = relationships.filter(
    (relationship) => relationship.role === "PARTICIPATING"
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
          <AuthorizedAutocomplete
            label="Organization name"
            placeholder="Search organizations"
            selected={selectedOrganization}
            onSelectionChange={setSelectedOrganization}
            search={findOrganizations}
            getKey={organizationKey}
            getLabel={organizationLabel}
            renderOption={(organization) => <><strong>{organization.name}</strong> — {organizationTypeLabel(organization.type)}</>}
            emptyMessage="No authorized organizations match this search."
          />
          {selectedOrganization ? <div className={styles.selectedAction}>
            <p><strong>Selected:</strong> {organizationLabel(selectedOrganization)}</p>
            <ClientTeamActionForm
              action={inviteClientOrganization}
              fields={{ clientId, organizationId: selectedOrganization.id }}
              label="Invite selected organization"
              pendingLabel="Inviting…"
              confirmation={`Invite ${selectedOrganization.name} to participate in this Client's care team?`}
              successMessage="Invitation sent."
              className="material-control action-positive"
            />
          </div> : null}
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
        {hasActiveOrganizations ? <>
          <AuthorizedAutocomplete
            label="Provider name"
            placeholder="Search providers"
            selected={selectedProvider}
            onSelectionChange={setSelectedProvider}
            search={findProviders}
            getKey={providerKey}
            getLabel={providerLabel}
            renderOption={(provider) => <><strong>{formatProviderDisplayName(provider.firstName, provider.lastName)}</strong> — {formatAssignmentRole(provider.role)} — {provider.organization.name}</>}
            emptyMessage="No eligible Providers match this search."
          />
          {selectedProvider ? <div className={styles.selectedAction}>
            <p><strong>Selected:</strong> {providerLabel(selectedProvider)}</p>
            <ClientTeamActionForm
              action={assignClientProvider}
              fields={{
                clientId,
                organizationId: selectedProvider.organization.id,
                providerId: selectedProvider.id,
              }}
              label="Assign selected Provider"
              pendingLabel="Assigning…"
              confirmation="Assign this Provider to the active Client team?"
              successMessage="Provider assigned."
              className="material-control action-positive"
            />
          </div> : null}
        </> : <div className={styles.emptyState}>
          <h3>No active Client organizations</h3>
          <p>Providers become searchable after an organization relationship becomes active.</p>
        </div>}

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

function organizationKey(organization: { id: string }) {
  return organization.id;
}

function organizationLabel(organization: { name: string; type: string }) {
  return `${organization.name} — ${organizationTypeLabel(organization.type)}`;
}

function providerKey(provider: ProviderOption) {
  return `${provider.organization.id}:${provider.id}`;
}

function providerLabel(provider: ProviderOption) {
  return `${formatProviderDisplayName(provider.firstName, provider.lastName)} — ${formatAssignmentRole(provider.role)} — ${provider.organization.name}`;
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
