//app/dashboard/ClientCarousel.tsx
"use client";

import { useEffect, useState } from "react";
import ClientOrbit from "./ClientOrbit";

type ClientCarouselProps = {
  clients: {
    id: string;
    firstName: string;
    lastName: string;
    providerClients: {
      role: string;
      provider: {
        id: string;
        firstName: string;
        lastName: string;
      };
    }[];
    entries?: {
      id: string;
      providerId: string;
      reads?: { readAt: Date | null }[];
    }[];
    recentEntries?: {
      id: string;
      providerId: string;
    }[];
  }[];
  currentProviderId: string;
  viewerRole?: string;
  initialClientId?: string;
  onActiveClientChange?: (clientId: string) => void;
};


export default function ClientCarousel({
  clients,
  currentProviderId,
  viewerRole,
  initialClientId,
  onActiveClientChange,
}: ClientCarouselProps) {
  const SCENE_WIDTH = 980;
  const SCENE_SIDE_PADDING = 24;
  const NAV_BUTTON_SIZE = 44;

  const initialIndex = (() => {
    if (!initialClientId || clients.length === 0) return 0;
    const matchedIndex = clients.findIndex((c) => c.id === initialClientId);
    return matchedIndex >= 0 ? matchedIndex : 0;
  })();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (clients.length === 0 || !onActiveClientChange) return;
    const client = clients[index];
    if (!client?.id) return;
    onActiveClientChange(client.id);
  }, [clients, index, onActiveClientChange]);

  if (clients.length === 0) return null;

  const prev = () =>
    setIndex((i) => (i === 0 ? clients.length - 1 : i - 1));
  const next = () =>
    setIndex((i) => (i === clients.length - 1 ? 0 : i + 1));

  const client = clients[index];
  const shouldShowPosition = !(viewerRole === "Caregiver" && clients.length === 1);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        height: "100%",
        alignItems: "center",
        paddingBottom: 40,
      }}
    >
      <div
        style={{
          width: "min(100%, 980px)",
          maxWidth: SCENE_WIDTH,
          paddingLeft: SCENE_SIDE_PADDING,
          paddingRight: SCENE_SIDE_PADDING,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${NAV_BUTTON_SIZE}px minmax(72px, auto) ${NAV_BUTTON_SIZE}px`,
            alignItems: "center",
            justifyContent: "center",
            columnGap: 24,
            color: "#2248e8",
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          <button
            type="button"
            onClick={prev}
            disabled={clients.length <= 1}
            style={{
              width: NAV_BUTTON_SIZE,
              height: NAV_BUTTON_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: clients.length > 1 ? "pointer" : "default",
              color: "#333",
              opacity: clients.length > 1 ? 1 : 0,
            }}
            aria-label="Previous client"
          >
            ‹
          </button>

          <div style={{ textAlign: "center" }}>
            {shouldShowPosition ? `${index + 1} of ${clients.length}` : null}
          </div>

          <button
            type="button"
            onClick={next}
            disabled={clients.length <= 1}
            style={{
              width: NAV_BUTTON_SIZE,
              height: NAV_BUTTON_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: clients.length > 1 ? "pointer" : "default",
              color: "#333",
              opacity: clients.length > 1 ? 1 : 0,
            }}
            aria-label="Next client"
          >
            ›
          </button>
        </div>

        <ClientOrbit
          key={client.id}
          client={client}
          currentProviderId={currentProviderId}
        />
      </div>
    </div>
  );
}
