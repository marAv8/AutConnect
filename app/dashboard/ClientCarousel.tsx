//app/dashboard/ClientCarousel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { CaretakerContextKind } from "@/app/libs/caretakerContext";
import type { NoteEntryKind } from "@/app/libs/entryKinds";
import ClientOrbit from "./ClientOrbit";
import DashboardAbcDataOverlay from "./DashboardAbcDataOverlay";
import DashboardClientHandoffOverlay from "./DashboardClientHandoffOverlay";
import DashboardNoteOverlay from "./DashboardNoteOverlay";
import DashboardTeamFocusOverlay from "./DashboardTeamFocusOverlay";

type OverlayType =
  | "view"
  | "add"
  | "update"
  | "abc"
  | "teamFocus"
  | "teamFocusView"
  | "clientHandoff"
  | "educatorTarget"
  | null;

type TeamFocusData = {
  id: string;
  title?: string | null;
  content: string;
  updatedAt: Date | string;
  author: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

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
  teamFocusItems?: TeamFocusData[];
};

type ClientCarouselProps = {
  clients: CarouselClient[];
  currentProviderId: string;
  viewerRole?: string;
  initialClientId?: string;
  onActiveClientChange?: (clientId: string) => void;
  onEntryRead?: (clientId: string, authorProviderId: string) => void;
  onEntrySaved?: (
    clientId: string,
    authorProviderId: string,
    entryId: string,
    visibility?: "Private" | "Shared",
    status?: string
  ) => void;
  onTeamFocusSaved?: (clientId: string, teamFocus: TeamFocusData) => void;
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
      kind?: string;
      visibility?: string;
      status?: string;
    };

