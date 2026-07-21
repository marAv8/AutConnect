//app/dashboard/ClientOrbit.tsx
"use client";

import { completeSessionNote } from "@/app/actions/completeSessionNote";
import type { CaretakerContextKind } from "@/app/libs/caretakerContext";
import type { DashboardEntryKind, NoteEntryKind } from "@/app/libs/entryKinds";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type ProviderClient = {
  role: string;
  provider: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type ClientOrbitProps = {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    providerClients: ProviderClient[];
    entries?: {
      id: string;
      providerId: string;
      kind?: string;
      visibility?: string;
      status?: string;
      reads?: { readAt: Date | string | null }[];
    }[];
    recentEntries?: {
      id: string;
      providerId: string;
      status?: string;
    }[];
  };
  currentProviderId: string;
  viewerRole?: string;
  onOpenNotes: (providerId: string) => void;
  onOpenEntryForm: (
    providerId: string,
    overlayType: "add" | "update",
    entryKind?: CaretakerContextKind | NoteEntryKind
  ) => void;
  onOpenAbcData: (providerId: string) => void;
  onOpenTeamFocus: () => void;
  onOpenClientHandoff: () => void;
  onOpenEducatorTarget: (progressKind?: NoteEntryKind) => void;
};

const providerActionMenuStyle: CSSProperties = {
  position: "absolute",
  left: "calc(100% + 14px)",
  top: -40,
  display: "grid",
  gap: 10,
  minWidth: 158,
  zIndex: 24,
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  background: "var(--glass-strong)",
  boxShadow: "var(--shadow-dashboard-badge)",
  transformOrigin: "0 32px",
  animation: "provider-action-pop 180ms cubic-bezier(0.2, 0.9, 0.25, 1.12) both",
};

const providerActionLinkStyle: CSSProperties = {
  color: "var(--foreground)",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 550,
  whiteSpace: "nowrap",
  padding: "8px 6px",
  borderRadius: 0,
  background: "transparent",
  textAlign: "center",
};

const abcDataRoles = new Set([
  "Supervisor",
  "BehaviorTherapist",
  "Caregiver",
]);

const readableEntryKinds = new Set<DashboardEntryKind>([
  "SessionNote",
  "SupervisorObservation",
  "ClinicalNote",
  "SensoryObservation",
  "SpeechProgress",
  "CommunicationObservation",
  "MorningContext",
  "EveningContext",
]);

type EntryReadState = {
  visibility?: string;
  reads?: { readAt: Date | string | null }[];
};

function isReadableEntryKind(kind?: string) {
  return readableEntryKinds.has((kind ?? "SessionNote") as DashboardEntryKind);
}

function isUnreadForViewer(entry: EntryReadState) {
  if (entry.visibility === "Private") {
    return false;
  }

  return (
    !entry.reads ||
    entry.reads.length === 0 ||
    entry.reads.some((read) => read.readAt === null)
  );
}

