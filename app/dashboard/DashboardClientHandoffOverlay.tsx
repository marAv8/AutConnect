"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatClinicalShortDateTime } from "@/app/libs/dateTime";

type HandoffItem = {
  id: string;
  title: string;
  summary: string;
  providerRoles: string[];
};

type SourceReference = {
  id: string;
  providerName: string;
  providerRole: string;
  sourceCategory: string;
  label: string;
  snippet: string;
  sectionKey?: string;
  completedAt?: string;
};

type ClientDailyHandoffPayload = {
  client: {
    id: string;
    name: string;
  };
  date: string;
  status: "LIVE" | "FINALIZED";
  overview: string;
  keyEvents: HandoffItem[];
  currentConsiderations: HandoffItem[];
  positiveDevelopments: HandoffItem[];
  supportingReferences: SourceReference[];
  highestAttentionLevel: string | null;
  hasMeaningfulEvents: boolean;
  completedEntryCount: number;
  contributingProviderRoles: string[];
  lastUpdatedAt: string;
};

type HandoffResponse = {
  today: ClientDailyHandoffPayload | null;
  previousDay: ClientDailyHandoffPayload | null;
};

type Props = {
  clientId: string;
  onClose: () => void;
};

export default function DashboardClientHandoffOverlay({ clientId, onClose }: Props) {
  const [data, setData] = useState<HandoffResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeView, setActiveView] = useState<"today" | "previousDay">("today");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadHandoff() {
      setStatus("loading");
      try {
        const response = await fetch(`/api/client-handoff?clientId=${clientId}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load client handoff: ${response.status}`);
        }

        const payload = (await response.json()) as HandoffResponse;
        if (!isMounted) return;

        setData(payload);
        setActiveView(payload.today ? "today" : "previousDay");
        setStatus("ready");
      } catch (error) {
        if (!isMounted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setStatus("error");
      }
    }

    loadHandoff();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientId]);

  const activeHandoff = activeView === "today" ? data?.today : data?.previousDay;
  const updatedLabel = useMemo(() => {
    if (!activeHandoff?.lastUpdatedAt) return null;
    return formatClinicalShortDateTime(activeHandoff.lastUpdatedAt);
  }, [activeHandoff?.lastUpdatedAt]);

  if (status === "loading") {
    return <OverlayShell onClose={onClose}>Loading client handoff...</OverlayShell>;
  }

  if (status === "error" || !data) {
    return (
      <OverlayShell onClose={onClose}>
        <div style={{ textAlign: "center", opacity: 0.72 }}>
          Client handoff could not be loaded.
        </div>
      </OverlayShell>
    );
  }

  return (
    <OverlayShell onClose={onClose}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 650 }}>Client Handoff</div>
          <div style={{ fontSize: 13, opacity: 0.64 }}>
            {activeHandoff?.client.name ?? "Client"}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Client handoff day"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            width: "min(420px, 100%)",
            justifySelf: "center",
          }}
        >
          <HandoffTab
            selected={activeView === "today"}
            disabled={!data.today}
            onClick={() => setActiveView("today")}
          >
            Today
          </HandoffTab>
          <HandoffTab
            selected={activeView === "previousDay"}
            disabled={!data.previousDay}
            onClick={() => setActiveView("previousDay")}
          >
            Previous Day
          </HandoffTab>
        </div>

        {activeHandoff ? (
          <div
            className="paper-surface"
            style={{
              width: "min(620px, 86vw)",
              maxHeight: "min(620px, calc(100vh - 210px))",
              overflowY: "auto",
              padding: "28px 30px",
              boxSizing: "border-box",
              display: "grid",
              gap: 22,
            }}
          >
            <section style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 650 }}>
                  {activeView === "today" ? "Today" : "Previous Day"}
                </div>
                {updatedLabel ? (
                  <div style={{ fontSize: 12, opacity: 0.58 }}>{updatedLabel}</div>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
                {activeHandoff.overview}
              </p>
            </section>

            <ReferencedNotes references={activeHandoff.supportingReferences} />
          </div>
        ) : (
          <div style={{ textAlign: "center", opacity: 0.72 }}>
            No handoff is available for this view yet.
          </div>
        )}
      </div>
    </OverlayShell>
  );
}

function OverlayShell({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        justifyItems: "center",
        gap: 22,
        color: "rgb(0 0 0 / 78%)",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="team-focus-close-button"
        aria-label="Close Client Handoff"
      >
        ×
      </button>
      {children}
    </div>
  );
}

function HandoffTab({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 42,
        border: "none",
        background: selected ? "rgb(255 255 255 / 82%)" : "rgb(255 255 255 / 42%)",
        boxShadow: selected ? "var(--shadow-dashboard-badge)" : "none",
        color: "var(--foreground)",
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? "default" : "pointer",
        fontSize: 14,
        fontWeight: 650,
      }}
    >
      {children}
    </button>
  );
}

function ReferencedNotes({ references }: { references: SourceReference[] }) {
  const visibleReferences = references.filter(isVisibleReference);
  const referenceGroups = groupReferencesByProviderRole(visibleReferences);

  if (referenceGroups.length === 0) {
    return null;
  }

  return (
    <details style={{ display: "grid", gap: 10 }}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 650,
          opacity: 0.66,
        }}
      >
        Referenced notes
      </summary>
      <div style={{ display: "grid", gap: 8, paddingTop: 10 }}>
        {referenceGroups.map((group) => (
          <details
            key={group.providerRole}
            style={{
              border: "1px solid rgb(0 0 0 / 7%)",
              borderRadius: 8,
              background: "rgb(255 255 255 / 54%)",
              padding: "9px 11px",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 650,
                color: "rgb(0 0 0 / 72%)",
              }}
            >
              {formatProviderRole(group.providerRole)}
            </summary>
            <div style={{ display: "grid", gap: 7, paddingTop: 9 }}>
              {group.references.map((reference) => (
                <div key={reference.id} style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 650, opacity: 0.72 }}>
                    {reference.label}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.62 }}>
                    {reference.snippet}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}

function isVisibleReference(reference: SourceReference) {
  return (
    reference.sectionKey !== "team-focus" &&
    !["team_focus", "supervisor_directive"].includes(reference.sourceCategory)
  );
}

function groupReferencesByProviderRole(references: SourceReference[]) {
  const groups = new Map<string, SourceReference[]>();

  for (const reference of references) {
    const existing = groups.get(reference.providerRole) ?? [];
    const isDuplicate = existing.some(
      (item) => item.label === reference.label && item.snippet === reference.snippet
    );
    if (!isDuplicate) {
      existing.push(reference);
    }
    groups.set(reference.providerRole, existing);
  }

  return Array.from(groups, ([providerRole, groupedReferences]) => ({
    providerRole,
    references: groupedReferences,
  }));
}

function formatProviderRole(role: string) {
  const labels: Record<string, string> = {
    BehaviorTherapist: "Behavior Therapist",
    SpeechPathologist: "Speech Pathologist",
    OccupationalTherapist: "Occupational Therapist",
  };

  return labels[role] ?? role;
}
