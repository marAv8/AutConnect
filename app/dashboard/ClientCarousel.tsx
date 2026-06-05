//app/dashboard/ClientCarousel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import ClientOrbit from "./ClientOrbit";
import DashboardNoteOverlay from "./DashboardNoteOverlay";

type OverlayType = "view" | "add" | "update" | null;

type CarouselClient = {
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
    reads?: { readAt: Date | string | null }[];
  }[];
  recentEntries?: {
    id: string;
    providerId: string;
  }[];
};

type ClientCarouselProps = {
  clients: CarouselClient[];
  currentProviderId: string;
  viewerRole?: string;
  initialClientId?: string;
  onActiveClientChange?: (clientId: string) => void;
  onEntryRead?: (clientId: string, authorProviderId: string) => void;
  onEntrySaved?: (clientId: string, authorProviderId: string, entryId: string) => void;
};

type EntryMutation =
  | {
      type: "read";
      clientId: string;
      authorProviderId: string;
    }
  | {
      type: "saved";
      clientId: string;
      authorProviderId: string;
      entryId: string;
    };

export default function ClientCarousel({
  clients,
  currentProviderId,
  viewerRole,
  initialClientId,
  onActiveClientChange,
  onEntryRead,
  onEntrySaved,
}: ClientCarouselProps) {
  const SCENE_WIDTH = 980;
  const SCENE_SIDE_PADDING = 24;
  const NAV_BUTTON_SIZE = 44;

  const [entryMutations, setEntryMutations] = useState<EntryMutation[]>([]);
  const visibleClients = useMemo(
    () =>
      entryMutations.reduce((currentClients, mutation) => {
        if (mutation.type === "read") {
          return updateClientEntriesReadState(
            currentClients,
            mutation.clientId,
            mutation.authorProviderId
          );
        }

        return updateClientEntrySavedState(
          currentClients,
          mutation.clientId,
          mutation.authorProviderId,
          mutation.entryId,
          currentProviderId
        );
      }, clients),
    [clients, currentProviderId, entryMutations]
  );
  const initialIndex = (() => {
    if (!initialClientId || visibleClients.length === 0) return 0;
    const matchedIndex = visibleClients.findIndex((c) => c.id === initialClientId);
    return matchedIndex >= 0 ? matchedIndex : 0;
  })();
  const [index, setIndex] = useState(initialIndex);
  const [overlayType, setOverlayType] = useState<OverlayType>(null);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const closeOverlay = useCallback(() => {
    setOverlayType(null);
    setActiveProviderId(null);
  }, []);

  useEffect(() => {
    if (visibleClients.length === 0 || !onActiveClientChange) return;
    const client = visibleClients[Math.min(index, visibleClients.length - 1)];
    if (!client?.id) return;
    onActiveClientChange(client.id);
  }, [visibleClients, index, onActiveClientChange]);

  useEffect(() => {
    if (!overlayType) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOverlay();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeOverlay, overlayType]);

  const safeIndex = Math.min(index, visibleClients.length - 1);
  const client = visibleClients[safeIndex];
  const activeClientId = client?.id ?? "";

  const prev = () =>
    setIndex((i) => (i === 0 ? visibleClients.length - 1 : i - 1));
  const next = () =>
    setIndex((i) => (i === visibleClients.length - 1 ? 0 : i + 1));

  const openNotesOverlay = (providerId: string) => {
    setActiveProviderId(providerId);
    setOverlayType("view");
  };
  const openEntryOverlay = (
    providerId: string,
    nextOverlayType: "add" | "update"
  ) => {
    setActiveProviderId(providerId);
    setOverlayType(nextOverlayType);
  };
  const markProviderEntriesRead = useCallback((authorProviderId: string) => {
    if (!activeClientId) return;
    setEntryMutations((current) => [
      ...current,
      { type: "read", clientId: activeClientId, authorProviderId },
    ]);
    onEntryRead?.(activeClientId, authorProviderId);
  }, [activeClientId, onEntryRead]);
  const markProviderEntrySaved = useCallback((authorProviderId: string, entryId: string) => {
    if (!activeClientId) return;
    setEntryMutations((current) => [
      ...current,
      { type: "saved", clientId: activeClientId, authorProviderId, entryId },
    ]);
    onEntrySaved?.(activeClientId, authorProviderId, entryId);
  }, [activeClientId, onEntrySaved]);

  if (visibleClients.length === 0 || !client) return null;

  const shouldShowPosition = !(viewerRole === "Caregiver" && visibleClients.length === 1);
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
            color: "rgb(0 0 0 / 64%)",
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          <button
            type="button"
            onClick={prev}
            disabled={visibleClients.length <= 1}
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
              cursor: visibleClients.length > 1 ? "pointer" : "default",
              color: "rgb(0 0 0 / 60%)",
              opacity: visibleClients.length > 1 ? 1 : 0,
            }}
            aria-label="Previous client"
          >
            ‹
          </button>

          <div style={{ textAlign: "center" }}>
            {shouldShowPosition ? `${safeIndex + 1} of ${visibleClients.length}` : null}
          </div>

          <button
            type="button"
            onClick={next}
            disabled={visibleClients.length <= 1}
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
              cursor: visibleClients.length > 1 ? "pointer" : "default",
              color: "rgb(0 0 0 / 60%)",
              opacity: visibleClients.length > 1 ? 1 : 0,
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
          onOpenNotes={openNotesOverlay}
          onOpenEntryForm={openEntryOverlay}
        />
      </div>
      <AnimatePresence>
        {overlayType && activeProviderId ? (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/25 backdrop-blur-[3px]"
            />
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="paper-surface add-note-overlay-panel max-h-[calc(100vh-48px)] w-[min(1280px,92vw)] overflow-y-auto p-8"
              >
                <DashboardNoteOverlay
                  overlayType={overlayType}
                  clientId={client.id}
                  providerId={activeProviderId}
                  onClose={closeOverlay}
                  onRead={markProviderEntriesRead}
                  onSaved={markProviderEntrySaved}
                />
              </motion.div>
            </div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function updateClientEntriesReadState(
  clients: CarouselClient[],
  clientId: string,
  authorProviderId: string
) {
  const readAt = new Date();

  return clients.map((client) => {
    if (client.id !== clientId) return client;

    return {
      ...client,
      entries: client.entries?.map((entry) =>
        entry.providerId === authorProviderId
          ? {
              ...entry,
              reads: [{ readAt }],
            }
          : entry
      ),
    };
  });
}

function updateClientEntrySavedState(
  clients: CarouselClient[],
  clientId: string,
  authorProviderId: string,
  entryId: string,
  currentProviderId: string
) {
  return clients.map((client) => {
    if (client.id !== clientId) return client;

    const entries = client.entries ?? [];
    const hasEntry = entries.some((entry) => entry.id === entryId);
    const nextEntry = {
      id: entryId,
      providerId: authorProviderId,
      reads: [{ readAt: null }],
    };

    return {
      ...client,
      entries: hasEntry
        ? entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  providerId: authorProviderId,
                  reads:
                    authorProviderId === currentProviderId
                      ? [{ readAt: null }]
                      : entry.reads,
                }
              : entry
          )
        : [...entries, nextEntry],
      recentEntries: mergeRecentEntry(client.recentEntries ?? [], entryId, authorProviderId),
    };
  });
}

function mergeRecentEntry(
  recentEntries: NonNullable<CarouselClient["recentEntries"]>,
  entryId: string,
  providerId: string
) {
  if (recentEntries.some((entry) => entry.id === entryId)) {
    return recentEntries;
  }

  return [...recentEntries, { id: entryId, providerId }];
}
