//app/dashboard/ClientOrbit.tsx
"use client";

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
      reads?: { readAt: Date | string | null }[];
    }[];
    recentEntries?: {
      id: string;
      providerId: string;
    }[];
  };
  currentProviderId: string;
  onOpenNotes: (providerId: string) => void;
  onOpenEntryForm: (providerId: string, overlayType: "add" | "update") => void;
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
  onOpenNotes,
  onOpenEntryForm,
}: ClientOrbitProps) {
  const [menuProviderId, setMenuProviderId] = useState<string | null>(null);
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
      <div
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
        }}
      >
        {client.firstName.slice(0, 2)}
        {client.lastName.slice(0, 2)}
      </div>

      {/* PROVIDERS */}
      {providers.map((pc, index) => {
        const { x, y } = providerOrbitPoint(
          index,
          providers.length,
          providerDistance
        );

        const isMe = pc.provider.id === currentProviderId;
        const entryForProvider = client.entries?.find(
          (entry) => entry.providerId === pc.provider.id
        );
        const hasEntry = !!entryForProvider;
        const hasRecentProviderNotes = client.recentEntries?.some(
          (entry) => entry.providerId === pc.provider.id
        );
        const hasViewableProviderNotes = hasEntry || !!hasRecentProviderNotes;
        const hasUnreadForMe =
          hasEntry &&
          (
            !entryForProvider?.reads ||
            entryForProvider.reads.length === 0 ||
            entryForProvider.reads.some((read) => read.readAt === null)
          );
        const isSupervisorProvider = pc.role === "Supervisor";
        const showOwnSignal = isMe && hasUnreadForMe;
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
                ? hasEntry
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
              fontSize: hasEntry && !isSupervisorProvider ? 15 : 18,
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
              {hasEntry ? "Update Note" : "Add Note"}
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
