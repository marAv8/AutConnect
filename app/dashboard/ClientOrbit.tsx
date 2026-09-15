"use client";

/**
 * The central client-and-provider constellation shown inside the dashboard.
 * It translates persisted note state into the client badge, provider controls,
 * completion toruses, and callbacks that open each documentation overlay.
 */

import { completeSessionNote } from "@/app/actions/completeSessionNote";
import type { CaretakerContextKind } from "@/app/libs/caretakerContext";
import type { DashboardEntryKind, NoteEntryKind } from "@/app/libs/entryKinds";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, FilePenLine, Plus } from "lucide-react";
import { formatBadgeRole } from "@/app/libs/roles";
import { formatCompactProviderBadgeName } from "@/app/libs/providerDisplayName";
import {
  CLIENT_ORBIT_LAYOUT,
  preferredCurrentProviderSlot,
  providerOrbitPoint,
  resolveProviderActionPopoverPosition,
  responsiveClientOrbitScale,
  type ProviderActionPopoverPosition,
} from "./clientOrbitLayout";
import type { DashboardClient } from "./dashboardClientTypes";
import { providerSignalState } from "./providerSignalState";
import { transitionToSessionCompletionConfirmation } from "./clientOrbitCompletion";
import { prepareFieldObservationNavigation } from "./fieldObservationNavigation";
import { traceDashboardInteractionHandled, traceDashboardInteractionState } from "./dashboardInteractionTraceClient";
import { readDashboardOrbitReturnMarker } from "./dashboardOrbitRestoration";

type ClientOrbitProps = {
  client: DashboardClient;
  currentProviderId: string;
  presentationKey: string;
  viewerRole?: string;
  suspendMenuDismiss?: boolean;
  onOpenNotes: (providerId: string) => void;
  onOpenEntryForm: (
    providerId: string,
    overlayType: "add" | "update",
    entryKind?: CaretakerContextKind | NoteEntryKind
  ) => void;
  onOpenAbcData: (providerId: string) => void;
  onOpenClientHandoff: () => void;
  onOpenEducatorTarget: (progressKind?: NoteEntryKind) => void;
  onSessionCompleted?: (
    providerId: string,
    completedEntryIds: string[]
  ) => void;
};

const abcDataRoles = new Set([
  "Supervisor",
  "BehaviorTherapist",
  "Caregiver",
]);

const MIN_CLIENT_BADGE_SIZE = 108;
const MIN_PROVIDER_BADGE_SIZE = 78;
const MIN_ACTION_BADGE_SIZE = 24;
const ORBIT_EDGE_CLEARANCE = 2;
const PROVIDER_REVEAL_SPAN_MS = 180;
const PROVIDER_REVEAL_JITTER_MS = 18;
const PROVIDER_FADE_MIN_MS = 180;
const PROVIDER_FADE_MAX_MS = 300;

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

function isReadableEntryKind(kind?: string) {
  return readableEntryKinds.has((kind ?? "SessionNote") as DashboardEntryKind);
}

