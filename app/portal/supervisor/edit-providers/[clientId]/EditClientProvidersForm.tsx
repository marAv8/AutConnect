//app/portal/supervisor/edit-providers/[clientId]/EditClientProvidersForm.tsx
"use client";

import { useMemo, useState } from "react";

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
  providers: ProviderRow[];
  initiallyAssignedProviderIds: string[];
  roleOrder: string[];
};

const roleLabel = (role: string) => role.replace(/([a-z])([A-Z])/g, "$1 $2");

export default function EditClientProvidersForm({
  clientId,
  onSubmit,
  initialFullName,
  providers,
  initiallyAssignedProviderIds,
  roleOrder,
}: Props) {
  const [fullName, setFullName] = useState(initialFullName);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initiallyAssignedProviderIds
  );

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

  const selectedProviders = useMemo(() => {
    const byId = new Map(providers.map((provider) => [provider.id, provider]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((provider): provider is ProviderRow => !!provider);
  }, [providers, selectedIds]);

  const toggleProvider = (providerId: string, checked: boolean) => {
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
    <form action={onSubmit} className="provider-assignment-form" style={{ height: "100%" }}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="fullName" value={fullName} />
      {selectedIds.map((providerId) => (
        <input
          key={providerId}
          type="hidden"
          name="providerIds"
          value={providerId}
        />
      ))}

      <div
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
          <label style={{ display: "grid", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: "rgb(0 0 0 / 76%)" }}>Client full name</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              style={{
                padding: "10px 12px",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 600, color: "rgb(0 0 0 / 76%)" }}>Client initials</span>
            <input
              value={initials}
              readOnly
              style={{
                padding: "10px 12px",
                background: "rgb(238 238 238 / 72%)",
              }}
            />
          </label>

          {selectedProviders.length === 0 && (
            <div style={{ opacity: 0.6 }}>No providers selected yet.</div>
          )}

          {selectedProviders.map((provider) => (
            <div
              key={provider.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                fontSize: 16,
                lineHeight: 1.35,
              }}
            >
              <span>
                {roleLabel(provider.role)} -- {provider.firstName} {provider.lastName}
              </span>
              <button
                type="button"
                onClick={() => toggleProvider(provider.id, false)}
                aria-label={`Remove ${provider.firstName} ${provider.lastName}`}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 24,
                  lineHeight: 1,
                  color: "rgb(0 0 0 / 58%)",
                }}
              >
                −
              </button>
            </div>
          ))}

          <div style={{ marginTop: 22 }}>
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
                  {roleLabel(role)}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {roleProviders.map((provider) => (
                    <label
                      key={provider.id}
                      className="provider-option"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        className="provider-checkbox"
                        checked={selectedSet.has(provider.id)}
                        onChange={(event) =>
                          toggleProvider(provider.id, event.target.checked)
                        }
                      />
                      <span>
                        {provider.firstName} {provider.lastName}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </form>
  );
}
