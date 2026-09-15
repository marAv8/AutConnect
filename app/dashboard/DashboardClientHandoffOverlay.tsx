"use client";

/**
 * Client-level handoff opened from the center badge in ClientOrbit.
 * It presents the deterministic Today/Previous Day summary and groups source
 * references by provider role so readers can open detailed notes only as needed.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatClinicalShortDateTime } from "@/app/libs/dateTime";

type HandoffItem = {
  id: string;
  title: string;
  summary: string;
  providerRoles: string[];
};

type HandoffSection = {
  key:
    | "home-context"
    | "session-context"
    | "provider-observations"
    | "emerging-priorities";
  title: string;
  summary: string;
  sourceReferenceIds: string[];
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
  sections?: HandoffSection[];
  keyEvents: HandoffItem[];
  currentConsiderations: HandoffItem[];
  positiveDevelopments: HandoffItem[];
  supportingReferences: SourceReference[];
  highestAttentionLevel: string | null;
  hasMeaningfulEvents: boolean;
  completedEntryCount: number;
  inProgressEntryCount: number;
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
  const [activeView, setActiveView] = useState<"today" | "previousDay">(
    "previousDay"
  );

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
          throw new Error(`Unable to load client summary: ${response.status}`);
        }

        const payload = (await response.json()) as HandoffResponse;
        if (!isMounted) return;

        setData(payload);
        setActiveView(payload.previousDay ? "previousDay" : "today");
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
    return <OverlayShell onClose={onClose}>Loading client summary...</OverlayShell>;
  }

  if (status === "error" || !data) {
    return (
      <OverlayShell onClose={onClose}>
        <div style={{ textAlign: "center", opacity: 0.72 }}>
          Client summary could not be loaded.
        </div>
      </OverlayShell>
    );
  }

  return (
    <OverlayShell onClose={onClose}>
      <div className="client-handoff-layout" style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 650 }}>Client Summary</div>
          <div style={{ fontSize: 13, opacity: 0.64 }}>
            {activeHandoff?.client.name ?? "Client"}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Client Summary session"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            width: "min(420px, 100%)",
            justifySelf: "center",
          }}
        >
          <HandoffTab
            selected={activeView === "previousDay"}
            disabled={!data.previousDay}
            onClick={() => setActiveView("previousDay")}
          >
            Previous Session
          </HandoffTab>
          <HandoffTab
            selected={activeView === "today"}
            disabled={!data.today}
            onClick={() => setActiveView("today")}
          >
            Current Session
          </HandoffTab>
        </div>

        {activeHandoff ? (
          <div
            className="paper-surface client-handoff-content-card"
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
              <div
                className="client-handoff-card-heading"
                style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 650 }}>
                    Daily summary — {formatSummaryDate(activeHandoff.date)}
                  </div>
                </div>
                {updatedLabel ? (
                  <div style={{ fontSize: 12, opacity: 0.58 }}>{updatedLabel}</div>
                ) : null}
              </div>
              {activeHandoff.sections?.length ? (
                <div style={{ display: "grid", gap: 18 }}>
                  {activeHandoff.sections.map((section) => (
                    <section
                      key={section.key}
                      style={{ display: "grid", gap: 7 }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.68 }}>
                        {section.title}
                      </div>
                      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
                        {section.summary}
                      </p>
                      <ReferencedNotes
                        references={activeHandoff.supportingReferences.filter(
                          (reference) =>
                            section.sourceReferenceIds.includes(reference.id)
                        )}
                        label="View Sources"
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
                    {activeHandoff.overview}
                  </p>
                  <ReferencedNotes references={activeHandoff.supportingReferences} />
                </>
              )}
            </section>
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
        width: "100%",
        display: "grid",
        justifyItems: "center",
        gap: 22,
        color: "var(--client-summary-text, rgb(0 0 0 / 78%))",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="back-link overlay-client-back-control"
        aria-label="Back to Client"
      >
        Client
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
      className="material-control handoff-day-tab"
      style={{
        minHeight: 42,
        border: "none",
        borderRadius: 14,
        background: selected
          ? "var(--client-summary-tab-selected, rgb(255 255 255 / 82%))"
          : "var(--client-summary-tab, rgb(255 255 255 / 42%))",
        boxShadow: selected ? "var(--shadow-dashboard-badge)" : "var(--shadow-tactile)",
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

function ReferencedNotes({
  references,
  label = "Referenced notes",
}: {
  references: SourceReference[];
  label?: string;
}) {
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
        {label}
      </summary>
      <div style={{ display: "grid", gap: 8, paddingTop: 10 }}>
        {referenceGroups.map((group) => (
          <details
            key={group.providerRole}
            style={{
              border: "1px solid var(--client-summary-reference-border, rgb(0 0 0 / 7%))",
              borderRadius: 8,
              background: "var(--client-summary-reference-surface, rgb(255 255 255 / 54%))",
              padding: "9px 11px",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 650,
                color: "var(--client-summary-reference-text, rgb(0 0 0 / 72%))",
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

function formatSummaryDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
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
      (item) => normalizeReferenceText(item.snippet) === normalizeReferenceText(reference.snippet)
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

function normalizeReferenceText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatProviderRole(role: string) {
  const labels: Record<string, string> = {
    BehaviorTherapist: "Behavior Therapist",
    SpeechPathologist: "Speech Pathologist",
    OccupationalTherapist: "Occupational Therapist",
  };

  return labels[role] ?? role;
}