function ProviderActionControl({
  ariaLabel,
  isOwnControl,
  isSignal,
  isDimmed,
  hasTodayEntry,
  isPublished,
  signalEventKey,
  style,
  onActivate,
}: {
  ariaLabel: string;
  isOwnControl: boolean;
  isSignal: boolean;
  isDimmed: boolean;
  hasTodayEntry: boolean;
  isPublished: boolean;
  signalEventKey: string | null;
  style: CSSProperties;
  onActivate: (anchor: HTMLButtonElement) => void;
}) {
  const [isPulsing, setIsPulsing] = useState(false);
  const playedSignalEventKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignal || !signalEventKey) return;
    if (playedSignalEventKey.current === signalEventKey) return;

    let frame = 0;
    let pulseTimeout = 0;
    const startTimeout = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => {
        playedSignalEventKey.current = signalEventKey;
        setIsPulsing(true);
        pulseTimeout = window.setTimeout(() => setIsPulsing(false), 1040);
      });
    }, 320);

    return () => {
      window.clearTimeout(startTimeout);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(pulseTimeout);
    };
  }, [isSignal, signalEventKey]);

  return (
    <button
      className={`glass-badge-action${
        isSignal ? " glass-badge-action--signal" : ""
      }${isDimmed ? " glass-badge-action--signal-dimmed" : ""}${
        isPulsing ? " glass-badge-action--signal-pulse" : ""
      }`}
      data-own-note-menu={isOwnControl ? "true" : undefined}
      data-dashboard-trace-control={isOwnControl ? "provider-action" : undefined}
      data-swipe-ignore="true"
      data-spatial-hit-target="true"
      onClick={(event) => {
        event.stopPropagation();
        if (isOwnControl) traceDashboardInteractionHandled("provider-action");
        onActivate(event.currentTarget);
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={style}
    >
      {isSignal ? null : hasTodayEntry ? (
        <span
          aria-hidden="true"
          style={{ display: "inline-flex", position: "relative" }}
        >
          <FilePenLine size={14} strokeWidth={1.9} />
          {isPublished ? (
            <Check
              size={9}
              strokeWidth={2.5}
              style={{ position: "absolute", right: -5, bottom: -3 }}
            />
          ) : null}
        </span>
      ) : (
        <Plus aria-hidden="true" size={14} strokeWidth={2} />
      )}
    </button>
  );
}

export default function ClientOrbit({
  client,
  currentProviderId,
  presentationKey,
  viewerRole,
  suspendMenuDismiss = false,
  onOpenNotes,
  onOpenEntryForm,
  onOpenAbcData,
  onOpenClientHandoff,
  onOpenEducatorTarget,
  onSessionCompleted,
}: ClientOrbitProps) {
  const router = useRouter();
  const [menuProviderId, setMenuProviderId] = useState<string | null>(null);
  const [isOwnMenuClosing, setIsOwnMenuClosing] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const pendingOwnMenuActionRef = useRef<null | (() => void)>(null);
  const [providerMenuPosition, setProviderMenuPosition] =
    useState<ProviderActionPopoverPosition | null>(null);
  const [ownMenuMode, setOwnMenuMode] = useState<"primary" | "update">(
    "primary"
  );
  useEffect(() => {
    traceDashboardInteractionState(!menuProviderId ? "documentation-closed"
      : isOwnMenuClosing ? "documentation-closing"
      : ownMenuMode === "update" ? "documentation-update" : "documentation-open");
  }, [menuProviderId, isOwnMenuClosing, ownMenuMode]);
  const [completionStatus, setCompletionStatus] = useState<
    Record<string, "idle" | "saving" | "error">
  >({});
  const [pendingCompletionProviderId, setPendingCompletionProviderId] =
    useState<string | null>(null);
  const [completedProviderIds, setCompletedProviderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [orbitScale, setOrbitScale] = useState(1);
  const orbitRef = useRef<HTMLDivElement | null>(null);
  const setOrbitNode = useCallback((node: HTMLDivElement | null) => {
    orbitRef.current = node;
  }, []);

  const {
    providerDistance: baseProviderDistance,
    orbitSize: baseOrbitSize,
    clientBadgeSize: baseCenterSize,
    providerBadgeSize: baseSpokeSize,
    actionBadgeSize: baseBadgeSize,
  } = CLIENT_ORBIT_LAYOUT;
  const orbitSize = baseOrbitSize * orbitScale;
  const centerSize = Math.max(
    MIN_CLIENT_BADGE_SIZE,
    baseCenterSize * orbitScale
  );
  const spokeSize = Math.max(
    MIN_PROVIDER_BADGE_SIZE,
    baseSpokeSize * orbitScale
  );
  const badgeSize = Math.max(
    MIN_ACTION_BADGE_SIZE,
    baseBadgeSize * orbitScale
  );
  const providerDistance = Math.min(
    baseProviderDistance * orbitScale,
    Math.max(
      0,
      orbitSize / 2 - spokeSize / 2 - ORBIT_EDGE_CLEARANCE * orbitScale
    )
  );

  const providers = (() => {
    const arrangedProviders = [...client.providerClients];
    const currentIndex = arrangedProviders.findIndex(
      (providerClient) => providerClient.provider.id === currentProviderId
    );

    if (currentIndex < 0) {
      return arrangedProviders;
    }

    const preferredIndex = preferredCurrentProviderSlot(arrangedProviders.length);
    [arrangedProviders[currentIndex], arrangedProviders[preferredIndex]] = [
      arrangedProviders[preferredIndex],
      arrangedProviders[currentIndex],
    ];

    return arrangedProviders;
  })();
  const getProviderSignalState = (providerId: string, isMe: boolean) => {
    const readableEntriesForProvider = (client.entries ?? []).filter(
      (entry) => entry.providerId === providerId && isReadableEntryKind(entry.kind)
    );
    const signalState = providerSignalState({
      entries: readableEntriesForProvider,
      isCurrentProvider: isMe,
      locallyCompleted: isMe && completedProviderIds.has(providerId),
    });

    return {
      readableEntriesForProvider,
      hasCompletedSessionNote: signalState.hasCompletedNote,
      showSignal: signalState.showSignal,
      isSignalDimmed: signalState.isSignalDimmed,
      showAction: signalState.showAction,
      signalEventKey:
        signalState.showSignal && signalState.hasUnreadNote
          ? [
              currentProviderId,
              client.id,
              providerId,
              signalState.completedEntryIds.length > 0
                ? signalState.completedEntryIds.join("|")
                : "newly-completed",
            ].join(":")
          : null,
    };
  };
  const dismissOwnNotesPrompt = useCallback(() => {
    setMenuProviderId(null);
    setIsOwnMenuClosing(false);
    menuAnchorRef.current = null;
    setProviderMenuPosition(null);
    setOwnMenuMode("primary");
  }, []);
  const completeOwnNotesPromptDismiss = useCallback(() => {
    const nextAction = pendingOwnMenuActionRef.current;
    pendingOwnMenuActionRef.current = null;
    flushSync(dismissOwnNotesPrompt);
    nextAction?.();
  }, [dismissOwnNotesPrompt]);
  const beginOwnNotesPromptDismiss = useCallback(
    (nextAction?: () => void) => {
      if (!menuProviderId || isOwnMenuClosing) return;

      pendingOwnMenuActionRef.current = nextAction ?? null;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        completeOwnNotesPromptDismiss();
        return;
      }
      setIsOwnMenuClosing(true);
    },
    [completeOwnNotesPromptDismiss, isOwnMenuClosing, menuProviderId]
  );
  const positionProviderMenu = useCallback((anchor: HTMLButtonElement) => {
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    setProviderMenuPosition(
      resolveProviderActionPopoverPosition(rect, {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      })
    );
  }, []);
  const requestOwnNotesPromptDismiss = useCallback(() => {
    beginOwnNotesPromptDismiss();
  }, [beginOwnNotesPromptDismiss]);
  const leaveOwnNotesMenu = useCallback(
    (nextAction: () => void) => {
      // Let the existing material exit reach its invisible keyframe before a
      // same-page workflow records the underlying screen in browser history.
      beginOwnNotesPromptDismiss(nextAction);
    },
    [beginOwnNotesPromptDismiss]
  );
  const openSessionCompletionConfirmation = useCallback(
    (providerId: string) => {
      transitionToSessionCompletionConfirmation(
        providerId,
        () => flushSync(dismissOwnNotesPrompt),
        setPendingCompletionProviderId
      );
    },
    [dismissOwnNotesPrompt]
  );
  const openCaseSupport = useCallback(
    (mode: "open" | "request") => {
      router.push(
        mode === "open"
          ? `/portal/case-support/${client.id}`
          : `/portal/case-support/request/${client.id}`
      );
    },
    [client.id, router]
  );
  const openFieldObservation = useCallback(() => {
    router.push(
      prepareFieldObservationNavigation(client.id, presentationKey)
    );
  }, [client.id, presentationKey, router]);
  const toggleOwnNotesMenu = useCallback(
    (providerId: string, anchor: HTMLButtonElement) => {
      if (menuProviderId === providerId) {
        dismissOwnNotesPrompt();
        return;
      }

      menuAnchorRef.current = anchor;
      positionProviderMenu(anchor);
      setMenuProviderId(providerId);
      setOwnMenuMode("primary");
    },
    [dismissOwnNotesPrompt, menuProviderId, positionProviderMenu]
  );
  useLayoutEffect(() => {
    const orbit = orbitRef.current;
    if (!orbit) return;

    const providerNodes = Array.from(
      orbit.querySelectorAll<HTMLElement>(".provider-orbit-node")
    );
    const shuffledNodes = [...providerNodes];
    const revealListeners: Array<{
      layer: HTMLElement;
      listener: (event: AnimationEvent) => void;
    }> = [];

    const isRestoredPresentation = Boolean(
      readDashboardOrbitReturnMarker({
        historyState: window.history.state,
        clientId: client.id,
        presentationKey,
      })
    );

    if (isRestoredPresentation) {
      providerNodes.forEach((node) => {
        node.classList.remove("provider-orbit-node--ready");
        node.classList.add("provider-orbit-node--settled");
      });
      return () => {
        providerNodes.forEach((node) => {
          node.classList.remove("provider-orbit-node--settled");
        });
      };
    }

    for (let index = shuffledNodes.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledNodes[index], shuffledNodes[swapIndex]] = [
        shuffledNodes[swapIndex],
        shuffledNodes[index],
      ];
    }

    shuffledNodes.forEach((node, revealIndex) => {
      const distributedDelay =
        shuffledNodes.length <= 1
          ? 0
          : (revealIndex / (shuffledNodes.length - 1)) *
            PROVIDER_REVEAL_SPAN_MS;
      const jitter =
        (Math.random() * 2 - 1) * PROVIDER_REVEAL_JITTER_MS;
      const delay = Math.max(0, Math.round(distributedDelay + jitter));
      const duration = Math.round(
        PROVIDER_FADE_MIN_MS +
          Math.random() * (PROVIDER_FADE_MAX_MS - PROVIDER_FADE_MIN_MS)
      );

      node.style.setProperty("--provider-reveal-delay", `${delay}ms`);
      node.style.setProperty("--provider-reveal-duration", `${duration}ms`);
      node.classList.remove("provider-orbit-node--settled");
      node.classList.add("provider-orbit-node--ready");

      const layer = node.querySelector<HTMLElement>(
        ".provider-badge-reveal-layer"
      );
      if (layer) {
        const settleReveal = (event: AnimationEvent) => {
          if (event.animationName !== "provider-badge-reveal") return;
          node.classList.remove("provider-orbit-node--ready");
          node.classList.add("provider-orbit-node--settled");
          node.style.removeProperty("--provider-reveal-delay");
          node.style.removeProperty("--provider-reveal-duration");
        };
        layer.addEventListener("animationend", settleReveal);
        revealListeners.push({ layer, listener: settleReveal });
      }
    });

    return () => {
      revealListeners.forEach(({ layer, listener }) => {
        layer.removeEventListener("animationend", listener);
      });
      providerNodes.forEach((node) => {
        node.classList.remove("provider-orbit-node--ready");
        node.classList.remove("provider-orbit-node--settled");
        node.style.removeProperty("--provider-reveal-delay");
        node.style.removeProperty("--provider-reveal-duration");
      });
    };
  }, [client.id, presentationKey]);
  useLayoutEffect(() => {
    const orbitStage = orbitRef.current?.closest<HTMLElement>(
      ".client-carousel-stage"
    );
    if (!orbitStage) return;

    const updateScale = (availableWidth: number, availableHeight: number) => {
      const nextScale = responsiveClientOrbitScale(
        availableWidth,
        availableHeight
      );
      setOrbitScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.001
          ? currentScale
          : nextScale
      );
    };
    const updateScaleFromLiveStage = () => {
      const styles = window.getComputedStyle(orbitStage);
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft) +
        Number.parseFloat(styles.paddingRight);
      const verticalPadding =
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom);
      updateScale(
        orbitStage.clientWidth - horizontalPadding,
        orbitStage.clientHeight - verticalPadding
      );
    };
    const observer = new ResizeObserver(updateScaleFromLiveStage);

    // The orbit lives in the stage's content box. Reading that same box for
    // both initial and observed sizing keeps it centered without a later snap.
    updateScaleFromLiveStage();
    observer.observe(orbitStage);
    return () => {
      observer.disconnect();
    };
  }, []);
  const completeProviderSessionNote = async (providerId: string) => {
    setPendingCompletionProviderId(null);
    setCompletionStatus((current) => ({ ...current, [providerId]: "saving" }));

    try {
      const formData = new FormData();
      formData.append("clientId", client.id);
      const result = await completeSessionNote(formData);

      if (result.ok) {
        onSessionCompleted?.(providerId, result.completedEntryIds ?? []);
        setCompletedProviderIds((current) => {
          const next = new Set(current);
          next.add(providerId);
          return next;
        });
        setCompletionStatus((current) => ({ ...current, [providerId]: "idle" }));
        dismissOwnNotesPrompt();
        return;
      }
    } catch {
      // The shared status below keeps a server/network failure inside the UI.
    }

    setCompletionStatus((current) => ({ ...current, [providerId]: "error" }));
  };
  useEffect(() => {
    if (!menuProviderId || suspendMenuDismiss) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !orbitRef.current?.contains(target) &&
        !target.closest('[data-own-note-menu="true"]')
      ) {
        requestOwnNotesPromptDismiss();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestOwnNotesPromptDismiss();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuProviderId, requestOwnNotesPromptDismiss, suspendMenuDismiss]);

  useEffect(() => {
    if (typeof document === "undefined" || !menuProviderId) return;

    document.body.classList.add("provider-action-menu-open");
    return () => {
      document.body.classList.remove("provider-action-menu-open");
    };
  }, [menuProviderId]);

  useEffect(() => {
    if (!menuProviderId || !menuAnchorRef.current) return;

    const updatePosition = () => {
      if (menuAnchorRef.current) {
        positionProviderMenu(menuAnchorRef.current);
      }
    };
    const viewport = window.visualViewport;
    window.addEventListener("resize", updatePosition);
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
    };
  }, [menuProviderId, positionProviderMenu]);

  return (
    // This relative root is the containing block for every absolute orbit item.
    <div
      ref={setOrbitNode}
      className="client-orbit-canvas"
      data-testid="client-orbit"
      onPointerDown={(event) => {
        if (!menuProviderId) {
          return;
        }

        const target = event.target as HTMLElement;
        if (!target.closest('[data-own-note-menu="true"]')) {
          requestOwnNotesPromptDismiss();
        }
      }}
      style={{
        position: "relative",
        width: orbitSize,
        height: orbitSize,
      }}
    >
      <style>{`
        @keyframes provider-action-pop {
          from {
            opacity: 0;
            transform: translate(-50%, 8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        @keyframes provider-badge-reveal {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .provider-orbit-node {
          opacity: 1;
        }

        .provider-badge-reveal-layer {
          position: absolute;
          inset: 0;
          z-index: 30;
          border-radius: inherit;
          background: var(--background);
          pointer-events: none;
          opacity: 0;
        }

        .provider-orbit-node--ready .provider-badge-reveal-layer {
          animation-name: provider-badge-reveal;
          animation-duration: var(--provider-reveal-duration, 220ms);
          animation-delay: var(--provider-reveal-delay, 0ms);
          animation-timing-function: ease-out;
          animation-fill-mode: both;
        }

        .provider-orbit-node--settled .provider-badge-reveal-layer {
          opacity: 0;
          animation: none;
        }

        [data-spatial-hit-target="true"]:focus-visible {
          outline: 2px solid rgb(41 50 60 / 72%);
          outline-offset: 5px;
        }

        @media (prefers-reduced-motion: reduce) {
          .provider-badge-reveal-layer {
            opacity: 0;
            animation: none;
          }
        }

      `}</style>
      {/* CENTER CLIENT */}
      <button
        type="button"
        className="glass-client-badge"
        aria-label="Open Client Summary"
        data-client-signal={
          client.signal?.color !== "neutral" && client.signal?.isUnread
            ? client.signal.color
            : undefined
        }
        data-client-signal-status={client.signal?.isUnread ? client.signal.status : undefined}
        data-spatial-hit-target="true"
        data-swipe-allow="true"
        onClick={onOpenClientHandoff}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: centerSize,
          height: centerSize,
          borderRadius: "50%",
          border: "none",
          background: "transparent",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--foreground)",
          fontSize: Math.max(18, centerSize * 0.18),
          fontWeight: 500,
          cursor: "pointer",
          zIndex: 3,
        }}
      >
        {client.firstName.slice(0, 2)}
        {client.lastName.slice(0, 2)}
      </button>

      {/* PROVIDERS */}
      {/* Refs reached by these closures are read only after an interaction. */}
      {providers.map((pc, index) => {
        const { x, y } = providerOrbitPoint(
          index,
          providers.length,
          providerDistance
        );

        const isMe = pc.provider.id === currentProviderId;
        const providerDisplayName = formatCompactProviderBadgeName(
          pc.provider.firstName
        );
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
        const {
          readableEntriesForProvider,
          hasCompletedSessionNote,
          showSignal,
          isSignalDimmed,
          showAction,
          signalEventKey,
        } = getProviderSignalState(pc.provider.id, isMe);
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
          isMe &&
          readableEntriesForProvider.some(
            (entry) => entry.status !== "COMPLETED"
          );
        const isSupervisorProvider = pc.role === "Supervisor";
        const canUseAbcData = abcDataRoles.has(pc.role);
        const isCaregiverProvider = pc.role === "Caregiver";
        const isEducatorProvider = pc.role === "Educator";
        const isBehaviorTechnicianProvider = pc.role === "BehaviorTherapist";
        const isOccupationalTherapistProvider = pc.role === "OccupationalTherapist";
        const isSpeechPathologistProvider = pc.role === "SpeechPathologist";
        const canOpenCaseSupport =
          viewerRole === "Supervisor" || client.hasCaseSupportAccess === true;
        const canRequestCaseSupport =
          isMe &&
          client.canRequestCaseSupport === true;
        const showOwnMenu =
          isMe &&
          menuProviderId === pc.provider.id;
        const showCompletedAuthorPrimary =
          isMe &&
          !isCaregiverProvider &&
          hasCompletedSessionNote &&
          !showSignal &&
          ownMenuMode === "primary";
        const showCompletedAuthorUpdate =
          isMe &&
          !isCaregiverProvider &&
          hasCompletedSessionNote &&
          !showSignal &&
          ownMenuMode === "update";
        const actionControlSize = showSignal
          ? Math.max(9, Math.round(badgeSize * 0.385))
          : badgeSize;
        const actionControlTop = showSignal ? -4 : -8;
        const actionMenuTop =
          orbitSize / 2 +
          y -
          spokeSize / 2 +
          actionControlTop +
          actionControlSize +
          10;
        const updateMenuActions: Array<{
          label: string;
          onSelect: () => void;
        }> = [];
        const addEntryUpdateAction = (
          label: string,
          existingEntry: unknown,
          entryKind?: CaretakerContextKind | NoteEntryKind
        ) => {
          updateMenuActions.push({
            label,
            onSelect: () => {
              onOpenEntryForm(
                currentProviderId,
                existingEntry ? "update" : "add",
                entryKind
              );
            },
          });
        };

        if (isSupervisorProvider) {
          updateMenuActions.push({
            label: "Field Observation",
            onSelect: openFieldObservation,
          });
          addEntryUpdateAction(
            "Clinical Note",
            clinicalNoteEntry,
            "ClinicalNote"
          );
        } else if (isCaregiverProvider) {
          addEntryUpdateAction(
            "Morning Context",
            morningContextEntry,
            "MorningContext"
          );
          addEntryUpdateAction(
            "Evening Context",
            eveningContextEntry,
            "EveningContext"
          );
        } else if (isBehaviorTechnicianProvider) {
          updateMenuActions.push({
            label: "A-B-C Data",
            onSelect: () => {
              onOpenAbcData(currentProviderId);
            },
          });
          addEntryUpdateAction("Session Progress", entryForProvider, "SessionNote");
          updateMenuActions.push({
            label: "Add Target",
            onSelect: () => {
              onOpenEducatorTarget("SessionNote");
            },
          });
        } else if (isEducatorProvider) {
          addEntryUpdateAction("Classroom Progress", entryForProvider, "SessionNote");
          updateMenuActions.push({
            label: "Add Target",
            onSelect: () => {
              onOpenEducatorTarget("SessionNote");
            },
          });
        } else if (isOccupationalTherapistProvider) {
          addEntryUpdateAction("Therapy Progress", entryForProvider, "SessionNote");
          addEntryUpdateAction(
            "Sensory Observation",
            sensoryObservationEntry,
            "SensoryObservation"
          );
          updateMenuActions.push({
            label: "Add Target",
            onSelect: () => {
              onOpenEducatorTarget("SessionNote");
            },
          });
        } else if (isSpeechPathologistProvider) {
          addEntryUpdateAction(
            "Speech Progress",
            speechProgressEntry,
            "SpeechProgress"
          );
          addEntryUpdateAction(
            "Communication Observation",
            communicationObservationEntry,
            "CommunicationObservation"
          );
          updateMenuActions.push({
            label: "Add Target",
            onSelect: () => {
              onOpenEducatorTarget("SpeechProgress");
            },
          });
        } else if (canUseAbcData) {
          updateMenuActions.push({
            label: "A-B-C Data",
            onSelect: () => {
              onOpenAbcData(currentProviderId);
            },
          });
        } else {
          addEntryUpdateAction("Session Note", entryForProvider);
        }

        if (canOpenCaseSupport) {
          updateMenuActions.push({
            label:
              viewerRole === "Supervisor"
                ? "Case Support"
                : "Open Active Case",
            onSelect: () => {
              openCaseSupport("open");
            },
          });
        }
        if (canRequestCaseSupport) {
          updateMenuActions.push({
            label: "Request Case Support",
            onSelect: () => {
              openCaseSupport("request");
            },
          });
        }

        return (
          <div
            key={pc.provider.id}
            className={`provider-orbit-node${
              !isMe ? " provider-orbit-node--notes" : ""
            }`}
            role={!isMe ? "button" : undefined}
            tabIndex={!isMe ? 0 : undefined}
            aria-label={
              !isMe
                ? `View ${formatBadgeRole(pc.role)} notes for ${providerDisplayName}`
                : undefined
            }
            data-spatial-hit-target={!isMe ? "true" : undefined}
            data-swipe-ignore="true"
            onClick={!isMe ? () => onOpenNotes(pc.provider.id) : undefined}
            onKeyDown={
              !isMe
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenNotes(pc.provider.id);
                    }
                  }
                : undefined
            }
            style={{
              position: "absolute",
              zIndex: showOwnMenu ? 20 : 2,
              top: "50%",
              left: "50%",
              cursor: !isMe ? "pointer" : "default",
              touchAction: "manipulation",
              transform: `translate(${x - spokeSize / 2}px, ${
                y - spokeSize / 2
              }px)`,
            }}
          >
      {/* Circle */}
      <div
        className="glass-provider-badge"
        style={{
          position: "relative", 
          width: spokeSize,
          height: spokeSize,
          borderRadius: "50%",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: Math.max(6, spokeSize * 0.085),
          cursor: "inherit",
          zIndex: showOwnMenu ? 21 : 1,
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: "100%",
            overflowWrap: "anywhere",
            fontWeight: 525,
            fontSize: Math.max(13, Math.min(15, spokeSize * 0.17)),
            lineHeight: 1.05,
          }}
        >
          {providerDisplayName}
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 2,
            marginTop: 3,
            color: "rgb(37 40 44 / 56%)",
            maxWidth: "100%",
            overflowWrap: "anywhere",
            fontSize: Math.max(10.5, Math.min(12, spokeSize * 0.135)),
            lineHeight: 1.05,
          }}
        >
          {formatBadgeRole(pc.role)}
        </div>

        {showAction && (
          <ProviderActionControl
            isOwnControl={isMe}
            isSignal={showSignal}
            isDimmed={isSignalDimmed}
            hasTodayEntry={isMe && hasOwnAnyEntry}
            isPublished={
              isMe && !isCaregiverProvider && hasCompletedSessionNote
            }
            signalEventKey={signalEventKey}
            onActivate={(anchor) => {
              if (isMe) {
                if (showSignal) {
                  dismissOwnNotesPrompt();
                  onOpenNotes(currentProviderId);
                  return;
                }

                toggleOwnNotesMenu(pc.provider.id, anchor);
                return;
              }

              onOpenNotes(pc.provider.id);
            }}
            ariaLabel={
              isMe
                ? hasCompletedSessionNote && !isCaregiverProvider
                  ? "Published — view or update today's note"
                  : hasOwnAnyEntry
                    ? "Continue today's note"
                  : "Add your note"
                : "View provider note"
            }
            style={{
              position: "absolute",
              top: actionControlTop,
              right: showSignal ? -4 : -8,
              width: actionControlSize,
              height: actionControlSize,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "var(--foreground)",
              cursor: "pointer",
              fontSize: hasCompletedSessionNote && !isSupervisorProvider ? 15 : 18,
              lineHeight: "26px",
              zIndex: 23,
            }}
          />
        )}

        {showOwnMenu && typeof document !== "undefined"
          ? createPortal(
              <>
                <button
                  type="button"
                  aria-label="Close documentation menu"
                  className={`dashboard-action-backdrop provider-action-menu-backdrop${
                    isOwnMenuClosing
                      ? " provider-action-menu-backdrop--closing"
                      : ""
                  }`}
                  data-dashboard-trace-layer="provider-backdrop"
                  data-own-note-menu="true"
                  data-swipe-ignore="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestOwnNotesPromptDismiss();
                  }}
                />
                <div
                  data-own-note-menu="true"
                  data-swipe-ignore="true"
                  role="menu"
                  aria-label="Documentation"
                  aria-hidden={isOwnMenuClosing || undefined}
                  inert={isOwnMenuClosing}
                  className={`dashboard-action-surface-material provider-action-menu${
                    isOwnMenuClosing ? " provider-action-menu--closing" : ""
                  }`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onAnimationEnd={(event) => {
                    if (
                      event.currentTarget === event.target &&
                      (event.animationName === "provider-action-popover-out" ||
                        event.animationName === "provider-action-sheet-out")
                    ) {
                      completeOwnNotesPromptDismiss();
                    }
                  }}
                  style={
                    providerMenuPosition
                      ? {
                          left: providerMenuPosition.left,
                          top: providerMenuPosition.top,
                          bottom: providerMenuPosition.bottom,
                          maxHeight: providerMenuPosition.maxHeight,
                          transformOrigin:
                            providerMenuPosition.transformOrigin,
                        }
                      : { top: actionMenuTop }
                  }
                >
                  <div className="dashboard-action-surface-scroll">
            {showCompletedAuthorPrimary ? (
              <>
                <button
                  type="button"
                  className="dashboard-action-row"
                  onClick={() => setOwnMenuMode("update")}
                >
                  Update Note
                </button>
                <button
                  type="button"
                  className="dashboard-action-row"
                  onClick={() => {
                    leaveOwnNotesMenu(() => onOpenNotes(currentProviderId));
                  }}
                >
                  View Note
                </button>
                {canOpenCaseSupport ? (
                  <button
                    type="button"
                    className="dashboard-action-row"
                    onClick={() => {
                      leaveOwnNotesMenu(() => {
                        openCaseSupport("open");
                      });
                    }}
                  >
                    {viewerRole === "Supervisor"
                      ? "Case Support"
                      : "Open Active Case"}
                  </button>
                ) : null}
                {canRequestCaseSupport ? (
                  <button
                    type="button"
                    className="dashboard-action-row"
                    onClick={() => {
                      leaveOwnNotesMenu(() => {
                        openCaseSupport("request");
                      });
                    }}
                  >
                    Request Case Support
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {showCompletedAuthorUpdate ? (
                  <button
                    type="button"
                    onClick={() => setOwnMenuMode("primary")}
                    className="back-link dashboard-action-row dashboard-action-row--back"
                  >
                    Back
                  </button>
                ) : null}
                {updateMenuActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="dashboard-action-row"
                    onClick={() => {
                      leaveOwnNotesMenu(action.onSelect);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </>
            )}
            {!isCaregiverProvider &&
            !showCompletedAuthorPrimary &&
            hasOwnInProgressDocumentation ? (
              <>
                <button
                  type="button"
                  className="dashboard-action-row"
                  onClick={() => {
                    openSessionCompletionConfirmation(pc.provider.id);
                  }}
                  disabled={completionStatus[pc.provider.id] === "saving"}
                >
                  {completionStatus[pc.provider.id] === "saving"
                    ? "Completing..."
                    : "Complete Session Note"}
                </button>
                {completionStatus[pc.provider.id] === "error" ? (
                  <div className="provider-action-menu-message">
                    Save at least one section first.
                  </div>
                ) : null}
              </>
            ) : null}
            {!showCompletedAuthorPrimary && !showCompletedAuthorUpdate ? (
              <button
                type="button"
                className="dashboard-action-row"
                onClick={() => {
                  leaveOwnNotesMenu(() => onOpenNotes(currentProviderId));
                }}
              >
                View Notes
              </button>
            ) : null}
                  </div>
                </div>
              </>,
              document.body
            )
          : null}

        <span className="provider-badge-reveal-layer" aria-hidden="true" />
      </div>
    </div>
  );
      })}

      {pendingCompletionProviderId && typeof document !== "undefined"
        ? createPortal(
            <SessionCompletionConfirmation
              busy={
                completionStatus[pendingCompletionProviderId] === "saving"
              }
              onCancel={() => setPendingCompletionProviderId(null)}
              onConfirm={() =>
                void completeProviderSessionNote(pendingCompletionProviderId)
              }
            />,
            document.body
          )
        : null}

    </div>
  );
}

function SessionCompletionConfirmation({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 160,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgb(0 0 0 / 22%)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-completion-title"
        className="paper-surface"
        style={{
          width: "min(100%, 420px)",
          padding: "24px clamp(20px, 6vw, 30px)",
          display: "grid",
          justifyItems: "center",
          gap: 18,
          textAlign: "center",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          id="session-completion-title"
          style={{ fontSize: 20, fontWeight: 650 }}
        >
          Complete Session Note
        </div>
        <div style={{ lineHeight: 1.5, opacity: 0.72 }}>
          Submit the saved sections and mark this provider communication as
          complete?
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            type="button"
            className="action-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-positive"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Completing..." : "Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}