export default function ClientCarousel({
  clients,
  currentProviderId,
  viewerRole,
  initialClientId,
  onActiveClientChange,
  onEntryRead,
  onEntrySaved,
  onTeamFocusSaved,
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
        mutation.kind,
        mutation.visibility,
        mutation.status,
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
  const [activeContextKind, setActiveContextKind] =
    useState<CaretakerContextKind | null>(null);
  const [activeNoteKind, setActiveNoteKind] = useState<NoteEntryKind | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const closeOverlay = useCallback(() => {
    setOverlayType(null);
    setActiveProviderId(null);
    setActiveContextKind(null);
    setActiveNoteKind(null);
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
    nextOverlayType: "add" | "update",
    entryKind?: CaretakerContextKind | NoteEntryKind
  ) => {
    setActiveProviderId(providerId);
    setActiveContextKind(
      entryKind === "MorningContext" || entryKind === "EveningContext"
        ? entryKind
        : null
    );
    setActiveNoteKind(
      entryKind === "SupervisorObservation" ||
        entryKind === "ClinicalNote" ||
        entryKind === "SensoryObservation" ||
        entryKind === "SpeechProgress" ||
        entryKind === "CommunicationObservation" ||
        entryKind === "SessionNote"
        ? entryKind
        : null
    );
    setOverlayType(nextOverlayType);
  };
  const openAbcDataOverlay = (providerId: string) => {
    setActiveProviderId(providerId);
    setActiveContextKind(null);
    setActiveNoteKind("SessionNote");
    setOverlayType("abc");
  };
  const openTeamFocusOverlay = () => {
    setActiveProviderId(currentProviderId);
    setOverlayType("teamFocus");
  };
  const openTeamFocusViewOverlay = () => {
    setActiveProviderId(currentProviderId);
    setOverlayType("teamFocusView");
  };
  const openClientHandoffOverlay = () => {
    setActiveProviderId(null);
    setOverlayType("clientHandoff");
  };
  const openEducatorTargetOverlay = (progressKind: NoteEntryKind = "SessionNote") => {
    setActiveProviderId(currentProviderId);
    setActiveContextKind(null);
    setActiveNoteKind(progressKind);
    setOverlayType("educatorTarget");
  };
  const returnToProgressOverlay = useCallback(() => {
    if (!activeProviderId || !client) return;

    const providerRole = client.providerClients.find(
      (providerClient) => providerClient.provider.id === activeProviderId
    )?.role;
    const progressKind: NoteEntryKind =
      providerRole === "SpeechPathologist" ? "SpeechProgress" : "SessionNote";
    const sessionEntry = client.entries?.find(
      (entry) =>
        entry.providerId === activeProviderId &&
        (entry.kind ?? "SessionNote") === progressKind
    );
    setActiveContextKind(null);
    setActiveNoteKind(progressKind);
    setOverlayType(sessionEntry ? "update" : "add");
  }, [activeProviderId, client]);
  const markProviderEntriesRead = useCallback((authorProviderId: string) => {
    if (!activeClientId) return;
    setEntryMutations((current) => [
      ...current,
      { type: "read", clientId: activeClientId, authorProviderId },
    ]);
    onEntryRead?.(activeClientId, authorProviderId);
  }, [activeClientId, onEntryRead]);
  const markProviderEntrySaved = useCallback((
    authorProviderId: string,
    entryId: string,
    visibility?: "Private" | "Shared",
    status?: string
  ) => {
    if (!activeClientId) return;
    setEntryMutations((current) => [
      ...current,
      {
        type: "saved",
        clientId: activeClientId,
        authorProviderId,
        entryId,
        kind: activeContextKind ?? activeNoteKind ?? "SessionNote",
        visibility,
        status,
      },
    ]);
    onEntrySaved?.(activeClientId, authorProviderId, entryId, visibility, status);
  }, [activeClientId, activeContextKind, activeNoteKind, onEntrySaved]);

  if (visibleClients.length === 0 || !client) return null;

  const shouldShowPosition = !(viewerRole === "Caregiver" && visibleClients.length === 1);
  const activeTeamFocus = client.teamFocusItems?.[0] ?? null;
  return (
    <div
      className="client-workspace-shell"
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      {activeTeamFocus ? (
        <button
          type="button"
          className="team-focus-indicator"
          aria-label="Open Team Focus"
          onClick={openTeamFocusViewOverlay}
        />
      ) : null}

      <div
        className="client-carousel-stage"
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
          viewerRole={viewerRole}
          onOpenNotes={openNotesOverlay}
          onOpenEntryForm={openEntryOverlay}
          onOpenAbcData={openAbcDataOverlay}
          onOpenTeamFocus={openTeamFocusOverlay}
          onOpenClientHandoff={openClientHandoffOverlay}
          onOpenEducatorTarget={openEducatorTargetOverlay}
        />
      </div>
      <AnimatePresence>
        {overlayType && (activeProviderId || overlayType === "clientHandoff") ? (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/25 backdrop-blur-[3px]"
              onClick={
                overlayType === "teamFocusView" || overlayType === "clientHandoff"
                  ? closeOverlay
                  : undefined
              }
            />
            <div
              className="absolute inset-0 flex items-center justify-center p-6"
              onClick={
                overlayType === "teamFocusView" || overlayType === "clientHandoff"
                  ? closeOverlay
                  : undefined
              }
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="paper-surface add-note-overlay-panel max-h-[calc(100vh-48px)] w-[min(1280px,92vw)] overflow-y-auto p-8"
                onClick={(event) => event.stopPropagation()}
              >
                {overlayType === "clientHandoff" ? (
                  <DashboardClientHandoffOverlay
                    clientId={client.id}
                    onClose={closeOverlay}
                  />
                ) : overlayType === "abc" && activeProviderId ? (
                  <DashboardAbcDataOverlay
                    clientId={client.id}
                    onClose={closeOverlay}
                    onSaved={(entryId, status) =>
                      markProviderEntrySaved(activeProviderId, entryId, undefined, status)
                    }
                  />
                ) : overlayType === "teamFocusView" ? (
                  <TeamFocusReadOverlay
                    teamFocus={activeTeamFocus}
                    onClose={closeOverlay}
                  />
                ) : overlayType === "teamFocus" ? (
                  <DashboardTeamFocusOverlay
                    clientId={client.id}
                    teamFocus={activeTeamFocus}
                    onClose={closeOverlay}
                    onSaved={(teamFocus) => {
                      onTeamFocusSaved?.(client.id, teamFocus);
                    }}
                  />
                ) : activeProviderId && isNoteOverlayType(overlayType) ? (
                  <DashboardNoteOverlay
                    overlayType={overlayType}
                    clientId={client.id}
                    providerId={activeProviderId}
                    noteKind={activeNoteKind}
                    contextKind={activeContextKind}
                    onClose={closeOverlay}
                    onRead={markProviderEntriesRead}
                    onSaved={markProviderEntrySaved}
                    onReturnToProgress={returnToProgressOverlay}
                  />
                ) : null}
              </motion.div>
            </div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function isNoteOverlayType(
  overlayType: OverlayType
): overlayType is "view" | "add" | "update" | "educatorTarget" {
  return (
    overlayType === "view" ||
    overlayType === "add" ||
    overlayType === "update" ||
    overlayType === "educatorTarget"
  );
}

function TeamFocusReadOverlay({
  teamFocus,
  onClose,
}: {
  teamFocus: TeamFocusData | null;
  onClose: () => void;
}) {
  const authorName = teamFocus
    ? `${teamFocus.author.firstName} ${teamFocus.author.lastName}`.trim()
    : "";
  const authorRole = teamFocus ? teamFocusRoleLabel(teamFocus.author.role) : "";

  if (!teamFocus) {
    return null;
  }

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
        aria-label="Close Team Focus"
      >
        ×
      </button>

      <div style={{ fontSize: 24, fontWeight: 650 }}>Team Focus</div>

      <div
        className="paper-surface"
        style={{
          width: "min(420px, 82vw)",
          minHeight: 420,
          aspectRatio: "4 / 5",
          boxSizing: "border-box",
          padding: "34px 32px",
          display: "grid",
          alignContent: "center",
          gap: 28,
        }}
      >
        {teamFocus.title ? (
          <div style={{ fontSize: 18, fontWeight: 650, lineHeight: 1.35 }}>
            {teamFocus.title}
          </div>
        ) : null}

        <div style={{ fontSize: 16, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {teamFocus.content}
        </div>

        <div style={{ display: "grid", gap: 4, alignSelf: "end" }}>
          <div style={{ fontWeight: 650 }}>
            {authorName || "Supervisor"} {authorRole ? `— ${authorRole}` : null}
          </div>
          <div style={{ fontSize: 13, opacity: 0.66 }}>
            {new Date(teamFocus.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function teamFocusRoleLabel(role: string) {
  switch (role) {
    case "Supervisor":
      return "BCBA";
    case "BehaviorTherapist":
      return "Behavior Technician";
    case "SpeechPathologist":
      return "Speech Pathologist";
    case "OccupationalTherapist":
      return "Occupational Therapist";
    default:
      return role;
  }
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
  kind: string | undefined,
  visibility: string | undefined,
  status: string | undefined,
  currentProviderId: string
) {
  return clients.map((client) => {
    if (client.id !== clientId) return client;

    const entries = client.entries ?? [];
    const hasEntry = entries.some((entry) => entry.id === entryId);
    const nextEntry = {
      id: entryId,
      providerId: authorProviderId,
      kind,
      visibility,
      status,
      reads: visibility === "Private" ? [] : [{ readAt: null }],
    };

    return {
      ...client,
      entries: hasEntry
        ? entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  providerId: authorProviderId,
                  kind: kind ?? entry.kind,
                  visibility: visibility ?? entry.visibility,
                  status: status ?? entry.status,
                  reads:
                    visibility === "Private"
                      ? []
                      : authorProviderId === currentProviderId
                        ? [{ readAt: null }]
                        : entry.reads,
                }
              : entry
          )
        : [...entries, nextEntry],
      recentEntries: mergeRecentEntry(
        client.recentEntries ?? [],
        entryId,
        authorProviderId,
        status
      ),
    };
  });
}

function mergeRecentEntry(
  recentEntries: NonNullable<CarouselClient["recentEntries"]>,
  entryId: string,
  providerId: string,
  status?: string
) {
  if (recentEntries.some((entry) => entry.id === entryId)) {
    return recentEntries;
  }

  return [...recentEntries, { id: entryId, providerId, status }];
}