function providerOrbitPoint(index: number, count: number, distance: number) {
  const layouts: Record<number, Array<[number, number]>> = {
    1: [[0, -1]],
    2: [
      [-1, 0],
      [1, 0],
    ],
    3: [
      [0, -1],
      [0.88, 0.56],
      [-0.88, 0.56],
    ],
    4: [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ],
    5: [
      [0, -1],
      [0.95, -0.3],
      [0.62, 0.82],
      [-0.62, 0.82],
      [-0.95, -0.3],
    ],
    6: [
      [0, -1],
      [0.88, -0.5],
      [0.88, 0.5],
      [0, 1],
      [-0.88, 0.5],
      [-0.88, -0.5],
    ],
    7: [
      [0, -1],
      [0.78, -0.62],
      [1, 0.16],
      [0.44, 0.9],
      [-0.44, 0.9],
      [-1, 0.16],
      [-0.78, -0.62],
    ],
    8: [
      [0, -1],
      [0.72, -0.72],
      [1, 0],
      [0.72, 0.72],
      [0, 1],
      [-0.72, 0.72],
      [-1, 0],
      [-0.72, -0.72],
    ],
  };

  const point = layouts[count]?.[index];
  if (point) {
    return {
      x: point[0] * distance,
      y: point[1] * distance,
    };
  }

  const angle = -Math.PI / 2 + (index / count) * 2 * Math.PI;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

export default function ClientOrbit({
  client,
  currentProviderId,
  viewerRole,
  onOpenNotes,
  onOpenEntryForm,
  onOpenAbcData,
  onOpenTeamFocus,
  onOpenClientHandoff,
  onOpenEducatorTarget,
}: ClientOrbitProps) {
  const [menuProviderId, setMenuProviderId] = useState<string | null>(null);
  const [completionStatus, setCompletionStatus] = useState<
    Record<string, "idle" | "saving" | "error">
  >({});
  const [completedProviderIds, setCompletedProviderIds] = useState<Set<string>>(
    () => new Set()
  );
  const orbitRef = useRef<HTMLDivElement | null>(null);

  const roleLabel = (role: string) => {
    switch (role) {
      case "BehaviorTherapist":
        return "Bx Tech";
      case "SpeechPathologist":
        return "S.P.";
      case "OccupationalTherapist":
        return "O.T.";
      case "Supervisor":
        return "BCBA";
      case "Caregiver":
        return "Caretaker";
      default:
        return role;
    }
  };

  const providerDistance = 144;
  const orbitSize = 430;
  const centerSize = 150;
  const spokeSize = 88;
  const badgeSize = 28;

  const providers = client.providerClients;
  const dismissOwnNotesPrompt = useCallback(() => {
    setMenuProviderId(null);
  }, []);
  const completeProviderSessionNote = async (providerId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to submit this session note?\n\nThis will mark the provider communication as complete."
    );
    if (!confirmed) {
      return;
    }

    setCompletionStatus((current) => ({ ...current, [providerId]: "saving" }));

    const formData = new FormData();
    formData.append("clientId", client.id);
    const result = await completeSessionNote(formData);

    if (result.ok) {
      setCompletedProviderIds((current) => {
        const next = new Set(current);
        next.add(providerId);
        return next;
      });
      setCompletionStatus((current) => ({ ...current, [providerId]: "idle" }));
      dismissOwnNotesPrompt();
      return;
    }

    setCompletionStatus((current) => ({ ...current, [providerId]: "error" }));
  };
  useEffect(() => {
    if (!menuProviderId) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!orbitRef.current?.contains(event.target as Node)) {
        dismissOwnNotesPrompt();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissOwnNotesPrompt();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismissOwnNotesPrompt, menuProviderId]);

  return (
    <div
      ref={orbitRef}
      onPointerDown={(event) => {
        if (!menuProviderId) {
          return;
        }

        const target = event.target as HTMLElement;
        if (!target.closest('[data-own-note-menu="true"]')) {
          dismissOwnNotesPrompt();
        }
      }}
      style={{
        position: "relative",
        width: orbitSize,
        height: orbitSize,
        margin: "18px auto 48px",
      }}
    >
      <style>{`
        @keyframes provider-action-pop {
          from {
            opacity: 0;
            transform: translate(-8px, -4px) scale(0.82);
          }
          to {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
        }

      `}</style>
      {/* CENTER CLIENT */}
      <button
        type="button"
        aria-label="Open Client Handoff"
        onClick={onOpenClientHandoff}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: centerSize,
          height: centerSize,
          borderRadius: "50%",
          border: "none",
          background: "rgb(244 244 244 / 94%)",
          boxShadow: "var(--shadow-dashboard-sphere)",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 28,
          cursor: "pointer",
        }}
      >
        {client.firstName.slice(0, 2)}
        {client.lastName.slice(0, 2)}
      </button>

      {/* PROVIDERS */}
      {providers.map((pc, index) => {
        const { x, y } = providerOrbitPoint(
          index,
          providers.length,
          providerDistance
        );

        const isMe = pc.provider.id === currentProviderId;
        const entryForProvider = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            (entry.kind ?? "SessionNote") === "SessionNote"
        );
        const speechProgressEntry = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            entry.kind === "SpeechProgress"
        );
        const readableEntriesForProvider = (client.entries ?? []).filter(
          (entry) =>
            entry.providerId === pc.provider.id &&
            isReadableEntryKind(entry.kind)
        );
        const hasCompletedSessionNote =
          completedProviderIds.has(pc.provider.id) ||
          readableEntriesForProvider.some((entry) => entry.status === "COMPLETED");
        const unreadEntryForProvider =
          readableEntriesForProvider
            .filter((entry) => entry.status === "COMPLETED")
            .find(isUnreadForViewer);
        const observationEntry = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            entry.kind === "SupervisorObservation"
        );
        const sensoryObservationEntry = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            entry.kind === "SensoryObservation"
        );
        const communicationObservationEntry = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            entry.kind === "CommunicationObservation"
        );
        const clinicalNoteEntry = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            entry.kind === "ClinicalNote"
        );
        const morningContextEntry = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            entry.kind === "MorningContext"
        );
        const eveningContextEntry = client.entries?.find(
          (entry) =>
            entry.providerId === pc.provider.id &&
            entry.kind === "EveningContext"
        );
        const hasEntry = !!entryForProvider;
        const hasOwnAnyEntry =
          isMe &&
          (hasEntry ||
            !!morningContextEntry ||
            !!eveningContextEntry ||
            !!observationEntry ||
            !!sensoryObservationEntry ||
            !!communicationObservationEntry ||
            !!speechProgressEntry ||
            !!clinicalNoteEntry);
        const hasOwnInProgressDocumentation =
          hasOwnAnyEntry && !hasCompletedSessionNote;
        const hasRecentProviderNotes = client.recentEntries?.some(
          (entry) => entry.providerId === pc.provider.id
        );
        const hasViewableProviderNotes =
          readableEntriesForProvider.length > 0 || !!hasRecentProviderNotes;
        const hasUnreadForMe = !!unreadEntryForProvider;
        const isSupervisorProvider = pc.role === "Supervisor";
        const canUseAbcData = abcDataRoles.has(pc.role);
        const isCaregiverProvider = pc.role === "Caregiver";
        const isEducatorProvider = pc.role === "Educator";
        const isBehaviorTechnicianProvider = pc.role === "BehaviorTherapist";
        const isOccupationalTherapistProvider = pc.role === "OccupationalTherapist";
        const isSpeechPathologistProvider = pc.role === "SpeechPathologist";
        const isSupervisorViewer = viewerRole === "Supervisor";
        const showOwnSignal = isMe && hasCompletedSessionNote;
        const showProviderUnreadSignal = !isMe && hasUnreadForMe;
        const showAction = isMe || showProviderUnreadSignal;
        const showOwnMenu =
          isMe &&
          menuProviderId === pc.provider.id;

        return (
          <div
            key={pc.provider.id}
            style={{
              position: "absolute",
              zIndex: showOwnMenu ? 20 : 2,
              top: "50%",
              left: "50%",
              transform: `translate(${x - spokeSize / 2}px, ${
                y - spokeSize / 2
              }px)`,
            }}
          >
      {/* Circle */}
      <div
          onClick={() => {
            if (!isMe && hasViewableProviderNotes) {
            onOpenNotes(pc.provider.id);
          }
        }}
        style={{
          position: "relative", 
          width: spokeSize,
          height: spokeSize,
          borderRadius: "50%",
          background: "rgb(250 250 250 / 88%)",
          border: "none",
          boxShadow: "var(--shadow-dashboard-sphere-light)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          textAlign: "center",
          padding: 8,
          cursor: !isMe && hasViewableProviderNotes
              ? "pointer"
              : "default",
          zIndex: showOwnMenu ? 21 : 1,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {pc.provider.firstName}
        </div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>{roleLabel(pc.role)}</div>

        {showAction && (
          <button
            data-own-note-menu={isMe ? "true" : undefined}
            onClick={(event) => {
              event.stopPropagation();

              if (isMe) {
                setMenuProviderId((current) =>
                  current === pc.provider.id ? null : pc.provider.id
                );
                return;
              }

              onOpenNotes(pc.provider.id);
            }}
            aria-label={
              isMe
                ? hasOwnAnyEntry
                  ? "Edit your note"
                  : "Add your note"
                : "View provider note"
            }
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              width: badgeSize,
              height: badgeSize,
              borderRadius: "50%",
              border: "none",
              background: "rgb(248 248 248 / 94%)",
              boxShadow: "var(--shadow-dashboard-badge)",
              cursor: "pointer",
              fontSize: hasCompletedSessionNote && !isSupervisorProvider ? 15 : 18,
              lineHeight: "26px",
              zIndex: 23,
            }}
          >
            {showOwnSignal || showProviderUnreadSignal
              ? isSupervisorProvider
                ? "!"
                : "●"
              : "+"}
          </button>
        )}

        {showOwnMenu && (
          <div
            data-own-note-menu="true"
            style={providerActionMenuStyle}
          >
            {isSupervisorViewer && isSupervisorProvider ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    dismissOwnNotesPrompt();
                    onOpenEntryForm(
                      currentProviderId,
                      observationEntry ? "update" : "add",
                      "SupervisorObservation"
                    );
                  }}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Observation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissOwnNotesPrompt();
                    onOpenEntryForm(
                      currentProviderId,
                      clinicalNoteEntry ? "update" : "add",
                      "ClinicalNote"
                    );
                  }}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Clinical Note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissOwnNotesPrompt();
                    onOpenTeamFocus();
                  }}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Team Focus
                </button>
              </>
            ) : isCaregiverProvider ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    dismissOwnNotesPrompt();
                    onOpenEntryForm(
                      currentProviderId,
                      morningContextEntry ? "update" : "add",
                      "MorningContext"
                    );
                  }}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {morningContextEntry ? "Update Note" : "Morning Context"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissOwnNotesPrompt();
                    onOpenEntryForm(
                      currentProviderId,
                      eveningContextEntry ? "update" : "add",
                      "EveningContext"
                    );
                  }}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {eveningContextEntry ? "Update Note" : "Evening Context"}
                </button>
              </>
            ) : isBehaviorTechnicianProvider ||
              isEducatorProvider ||
              isOccupationalTherapistProvider ||
              isSpeechPathologistProvider ? (
              <>
                {isBehaviorTechnicianProvider ? (
                  <button
                    type="button"
                    onClick={() => {
                      dismissOwnNotesPrompt();
                      onOpenAbcData(currentProviderId);
                    }}
                    style={{
                      ...providerActionLinkStyle,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    A-B-C Data
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    dismissOwnNotesPrompt();
                    onOpenEntryForm(
                      currentProviderId,
                      isSpeechPathologistProvider
                        ? speechProgressEntry
                          ? "update"
                          : "add"
                        : hasEntry
                          ? "update"
                          : "add",
                      isSpeechPathologistProvider ? "SpeechProgress" : "SessionNote"
                    );
                  }}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isSpeechPathologistProvider
                    ? "Speech Progress"
                    : isOccupationalTherapistProvider
                      ? "Therapy Progress"
                      : isBehaviorTechnicianProvider
                        ? "Session Progress"
                        : "Classroom Progress"}
                </button>
                {isOccupationalTherapistProvider || isSpeechPathologistProvider ? (
                  <button
                    type="button"
                    onClick={() => {
                      dismissOwnNotesPrompt();
                      onOpenEntryForm(
                        currentProviderId,
                        isSpeechPathologistProvider
                          ? communicationObservationEntry
                            ? "update"
                            : "add"
                          : sensoryObservationEntry
                            ? "update"
                            : "add",
                        isSpeechPathologistProvider
                          ? "CommunicationObservation"
                          : "SensoryObservation"
                      );
                    }}
                    style={{
                      ...providerActionLinkStyle,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {isSpeechPathologistProvider
                      ? "Communication Observation"
                      : "Sensory Observation"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    dismissOwnNotesPrompt();
                    onOpenEducatorTarget(
                      isSpeechPathologistProvider ? "SpeechProgress" : "SessionNote"
                    );
                  }}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Add Target
                </button>
              </>
            ) : canUseAbcData ? (
              <button
                type="button"
                onClick={() => {
                  dismissOwnNotesPrompt();
                  onOpenAbcData(currentProviderId);
                }}
                style={{
                  ...providerActionLinkStyle,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                A-B-C Data
              </button>
            ) : null}
            {!isCaregiverProvider &&
            !isBehaviorTechnicianProvider &&
            !isEducatorProvider &&
            !isOccupationalTherapistProvider &&
            !isSpeechPathologistProvider &&
            !(isSupervisorViewer && isSupervisorProvider) ? (
              <button
                type="button"
                onClick={() => {
                  dismissOwnNotesPrompt();
                  onOpenEntryForm(currentProviderId, hasEntry ? "update" : "add");
                }}
                style={{
                  ...providerActionLinkStyle,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Session Note
              </button>
            ) : null}
            {hasOwnInProgressDocumentation ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void completeProviderSessionNote(pc.provider.id);
                  }}
                  disabled={completionStatus[pc.provider.id] === "saving"}
                  style={{
                    ...providerActionLinkStyle,
                    border: "none",
                    cursor:
                      completionStatus[pc.provider.id] === "saving"
                        ? "default"
                        : "pointer",
                    opacity: completionStatus[pc.provider.id] === "saving" ? 0.62 : 1,
                  }}
                >
                  {completionStatus[pc.provider.id] === "saving"
                    ? "Completing..."
                    : "Complete Session Note"}
                </button>
                {completionStatus[pc.provider.id] === "error" ? (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.35,
                      opacity: 0.68,
                      textAlign: "center",
                    }}
                  >
                    Save at least one section first.
                  </div>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                dismissOwnNotesPrompt();
                onOpenNotes(currentProviderId);
              }}
              style={{
                ...providerActionLinkStyle,
                border: "none",
                cursor: "pointer",
              }}
            >
              View Notes
            </button>
          </div>
        )}

      </div>
    </div>
  );
})}

    </div>
  );
}
