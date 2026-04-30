//app/dashboard/ClientOrbit.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
      reads?: { readAt: Date | null }[];
    }[];
    recentEntries?: {
      id: string;
      providerId: string;
    }[];
  };
  currentProviderId: string;
};

const providerActionMenuStyle: CSSProperties = {
  position: "absolute",
  left: "calc(100% + 4px)",
  top: -30,
  display: "grid",
  gap: 8,
  minWidth: 142,
  zIndex: 8,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(255, 255, 255, 0.66)",
  background: "rgba(255, 255, 255, 0.92)",
  backdropFilter: "blur(18px) saturate(1.16)",
  WebkitBackdropFilter: "blur(18px) saturate(1.16)",
  boxShadow: "0 18px 48px rgba(0, 0, 0, 0.22), 0 1px 12px rgba(0, 0, 0, 0.12)",
  transformOrigin: "0 32px",
  animation: "provider-action-pop 180ms cubic-bezier(0.2, 0.9, 0.25, 1.12) both",
};

const providerActionBridgeStyle: CSSProperties = {
  position: "absolute",
  left: -13,
  top: 42,
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "1px solid rgba(255, 255, 255, 0.66)",
  borderRight: "none",
  borderBottom: "none",
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "-8px 12px 24px rgba(0, 0, 0, 0.08)",
};

const providerActionLinkStyle: CSSProperties = {
  color: "#222",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: "nowrap",
  padding: "8px 10px",
  borderRadius: 7,
  background: "rgba(255, 255, 255, 0.68)",
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
}: ClientOrbitProps) {
  const router = useRouter();
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
            filter: blur(1px);
          }
          to {
            opacity: 1;
            transform: translate(0, 0) scale(1);
            filter: blur(0);
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
          border: "2px solid #ccc",
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
        const showOwnSignal = isMe && hasEntry && hasUnreadForMe;
        const showAction = isMe || hasUnreadForMe;
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
            setMenuProviderId(null);
            router.push(
              `/dashboard?clientId=${client.id}&view=orbit&notesClientId=${client.id}&authorProviderId=${pc.provider.id}`
            );
          }
        }}
        style={{
          position: "relative", 
          width: spokeSize,
          height: spokeSize,
          borderRadius: "50%",
          background: "#f5f5f5",
          border: "1px solid #bbb",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          textAlign: "center",
          padding: 8,
          cursor: !isMe && hasViewableProviderNotes ? "pointer" : "default",
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
            onClick={() => {
              if (isMe) {
                setMenuProviderId((current) =>
                  current === pc.provider.id ? null : pc.provider.id
                );
                return;
              }

              setMenuProviderId(null);
              router.push(
                `/dashboard?clientId=${client.id}&view=orbit&notesClientId=${client.id}&authorProviderId=${pc.provider.id}`
              );
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
              border: "1px solid #999",
              background: "white",
              cursor: "pointer",
              fontSize: hasEntry && !isSupervisorProvider ? 15 : 18,
              lineHeight: "26px",
              zIndex: 23,
            }}
          >
            {showOwnSignal || (!isMe && hasUnreadForMe)
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
            <span aria-hidden="true" style={providerActionBridgeStyle} />
            <Link
              href={`/dashboard?clientId=${client.id}&view=orbit&notesClientId=${client.id}&authorProviderId=${currentProviderId}`}
              onClick={dismissOwnNotesPrompt}
              style={providerActionLinkStyle}
            >
              View Notes
            </Link>
            <Link
              href={`/portal/notes/add?clientId=${client.id}${hasEntry ? "&edit=1" : ""}`}
              onClick={dismissOwnNotesPrompt}
              style={providerActionLinkStyle}
            >
              {hasEntry ? "Update Note" : "Add Note"}
            </Link>
          </div>
        )}

      </div>
    </div>
  );
})}

    </div>
  );
}
