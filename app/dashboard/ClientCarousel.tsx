"use client";

/**
 * Dashboard controller for moving between assigned clients.
 * It owns overlay selection and delegates the visible constellation to
 * ClientOrbit; the overlays themselves remain focused presentation modules.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { CaretakerContextKind } from "@/app/libs/caretakerContext";
import type { NoteEntryKind } from "@/app/libs/entryKinds";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import ClientOrbit from "./ClientOrbit";
import DashboardAbcDataOverlay from "./DashboardAbcDataOverlay";
import DashboardClientHandoffOverlay from "./DashboardClientHandoffOverlay";
import DashboardNoteOverlay from "./DashboardNoteOverlay";
import DashboardTeamFocusOverlay from "./DashboardTeamFocusOverlay";
import { ClientCarouselNavigation } from "./ClientCarouselNavigation";
import { ClientCarouselSlide } from "./ClientCarouselSlide";
import {
  TEAM_FOCUS_CAROUSEL_READY_EVENT,
  TEAM_FOCUS_OPEN_EVENT,
} from "./TeamFocusSignalControl";
import { useGuardedSwipe } from "@/components/useGuardedSwipe";
import { applyDashboardEntryMutations } from "./clientCarouselModel";
import { markClientSignalRead } from "@/app/actions/markClientSignalRead";
import { claimPublicationAnnouncement } from "./notePublicationFeedback";
import {
  isDashboardFocusedDataEntry,
  type DashboardOverlayType,
} from "./dashboardOverlayState";
import {
  dashboardOrbitPresentationKey,
} from "./dashboardOrbitRestoration";
import { traceDashboardInteractionState } from "./dashboardInteractionTraceClient";
import type {
  DashboardClient,
  DashboardEntryMutation,
  DashboardTeamFocus,
} from "./dashboardClientTypes";

type ClientCarouselProps = {
  clients: DashboardClient[];
  currentProviderId: string;
  viewerRole?: string;
  initialClientId?: string;
  onActiveClientChange?: (clientId: string) => void;
  onEntryRead?: (clientId: string, authorProviderId: string) => void;
  onClientSignalRead?: (clientId: string) => void;
  onEntrySaved?: (
    clientId: string,
    authorProviderId: string,
    entryId: string,
    visibility?: "Private" | "Shared",
    status?: string
  ) => void;
  onTeamFocusSaved?: (clientId: string, teamFocus: DashboardTeamFocus) => void;
  onFocusedDataEntryChange?: (active: boolean) => void;
};

const DASHBOARD_OVERLAY_HISTORY_KEY = "autConnectDashboardOverlay";
// Leave a narrow strip to the browser for native edge navigation gestures.
const DASHBOARD_BROWSER_EDGE_GUARD_PX = 24;
const DASHBOARD_SWIPE_BLOCKING_SELECTOR =
  "[role='menu'], [role='dialog'], [aria-modal='true']";

export default function ClientCarousel({
  clients,
  currentProviderId,
  viewerRole,
  initialClientId,
  onActiveClientChange,
  onEntryRead,
  onClientSignalRead,
  onEntrySaved,
  onTeamFocusSaved,
  onFocusedDataEntryChange,
}: ClientCarouselProps) {
  const [entryMutations, setEntryMutations] = useState<DashboardEntryMutation[]>([]);
  const [publicationConfirmationId, setPublicationConfirmationId] = useState<
    number | null
  >(null);
  const publicationConfirmationSequenceRef = useRef(0);
  const announcedPublicationEventsRef = useRef(new Set<string>());
  const prefersReducedMotion = useReducedMotion();
  const visibleClients = useMemo(
    () => applyDashboardEntryMutations(clients, entryMutations, currentProviderId),
    [clients, currentProviderId, entryMutations]
  );
  const initialIndex = (() => {
    if (!initialClientId || visibleClients.length === 0) return 0;
    const matchedIndex = visibleClients.findIndex((c) => c.id === initialClientId);
    return matchedIndex >= 0 ? matchedIndex : 0;
  })();
  const [index, setIndex] = useState(initialIndex);
  const [overlayType, setOverlayType] = useState<DashboardOverlayType>(null);
  const focusedDataEntry = isDashboardFocusedDataEntry(overlayType);
  const [activeContextKind, setActiveContextKind] =
    useState<CaretakerContextKind | null>(null);
  const [activeNoteKind, setActiveNoteKind] = useState<NoteEntryKind | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [useCompactOverlayMotion, setUseCompactOverlayMotion] = useState(false);
  const overlayHistoryActiveRef = useRef(false);
  const overlayHistoryClosingRef = useRef(false);
  const pendingOverlayOpenRef = useRef<null | (() => void)>(null);

  useLayoutEffect(() => {
    onFocusedDataEntryChange?.(focusedDataEntry);
  }, [focusedDataEntry, onFocusedDataEntryChange]);

  useLayoutEffect(
    () => () => onFocusedDataEntryChange?.(false),
    [onFocusedDataEntryChange]
  );

  useEffect(() => {
    traceDashboardInteractionState(
      focusedDataEntry ? "focused-workflow" : "orbit"
    );
  }, [focusedDataEntry]);

  const clearOverlay = useCallback(() => {
    setOverlayType(null);
    setActiveProviderId(null);
    setActiveContextKind(null);
    setActiveNoteKind(null);
  }, []);
  const closeOverlay = useCallback(() => {
    if (overlayHistoryActiveRef.current) {
      // Give touch interactions immediate visual feedback. History still moves
      // back one layer, but the UI no longer waits for the popstate event.
      overlayHistoryActiveRef.current = false;
      overlayHistoryClosingRef.current = true;
      clearOverlay();
      window.history.back();
      return;
    }
    clearOverlay();
  }, [clearOverlay]);
  const prepareOverlayHistory = useCallback(() => {
    if (overlayHistoryActiveRef.current) {
      return;
    }

    overlayHistoryActiveRef.current = true;
    window.history.pushState(
      {
        ...window.history.state,
        [DASHBOARD_OVERLAY_HISTORY_KEY]: true,
      },
      ""
    );
  }, []);
  const openOverlayLayer = useCallback(
    (open: () => void) => {
      if (overlayHistoryClosingRef.current) {
        pendingOverlayOpenRef.current = open;
        return;
      }

      prepareOverlayHistory();
      open();
    },
    [prepareOverlayHistory]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 700px)");
    const updateMotionPreference = () => {
      setUseCompactOverlayMotion(mediaQuery.matches);
    };

    updateMotionPreference();
    mediaQuery.addEventListener?.("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener?.("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (overlayHistoryClosingRef.current) {
        overlayHistoryClosingRef.current = false;
        const pendingOpen = pendingOverlayOpenRef.current;
        pendingOverlayOpenRef.current = null;
        if (pendingOpen) {
          prepareOverlayHistory();
          pendingOpen();
        }
        return;
      }

      if (!overlayHistoryActiveRef.current) {
        return;
      }

      overlayHistoryActiveRef.current = false;
      clearOverlay();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [clearOverlay, prepareOverlayHistory]);

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

  useEffect(() => {
    if (publicationConfirmationId === null) return;
    const timeoutId = window.setTimeout(() => {
      setPublicationConfirmationId((current) =>
        current === publicationConfirmationId ? null : current
      );
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [publicationConfirmationId]);

  const safeIndex = Math.min(index, visibleClients.length - 1);
  const client = visibleClients[safeIndex];
  const activePresentationKey = client
    ? dashboardOrbitPresentationKey(client, currentProviderId)
    : "";
  const clientEntries = client?.entries;
  const activeClientId = client?.id ?? "";

  useEffect(() => {
    if (!activeClientId) return;

    const readyTimeout = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(TEAM_FOCUS_CAROUSEL_READY_EVENT, {
          detail: { clientId: activeClientId },
        })
      );
    }, 650);

    return () => window.clearTimeout(readyTimeout);
  }, [activeClientId]);

  const prev = useCallback(() => {
    if (safeIndex <= 0) return;
    setIndex((current) => Math.max(0, current - 1));
  }, [safeIndex]);
  const next = useCallback(() => {
    if (safeIndex >= visibleClients.length - 1) return;
    setIndex((current) =>
      Math.min(Math.max(visibleClients.length - 1, 0), current + 1)
    );
  }, [safeIndex, visibleClients.length]);
  const clientSwipe = useGuardedSwipe({
    onSwipeLeft: next,
    onSwipeRight: prev,
    canSwipeLeft: safeIndex < visibleClients.length - 1,
    canSwipeRight: safeIndex > 0,
    disabled: overlayType !== null || visibleClients.length < 2,
    edgeGuard: DASHBOARD_BROWSER_EDGE_GUARD_PX,
    blockingSelector: DASHBOARD_SWIPE_BLOCKING_SELECTOR,
  });

  const openNotesOverlay = (providerId: string) => {
    openOverlayLayer(() => {
      setActiveProviderId(providerId);
      setOverlayType("view");
    });
  };
  const openEntryOverlay = (
    providerId: string,
    nextOverlayType: "add" | "update",
    entryKind?: CaretakerContextKind | NoteEntryKind
  ) => {
    openOverlayLayer(() => {
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
    });
  };
  const openAbcDataOverlay = (providerId: string) => {
    openOverlayLayer(() => {
      setActiveProviderId(providerId);
      setActiveContextKind(null);
      setActiveNoteKind("SessionNote");
      setOverlayType("abc");
    });
  };
  const openTeamFocusOverlay = useCallback(() => {
    openOverlayLayer(() => {
      setActiveProviderId(currentProviderId);
      setOverlayType("teamFocus");
    });
  }, [currentProviderId, openOverlayLayer]);
  const openTeamFocusViewOverlay = useCallback(() => {
    openOverlayLayer(() => {
      setActiveProviderId(currentProviderId);
      setOverlayType("teamFocusView");
    });
  }, [currentProviderId, openOverlayLayer]);

  useEffect(() => {
    const openFromUtilityControl = (event: Event) => {
      const detail = (
        event as CustomEvent<{ clientId?: string; mode?: "edit" | "view" }>
      ).detail;
      if (detail?.clientId !== activeClientId) return;
      if (detail.mode === "edit") {
        openTeamFocusOverlay();
        return;
      }
      if (client.teamFocusItems?.[0]) {
        openTeamFocusViewOverlay();
      }
    };

    window.addEventListener(TEAM_FOCUS_OPEN_EVENT, openFromUtilityControl);
    return () =>
      window.removeEventListener(TEAM_FOCUS_OPEN_EVENT, openFromUtilityControl);
  }, [
    activeClientId,
    client.teamFocusItems,
    openTeamFocusOverlay,
    openTeamFocusViewOverlay,
  ]);
  const openClientHandoffOverlay = () => {
    if (
      client.signal?.color !== "neutral" &&
      client.signal?.isUnread &&
      client.signal.sessionDate
    ) {
      onClientSignalRead?.(client.id);
      void markClientSignalRead({
        clientId: client.id,
        sessionDate: client.signal.sessionDate,
      });
    }
    openOverlayLayer(() => {
      setActiveProviderId(null);
      setOverlayType("clientHandoff");
    });
  };
  const openEducatorTargetOverlay = (progressKind: NoteEntryKind = "SessionNote") => {
    openOverlayLayer(() => {
      setActiveProviderId(currentProviderId);
      setActiveContextKind(null);
      setActiveNoteKind(progressKind);
      setOverlayType("educatorTarget");
    });
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
  }, [
    activeClientId,
    activeContextKind,
    activeNoteKind,
    onEntrySaved,
  ]);
  const markProviderSessionCompleted = useCallback((
    authorProviderId: string,
    completedEntryIds: string[]
  ) => {
    if (!activeClientId || completedEntryIds.length === 0) return;

    const entriesById = new Map(
      (clientEntries ?? []).map((entry) => [entry.id, entry])
    );
    setEntryMutations((current) => [
      ...current,
      ...completedEntryIds.map((entryId) => {
        const entry = entriesById.get(entryId);
        return {
          type: "saved" as const,
          clientId: activeClientId,
          authorProviderId,
          entryId,
          kind: entry?.kind,
          visibility: entry?.visibility,
          status: "COMPLETED",
        };
      }),
    ]);

    completedEntryIds.forEach((entryId) => {
      const entry = entriesById.get(entryId);
      onEntrySaved?.(
        activeClientId,
        authorProviderId,
        entryId,
        entry?.visibility === "Private" ? "Private" : "Shared",
        "COMPLETED"
      );
    });

    if (
      authorProviderId === currentProviderId &&
      claimPublicationAnnouncement(announcedPublicationEventsRef.current, {
        clientId: activeClientId,
        authorProviderId,
        completedEntryIds,
      })
    ) {
      publicationConfirmationSequenceRef.current += 1;
      setPublicationConfirmationId(publicationConfirmationSequenceRef.current);
    }
  }, [activeClientId, clientEntries, currentProviderId, onEntrySaved]);

  if (visibleClients.length === 0 || !client) return null;

  const shouldShowPosition = !(viewerRole === "Caregiver" && visibleClients.length === 1);
  const activeTeamFocus = client.teamFocusItems?.[0] ?? null;
  const viewerProviderClient = client.providerClients.find(
    ({ provider }) => provider.id === currentProviderId
  );
  const authenticatedDisplayName = viewerProviderClient
    ? formatProviderDisplayName(
        viewerProviderClient.provider.firstName,
        viewerProviderClient.provider.lastName
      )
    : undefined;
  const authenticatedRole =
    viewerRole ?? viewerProviderClient?.role;
  const usesFullScreenWorkspacePanel =
    overlayType === "abc" ||
    overlayType === "teamFocus" ||
    isNoteOverlayType(overlayType);
  return (
    <div
      className="client-workspace-shell"
      data-dashboard-focused-workflow={focusedDataEntry ? "true" : undefined}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        className="client-carousel-stage"
        data-dashboard-presentation-key={activePresentationKey}
        data-team-focus-carousel-client={activeClientId}
        data-team-focus-carousel-ready="true"
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          paddingLeft: "clamp(10px, 4vw, 24px)",
          paddingRight: "clamp(10px, 4vw, 24px)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          touchAction: "pan-y",
        }}
        {...clientSwipe.swipeHandlers}
      >
        <ClientCarouselNavigation
          currentIndex={safeIndex}
          clientCount={visibleClients.length}
          showPosition={shouldShowPosition}
          onPrevious={prev}
          onNext={next}
          canPrevious={safeIndex > 0}
          canNext={safeIndex < visibleClients.length - 1}
        />

        <ClientCarouselSlide
          key={client.id}
          dragOffset={clientSwipe.dragOffset}
        >
          <ClientOrbit
            client={client}
            currentProviderId={currentProviderId}
            presentationKey={activePresentationKey}
            viewerRole={viewerRole}
            suspendMenuDismiss={overlayType !== null}
            onOpenNotes={openNotesOverlay}
            onOpenEntryForm={openEntryOverlay}
            onOpenAbcData={openAbcDataOverlay}
            onOpenClientHandoff={openClientHandoffOverlay}
            onOpenEducatorTarget={openEducatorTargetOverlay}
            onSessionCompleted={markProviderSessionCompleted}
          />
        </ClientCarouselSlide>
      </div>
      <AnimatePresence>
        {publicationConfirmationId !== null ? (
          <motion.div
            key={publicationConfirmationId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            style={{
              position: "fixed",
              top: "max(84px, calc(env(safe-area-inset-top) + 70px))",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 140,
              padding: "10px 16px",
              borderRadius: 12,
              background: "var(--glass-strong)",
              color: "var(--foreground)",
              boxShadow: "var(--shadow-soft)",
              fontSize: 14,
              fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            Note published
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {overlayType && (activeProviderId || overlayType === "clientHandoff") ? (
          <div
            className="fixed inset-0 z-50"
            data-dashboard-trace-layer="workflow-overlay"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: useCompactOverlayMotion ? 0.06 : 0.15 }}
              className="absolute inset-0 bg-black/25 backdrop-blur-[3px]"
              onClick={
                overlayType === "teamFocusView" || overlayType === "clientHandoff"
                  ? closeOverlay
                  : undefined
              }
            />
            <div
              className={`absolute inset-0 flex items-center justify-center ${
                usesFullScreenWorkspacePanel
                  ? "p-6 max-[700px]:p-0"
                  : overlayType === "clientHandoff" || overlayType === "teamFocusView"
                    ? "p-6 max-[700px]:p-2"
                  : "p-6"
              }`}
              onClick={
                overlayType === "teamFocusView" || overlayType === "clientHandoff"
                  ? closeOverlay
                  : undefined
              }
            >
              <motion.div
                initial={
                  useCompactOverlayMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96 }
                }
                animate={
                  useCompactOverlayMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1 }
                }
                exit={
                  useCompactOverlayMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96 }
                }
                transition={{
                  duration: useCompactOverlayMotion ? 0.08 : 0.18,
                  ease: "easeOut",
                }}
                className={`paper-surface add-note-overlay-panel max-h-[calc(100vh-48px)] w-[min(1280px,92vw)] overflow-y-auto p-8 ${
                  usesFullScreenWorkspacePanel
                    ? "clinical-note-overlay-panel"
                    : overlayType === "clientHandoff" || overlayType === "teamFocusView"
                      ? "dashboard-reading-overlay-panel"
                    : ""
                }`}
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
                    authenticatedDisplayName={authenticatedDisplayName}
                    authenticatedRole={authenticatedRole}
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
  overlayType: DashboardOverlayType
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
  teamFocus: DashboardTeamFocus | null;
  onClose: () => void;
}) {
  const authorName = teamFocus
    ? formatProviderDisplayName(
        teamFocus.author.firstName,
        teamFocus.author.lastName
      )
    : "";
  const authorRole = teamFocus ? teamFocusRoleLabel(teamFocus.author.role) : "";

  if (!teamFocus) {
    return null;
  }

  return (
    <div
      className="team-focus-read-layout"
      style={{
        position: "relative",
        display: "grid",
        justifyItems: "center",
        gap: 22,
        color: "var(--team-focus-text)",
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

      <div className="team-focus-read-heading" style={{ fontSize: 24, fontWeight: 650 }}>
        Team Focus
      </div>

      <div
        className="paper-surface team-focus-read-card"
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
          <div
            className="team-focus-read-title"
            style={{ fontSize: 18, fontWeight: 650, lineHeight: 1.35 }}
          >
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
            {new Date(teamFocus.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {teamFocus.revisions?.length ? (
        <details
          className="paper-surface"
          style={{ width: "min(420px, 82vw)", padding: "15px 18px" }}
        >
          <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 650 }}>
            Earlier updates ({teamFocus.revisions.length})
          </summary>
          <div style={{ display: "grid", gap: 18, paddingTop: 16 }}>
            {teamFocus.revisions.map((revision) => (
              <article
                key={revision.id}
                style={{
                  display: "grid",
                  gap: 8,
                  paddingTop: 15,
                  borderTop: "1px solid var(--team-focus-divider)",
                }}
              >
                {revision.title ? (
                  <div style={{ fontSize: 15, fontWeight: 650 }}>
                    {revision.title}
                  </div>
                ) : null}
                <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {revision.content}
                </div>
                <div style={{ fontSize: 12, opacity: 0.64 }}>
                  {formatProviderDisplayName(
                    revision.author.firstName,
                    revision.author.lastName
                  )}
                  {" · "}
                  {new Date(revision.createdAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </article>
            ))}
          </div>
        </details>
      ) : null}
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
