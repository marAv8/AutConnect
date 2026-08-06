//app/portal/supervisor/edit-providers/[clientId]/EditClientProvidersForm.tsx
"use client";

import { ContextualHelp } from "@/components/ContextualHelp";
import { formatAssignmentRole } from "@/app/libs/roles";
import { useMemo, useRef, useState } from "react";

type ProviderRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type Props = {
  clientId: string;
  onSubmit: (formData: FormData) => void | Promise<void>;
  initialFullName: string;
  initialReceivesPrescribedMedication: boolean;
  providers: ProviderRow[];
  initiallyAssignedProviderIds: string[];
  initialAgencyName: string;
  initialAgencyProviderIds: string[];
  roleOrder: string[];
};

export default function EditClientProvidersForm({
  clientId,
  onSubmit,
  initialFullName,
  initialReceivesPrescribedMedication,
  providers,
  initiallyAssignedProviderIds,
  initialAgencyName,
  initialAgencyProviderIds,
  roleOrder,
}: Props) {
  const [fullName, setFullName] = useState(initialFullName);
  const [receivesPrescribedMedication, setReceivesPrescribedMedication] =
    useState(initialReceivesPrescribedMedication);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initiallyAssignedProviderIds
  );
  const [agencyName, setAgencyName] = useState(initialAgencyName);
  const [agencyIds, setAgencyIds] = useState<string[]>(
    initialAgencyProviderIds
  );
  const [agencyWarning, setAgencyWarning] = useState("");
  const agencyInputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProviderRow[]>();
    for (const role of roleOrder) {
      map.set(role, []);
    }
    for (const provider of providers) {
      if (!map.has(provider.role)) continue;
      map.get(provider.role)?.push(provider);
    }
    return map;
  }, [providers, roleOrder]);

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

  const initials = useMemo(() => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    const first = parts[0]?.slice(0, 2) ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1].slice(0, 2) : "";
    return `${first}${last}`;
  }, [fullName]);

  return (
    <form
      action={onSubmit}
      className="provider-assignment-form"
      style={{ height: "100%" }}
      onSubmit={(event) => {
        if (agencyIds.length > 0 && !agencyName.trim()) {
          event.preventDefault();
          setAgencyWarning(
            "Enter the responsible agency name before updating this client."
          );
          agencyInputRef.current?.focus();
        }
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="fullName" value={fullName} />
      <input type="hidden" name="agencyName" value={agencyName} />
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

      <div
        className="provider-assignment-layout"
        style={{
          height: "100%",
          overflowY: "auto",
          paddingRight: 10,
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 28,
          alignItems: "start",
        }}
      >
        <section className="client-info-zone" style={{ display: "grid", gap: 10 }}>
          <div className="client-details-zone" style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 8, marginBottom: 4 }}>
              <span className="provider-assignment-heading">Client full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                style={{
                  padding: "10px 12px",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 8, marginBottom: 10 }}>
              <span className="provider-assignment-heading">Client initials</span>
              <input
                className="provider-client-initials"
                value={initials}
                readOnly
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

            <section style={{ display: "grid", gap: 8, marginBottom: 8 }}>
              <ContextualHelp
                label={
                  <span className="provider-assignment-heading">
                    Responsible agency
                  </span>
                }
                title="Responsible agency"
                explanation="Case Support is available only between providers marked as belonging to this agency for this client."
              />
              <input
                ref={agencyInputRef}
                aria-label="Responsible agency"
                aria-invalid={agencyWarning ? "true" : undefined}
                aria-describedby={
                  agencyWarning ? "responsible-agency-warning" : undefined
                }
                value={agencyName}
                onChange={(event) => {
                  setAgencyName(event.target.value);
                  if (event.target.value.trim()) setAgencyWarning("");
                }}
                placeholder="Agency name"
                style={{ padding: "10px 12px" }}
              />
              {agencyWarning ? (
                <div
                  id="responsible-agency-warning"
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
          </div>

          <div className="provider-form-actions" style={{ marginTop: 22 }}>
            <button
              type="submit"
              className="material-control action-positive"
              style={{
                borderRadius: 13,
                minHeight: 42,
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Update
            </button>
          </div>
        </section>

        <section
          className="provider-selection-zone"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(260px, 1fr))",
            gap: 24,
          }}
        >
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
                      <div
                        key={provider.id}
                        className="provider-option-row"
                      >
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
                            {provider.firstName} {provider.lastName}
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
      </div>
    </form>
  );
}
