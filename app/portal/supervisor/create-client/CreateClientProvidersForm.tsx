"use client";

import { ContextualHelp } from "@/components/ContextualHelp";
import { formatAssignmentRole } from "@/app/libs/roles";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import { useMemo, useRef, useState } from "react";
import AdministrativeCarousel from "@/app/components/administrative/AdministrativeCarousel";
import AdministrativeSubmitButton from "@/app/components/administrative/AdministrativeSubmitButton";
import styles from "./CreateClientProvidersForm.module.css";

type ProviderRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationIds: string[];
};

type OrganizationRow = {
  id: string;
  name: string;
  type: "AGENCY" | "SCHOOL" | "DISTRICT" | "INDEPENDENT";
};

type Props = {
  onSubmit: (formData: FormData) => void | Promise<void>;
  providers: ProviderRow[];
  organizations: OrganizationRow[];
  roleOrder: string[];
};

export default function CreateClientProvidersForm({
  onSubmit,
  providers,
  organizations,
  roleOrder,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [receivesPrescribedMedication, setReceivesPrescribedMedication] =
    useState(false);
  const [organizationId, setOrganizationId] = useState(
    organizations.length === 1 ? organizations[0].id : ""
  );
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [agencyWarning, setAgencyWarning] = useState("");
  const organizationSelectRef = useRef<HTMLSelectElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProviderRow[]>();
    for (const role of roleOrder) {
      map.set(role, []);
    }
    for (const provider of providers) {
      if (!organizationId || !provider.organizationIds.includes(organizationId)) {
        continue;
      }
      if (!map.has(provider.role)) continue;
      map.get(provider.role)?.push(provider);
    }
    return map;
  }, [organizationId, providers, roleOrder]);

  const organizationTypeLabel = (type: OrganizationRow["type"]) => {
    if (type === "INDEPENDENT") return "Independent practice";
    return `${type[0]}${type.slice(1).toLowerCase()}`;
  };

  const toggleProvider = (providerId: string, checked: boolean) => {
    if (!checked) {
      setAgencyIds((agencyProviders) =>
        agencyProviders.filter((id) => id !== providerId)
      );
    }
    setSelectedIds((previous) => {
      if (checked) {
        if (previous.includes(providerId)) return previous;
        return [...previous, providerId];
      }
      return previous.filter((id) => id !== providerId);
    });
  };

  const selectedOrganization = organizations.find(({ id }) => id === organizationId);
  const selectedOrganizationLabel = selectedOrganization
    ? `${selectedOrganization.name} — ${organizationTypeLabel(selectedOrganization.type)}`
    : "Select organization";
  const selectedProviders = providers.filter(({ id }) => selectedSet.has(id));

  return (
    <form
      action={onSubmit}
      className="provider-assignment-form"
      onSubmit={(event) => {
        if (!organizationId) {
          event.preventDefault();
          setAgencyWarning(
            "Select the responsible organization before creating this client."
          );
          organizationSelectRef.current?.focus();
        }
      }}
    >
      <input
        type="hidden"
        name="receivesPrescribedMedication"
        value={receivesPrescribedMedication ? "true" : "false"}
      />
      {selectedIds.map((providerId) => (
        <input
          key={providerId}
          type="hidden"
          name="providerIds"
          value={providerId}
        />
      ))}
      {agencyIds.map((providerId) => (
        <input
          key={`agency-${providerId}`}
          type="hidden"
          name="agencyProviderIds"
          value={providerId}
        />
      ))}

      <AdministrativeCarousel
        ariaLabel="Add Client"
        cards={[
          {
            id: "client-details",
            label: "Client Details",
            content: (
              <div className="client-details-zone" style={{ display: "grid", gap: 16 }}>
            <label style={{ display: "grid", gap: 8, marginBottom: 4 }}>
              <span className="provider-assignment-heading">Client full name</span>
              <input
                name="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                style={{
                  padding: "10px 12px",
                }}
              />
            </label>

            <section style={{ display: "grid", gap: 10, marginBottom: 8 }}>
              <div className="provider-assignment-heading">
                Client Context
              </div>
              <fieldset
                style={{
                  border: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 8,
                }}
              >
                <legend style={{ padding: 0, marginBottom: 2 }}>
                  Does the client receive prescribed medication?
                </legend>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="radio"
                    name="medicationChoice"
                    checked={receivesPrescribedMedication}
                    onChange={() => setReceivesPrescribedMedication(true)}
                  />
                  <span>Yes</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="radio"
                    name="medicationChoice"
                    checked={!receivesPrescribedMedication}
                    onChange={() => setReceivesPrescribedMedication(false)}
                  />
                  <span>No</span>
                </label>
              </fieldset>
            </section>
              </div>
            ),
          },
          {
            id: "responsible-organization",
            label: "Responsible Organization",
            content: (
            <section style={{ display: "grid", gap: 8, marginBottom: 8 }}>
              <ContextualHelp
                label={
                  <span className="provider-assignment-heading">
                    Responsible organization
                  </span>
                }
                title="Responsible organization"
                explanation="Choose the approved agency, school, district, or independent practice responsible for this client. Only that organization's active providers can be assigned."
              />
              <div className={styles.organizationSelectField}>
                <select
                  ref={organizationSelectRef}
                  className={styles.organizationSelect}
                  name="organizationId"
                  aria-label="Responsible organization"
                  aria-invalid={agencyWarning ? "true" : undefined}
                  aria-describedby={
                    agencyWarning ? "create-client-agency-warning" : undefined
                  }
                  value={organizationId}
                  onChange={(event) => {
                    setOrganizationId(event.target.value);
                    setSelectedIds([]);
                    setAgencyIds([]);
                    if (event.target.value) setAgencyWarning("");
                  }}
                  required
                >
                  <option value="">Select organization</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} — {organizationTypeLabel(organization.type)}
                    </option>
                  ))}
                </select>
                <span
                  className={styles.organizationSelectDisplay}
                  aria-hidden="true"
                >
                  {selectedOrganizationLabel}
                </span>
              </div>
              {organizations.length === 0 ? (
                <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
                  No approved organization is available for this account.
                </div>
              ) : null}
              {agencyWarning ? (
                <div
                  id="create-client-agency-warning"
                  role="alert"
                  style={{
                    color: "rgb(145 43 43)",
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {agencyWarning}
                </div>
              ) : null}
            </section>
            ),
          },
          {
            id: "initial-providers",
            label: "Initial Providers",
            content: (
        <section className="provider-selection-zone" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
          {!organizationId ? <p className="form-helper-text">Select the responsible organization before choosing Providers.</p> : null}
          {roleOrder.map((role) => {
            const roleProviders = grouped.get(role) ?? [];
            if (roleProviders.length === 0) return null;

            return (
              <div key={role}>
                <div
                  className="provider-role-badge"
                  style={{
                    marginBottom: 10,
                  }}
                >
                  {formatAssignmentRole(role)}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {roleProviders.map((provider) => {
                    const isSelected = selectedSet.has(provider.id);

                    return (
                      <div key={provider.id} className="provider-option-row">
                        <label className="provider-option">
                          <input
                            type="checkbox"
                            className="provider-checkbox"
                            checked={isSelected}
                            onChange={(event) =>
                              toggleProvider(
                                provider.id,
                                event.target.checked
                              )
                            }
                          />
                          <span>
                            {formatProviderDisplayName(
                              provider.firstName,
                              provider.lastName
                            )}
                          </span>
                        </label>

                        {isSelected ? (
                          <label className="provider-agency-option">
                            <input
                              type="checkbox"
                              className="provider-checkbox"
                              checked={agencyIds.includes(provider.id)}
                              onChange={(event) =>
                                setAgencyIds((previous) =>
                                  event.target.checked
                                    ? [
                                        ...new Set([
                                          ...previous,
                                          provider.id,
                                        ]),
                                      ]
                                    : previous.filter(
                                        (id) => id !== provider.id
                                      )
                                )
                              }
                            />
                            <span>Agency</span>
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
            ),
          },
          {
            id: "review-create",
            label: "Review and Create",
            content: (
              <div style={{ display: "grid", gap: 16 }}>
                <p><strong>Client:</strong> {fullName || "Not entered"}</p>
                <p><strong>Prescribed medication:</strong> {receivesPrescribedMedication ? "Yes" : "No"}</p>
                <p><strong>Responsible organization:</strong> {selectedOrganization?.name ?? "Not selected"}</p>
                <div><strong>Initial Providers:</strong>{selectedProviders.length ? <ul>{selectedProviders.map((provider) => <li key={provider.id}>{formatProviderDisplayName(provider.firstName, provider.lastName)} — {formatAssignmentRole(provider.role)}</li>)}</ul> : <p className="form-helper-text">No initial Providers selected.</p>}</div>
                <AdministrativeSubmitButton pendingLabel="Creating…" disabled={organizations.length === 0 || !organizationId || !fullName.trim()}>Create Client</AdministrativeSubmitButton>
              </div>
            ),
          },
        ]}
      />
    </form>
  );
}
