"use client";

/**
 * Detailed provider-note reader opened from a provider badge.
 * This is the evidence layer beneath the client handoff: it preserves authorship,
 * provider-specific sections, recent-note navigation, and raw session details.
 */

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import OverlayContainer from "@/components/ui/OverlayContainer";
import { formatClinicalDateTime } from "@/app/libs/dateTime";
import type { NoteHistoryEntry, SupervisorObservation } from "./noteHistoryTypes";
import {
  entryKindTitle,
  formatDomain,
  formatEducatorResponse,
  formatMetricValue,
  getAbcObservation,
  getDomainScores,
  getItemPercent,
  groupCaretakerEntriesByDay,
  parseSensoryObservations,
  parseSupervisorObservation,
} from "./noteHistoryModel";
import {
  CollapsibleRecordSection,
  NotePreviewCard,
  SensoryObservationSection,
  SupervisorObservationSection,
} from "./NoteHistorySections";

type Props = {
  clientId: string;
  clientInitials: string;
  entries: NoteHistoryEntry[];
  variant?: "page" | "overlay";
  backLabel?: string;
  onClose?: () => void;
};

const activeOverlayCardStyle: CSSProperties = {
  border: "none",
  background: "var(--surface-raised)",
  boxShadow:
    "0 5px 5px rgb(0 0 0 / 22%), 0 1px 1px rgb(0 0 0 / 14%), 0 8px 10px rgb(0 0 0 / 7%), -3px -3px 5px rgb(255 255 255 / 68%), inset 0 1px 0 rgb(255 255 255 / 70%), inset 0 -1px 3px rgb(0 0 0 / 5%)",
};

const activePageCardStyle: CSSProperties = {
  border: "none",
  background: "var(--surface-raised)",
  boxShadow:
    "0 5px 5px rgb(0 0 0 / 22%), 0 1px 1px rgb(0 0 0 / 14%), 0 8px 10px rgb(0 0 0 / 7%), -3px -3px 5px rgb(255 255 255 / 68%), inset 0 1px 0 rgb(255 255 255 / 70%), inset 0 -1px 3px rgb(0 0 0 / 5%)",
};

export default function NoteHistoryViewer({
  clientId,
  clientInitials,
  entries,
  variant = "page",
  backLabel = "Back to Client",
  onClose,
}: Props) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const displayEntries = useMemo(() => groupCaretakerEntriesByDay(entries), [entries]);

  const current = displayEntries[index];
  const olderEntry = index < displayEntries.length - 1 ? displayEntries[index + 1] : null;
  const newerEntry = index > 0 ? displayEntries[index - 1] : null;
  const canNavigateOlder = olderEntry !== null;
  const canNavigateNewer = newerEntry !== null;
  const canNavigate = canNavigateOlder || canNavigateNewer;
  const measurableScores =
    current?.items
      .map((item) => getItemPercent(item))
      .filter((score): score is number => score !== null) ?? [];
  const highestScore = measurableScores.length ? Math.max(...measurableScores) : null;
  const lowestScore = measurableScores.length ? Math.min(...measurableScores) : null;
  const scoreRange =
    highestScore !== null && lowestScore !== null ? highestScore - lowestScore : null;
  const overallPercent =
    current?.finalScore !== null && current?.finalScore !== undefined
      ? current.finalScore * 10
      : measurableScores.length
        ? Math.round(
            measurableScores.reduce((sum, score) => sum + score, 0) /
              measurableScores.length
          )
        : null;
  const domainScores = getDomainScores(current?.items ?? []);
  const hasSummary =
    highestScore !== null ||
    lowestScore !== null ||
    overallPercent !== null ||
    domainScores.length > 0 ||
    scoreRange !== null;
  const hasTargets = current?.items.length > 0;
  const noteAbcObservation = getAbcObservation(current?.note ?? "");
  const sensoryObservations =
    current?.sensoryObservations?.length
      ? current.sensoryObservations
      : current?.kind === "SensoryObservation"
      ? parseSensoryObservations(current.contextData)
      : [];
  const communicationObservations =
    current?.communicationObservations?.length
      ? current.communicationObservations
      : current?.kind === "CommunicationObservation"
        ? parseSensoryObservations(current.contextData)
        : [];
  const isSupervisorObservationEntry = current?.kind === "SupervisorObservation";
  const isClinicalNoteEntry = current?.kind === "ClinicalNote";
  const supervisorObservations =
    current?.providerRole === "Supervisor"
      ? displayEntries
          .filter(
            (entry) =>
              entry.kind === "SupervisorObservation" &&
              entry.providerName === current.providerName &&
              entry.date.slice(0, 10) === current.date.slice(0, 10)
          )
          .map((entry) =>
            parseSupervisorObservation(
              entry.contextData,
              entry.note,
              entry.date,
              entry.providerName
            )
          )
          .filter((entry): entry is SupervisorObservation => entry !== null)
      : [];
  const isSensoryObservationEntry = current?.kind === "SensoryObservation";
  const isCommunicationObservationEntry = current?.kind === "CommunicationObservation";
  const isEducatorClassroomProgress =
    (current?.providerRole === "Educator" ||
      current?.providerRole === "Behavior Technician" ||
      current?.providerRole === "Occupational Therapist" ||
      current?.providerRole === "Speech Pathologist") &&
    ((current.kind ?? "SessionNote") === "SessionNote" ||
      current.kind === "SpeechProgress") &&
    current.items.length > 0;
  const isBehaviorTechnicianProgress = current?.providerRole === "Behavior Technician";
  const isOtProgress = current?.providerRole === "Occupational Therapist";
  const isSpeechProgress = current?.providerRole === "Speech Pathologist";
  const progressSectionTitle = isSpeechProgress
    ? "Speech Progress"
    : isOtProgress
      ? "Therapy Progress"
      : isBehaviorTechnicianProgress
        ? "Session Progress"
        : "Classroom Progress";
  const isInProgressNote = current?.status && current.status !== "COMPLETED";

  const showOlder = () => {
    setDragOffset(0);
    if (!canNavigateOlder) {
      return;
    }

    setIndex((value) => Math.min(displayEntries.length - 1, value + 1));
  };

  const showNewer = () => {
    setDragOffset(0);
    if (!canNavigateNewer) {
      return;
    }

    setIndex((value) => Math.max(0, value - 1));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canNavigate) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, summary, details")) {
      return;
    }

    dragStartXRef.current = event.clientX;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) {
      return;
    }

    const offset = event.clientX - dragStartXRef.current;
    setDragOffset(Math.max(-260, Math.min(260, offset)));
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) {
      return;
    }

    const offset = event.clientX - dragStartXRef.current;
    dragStartXRef.current = null;
    setIsDragging(false);

    if (Math.abs(offset) < 88) {
      setDragOffset(0);
      return;
    }

    if (offset > 0) {
      showOlder();
      return;
    }

    showNewer();
  };

  const cancelDrag = () => {
    dragStartXRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  if (!current) return null;

  const hasComment = current.note.trim().length > 0;
  const cardTransition = isDragging
    ? "none"
    : "opacity 220ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
  const activeCardTransform = `translateX(${dragOffset}px) scale(${isDragging ? 0.99 : 1})`;
  const previousCardTransform = `translateX(${24 + dragOffset * 0.72}px) scale(0.82)`;
  const nextCardTransform = `translateX(${-24 + dragOffset * 0.72}px) scale(0.82)`;

  const content = (
    <div
      style={{
        padding: variant === "overlay" ? 0 : "0 32px 24px",
      }}
    >
      <style>{`
        @keyframes noteOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes noteCarouselEnter {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      <div style={{ marginBottom: 24 }}>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="back-link"
          >
            {backLabel.replace("Back to ", "")}
          </button>
        ) : (
          <Link
            href={`/dashboard?clientId=${clientId}&view=orbit`}
            className="back-link"
          >
            {backLabel.replace("Back to ", "")}
          </Link>
        )}
      </div>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          minHeight: 620,
          position: "relative",
          isolation: "isolate",
          animation:
            variant === "overlay"
              ? "noteCarouselEnter 320ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both"
              : undefined,
        }}
      >
          <button
            type="button"
            onClick={showOlder}
            aria-label="Older note"
            disabled={!canNavigateOlder}
            style={{
              border: "none",
              background: "transparent",
              cursor: canNavigateOlder ? "pointer" : "default",
              fontSize: 48,
              lineHeight: 1,
              color: "rgb(0 0 0 / 54%)",
              opacity: canNavigateOlder ? 1 : 0,
              position: "absolute",
              left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 5,
          }}
        >
          ‹
        </button>

        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 220px) minmax(360px, 560px) minmax(120px, 220px)",
            alignItems: "center",
            justifyContent: "center",
            gap: variant === "overlay" ? 36 : 24,
            minHeight: 620,
            padding: "0 72px",
            overflow: "hidden",
            cursor: canNavigate ? (isDragging ? "grabbing" : "grab") : "default",
            touchAction: "pan-y",
            userSelect: isDragging ? "none" : undefined,
          }}
        >
          <NotePreviewCard
            entry={olderEntry}
            side="left"
            variant={variant}
            transform={previousCardTransform}
            transition={cardTransition}
          />

          <div
            key={current.id}
            style={{
              position: "relative",
              zIndex: 3,
              height: 500,
              paddingRight: 22,
              boxSizing: "border-box",
              overflowY: "auto",
              overflowX: "visible",
              transform: activeCardTransform,
              transition: cardTransition,
              willChange: "transform",
            }}
          >
            <div
              style={{
                padding: 40,
                borderRadius: 18,
                ...(variant === "overlay" ? activeOverlayCardStyle : activePageCardStyle),
                minHeight: 500,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ marginBottom: 16, opacity: 0.7 }}>
                <div>{clientInitials}</div>
                <div>
                  {current.providerName} -- {current.providerRole}
                </div>
                <div>{new Date(current.date).toLocaleDateString()}</div>
                {isInProgressNote ? (
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}>
                    In progress
                  </div>
                ) : null}
              </div>

              {current.caretakerContextSections?.length ? (
                <>
                  {current.caretakerContextSections.map((section) => (
                    <CollapsibleRecordSection
                      key={section.entryId}
                      title={entryKindTitle(section.kind)}
                    >
                      <div style={{ whiteSpace: "pre-wrap" }}>{section.note}</div>
                    </CollapsibleRecordSection>
                  ))}
                </>
              ) : isEducatorClassroomProgress ? (
                <>
                  <CollapsibleRecordSection title={progressSectionTitle}>
                    <div style={{ display: "grid", gap: 10 }}>
                      {current.items.map((item) => (
                        <div key={`${item.target}-${item.goal}`}>
                          <div style={{ fontWeight: 600 }}>{item.target}</div>
                          <div style={{ opacity: 0.76 }}>{item.goal}</div>
                          <div style={{ opacity: 0.72 }}>
                            {formatEducatorResponse(
                              item,
                              isOtProgress,
                              isSpeechProgress,
                              isBehaviorTechnicianProgress
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleRecordSection>

                  {isOtProgress && sensoryObservations.length > 0 ? (
                    <SensoryObservationSection
                      title="Sensory Observation Summary"
                      observations={sensoryObservations}
                      fallbackDate={current.date}
                      fallbackAuthor={current.providerName}
                    />
                  ) : null}

                  {isSpeechProgress && communicationObservations.length > 0 ? (
                    <SensoryObservationSection
                      title="Communication Observations"
                      observations={communicationObservations}
                      fallbackDate={current.date}
                      fallbackAuthor={current.providerName}
                    />
                  ) : null}

                  {hasComment ? (
                    <CollapsibleRecordSection title="Provider Note">
                      <div style={{ whiteSpace: "pre-wrap" }}>{current.note}</div>
                    </CollapsibleRecordSection>
                  ) : null}
                </>
              ) : isSupervisorObservationEntry ? (
                supervisorObservations.length > 0 ? (
                  <SupervisorObservationSection
                    title="Observation"
                    observations={supervisorObservations}
                    fallbackDate={current.date}
                    fallbackAuthor={current.providerName}
                  />
                ) : hasComment ? (
                  <CollapsibleRecordSection title="Observation">
                    <div style={{ whiteSpace: "pre-wrap" }}>{current.note}</div>
                  </CollapsibleRecordSection>
                ) : null
              ) : isClinicalNoteEntry ? (
                <>
                  {supervisorObservations.length > 0 ? (
                    <SupervisorObservationSection
                      title="Observation"
                      observations={supervisorObservations}
                      fallbackDate={current.date}
                      fallbackAuthor={current.providerName}
                    />
                  ) : null}
                  {hasComment ? (
                    <CollapsibleRecordSection title="Clinical Note">
                      <div style={{ whiteSpace: "pre-wrap" }}>{current.note}</div>
                    </CollapsibleRecordSection>
                  ) : null}
                </>
              ) : isSensoryObservationEntry ? (
                sensoryObservations.length > 0 ? (
                  <SensoryObservationSection
                    title="Sensory Observation Summary"
                    observations={sensoryObservations}
                    fallbackDate={current.date}
                    fallbackAuthor={current.providerName}
                  />
                ) : (
                  <CollapsibleRecordSection title="Sensory Observation Summary">
                    <div style={{ whiteSpace: "pre-wrap" }}>{current.note}</div>
                  </CollapsibleRecordSection>
                )
              ) : isCommunicationObservationEntry ? (
                communicationObservations.length > 0 ? (
                  <SensoryObservationSection
                    title="Communication Observations"
                    observations={communicationObservations}
                    fallbackDate={current.date}
                    fallbackAuthor={current.providerName}
                  />
                ) : (
                  <CollapsibleRecordSection title="Communication Observations">
                    <div style={{ whiteSpace: "pre-wrap" }}>{current.note}</div>
                  </CollapsibleRecordSection>
                )
              ) : hasComment ? (
                <CollapsibleRecordSection title={entryKindTitle(current.kind)}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{current.note}</div>
                </CollapsibleRecordSection>
              ) : null}

              {!isEducatorClassroomProgress &&
              !isSupervisorObservationEntry &&
              !isClinicalNoteEntry &&
              !isSensoryObservationEntry &&
              !isCommunicationObservationEntry &&
              hasSummary ? (
                <CollapsibleRecordSection title="Assessment Summary">
                  <div style={{ display: "grid", gap: 8 }}>
                    {highestScore !== null ? <div>Highest: {highestScore}%</div> : null}
                    {lowestScore !== null ? <div>Lowest: {lowestScore}%</div> : null}
                    {overallPercent !== null ? <div>Overall: {overallPercent}%</div> : null}
                    {domainScores.map((domainScore) => (
                      <div key={domainScore.domain}>
                        {formatDomain(domainScore.domain)}: {domainScore.percent}%
                      </div>
                    ))}
                    {scoreRange !== null ? (
                      <div style={{ marginTop: 4, opacity: 0.72 }}>
                        Spread: {scoreRange} points between the highest and lowest entries.
                      </div>
                    ) : null}
                  </div>
                </CollapsibleRecordSection>
              ) : null}

              {current.clinicalReflection ? (
                <CollapsibleRecordSection title="Clinical Reflection">
                  <div style={{ display: "grid", gap: 8, whiteSpace: "pre-wrap" }}>
                    {current.clinicalReflection}
                  </div>
                </CollapsibleRecordSection>
              ) : null}

              {!isEducatorClassroomProgress &&
              !isSupervisorObservationEntry &&
              !isClinicalNoteEntry &&
              !isSensoryObservationEntry &&
              !isCommunicationObservationEntry &&
              hasTargets ? (
                <CollapsibleRecordSection title="Targets">
                  <div style={{ display: "grid", gap: 10 }}>
                    {current.items.map((item) => {
                      const percent = getItemPercent(item);
                      return (
                        <div key={`${item.target}-${item.goal}`}>
                          <div style={{ fontWeight: 600 }}>{item.target}</div>
                          <div style={{ opacity: 0.76 }}>{item.goal}</div>
                          <div style={{ opacity: 0.72 }}>
                            {formatMetricValue(item, percent)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleRecordSection>
              ) : null}

              {current.abcObservations.length > 0 || noteAbcObservation ? (
                <CollapsibleRecordSection title="A-B-C Data">
                  {current.abcObservations.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {current.abcObservations.map((observation, observationIndex) => (
                      <div key={observation.id} style={{ display: "grid", gap: 4 }}>
                        {current.abcObservations.length > 1 ? (
                          <div style={{ fontWeight: 600 }}>Observation {observationIndex + 1}</div>
                        ) : null}
                        <div>
                          <span style={{ fontWeight: 600 }}>Antecedent: </span>
                          {observation.antecedent}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600 }}>Behavior: </span>
                          {observation.behavior}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600 }}>Consequence: </span>
                          {observation.consequence}
                        </div>
                      </div>
                    ))}
                  </div>
                  ) : (
                    <div style={{ whiteSpace: "pre-wrap" }}>{noteAbcObservation}</div>
                  )}
                </CollapsibleRecordSection>
              ) : null}

              <CollapsibleRecordSection title="Timestamp">
                <div>{formatClinicalDateTime(current.completedAt ?? current.date)}</div>
              </CollapsibleRecordSection>
            </div>
          </div>

          <NotePreviewCard
            entry={newerEntry}
            side="right"
            variant={variant}
            transform={nextCardTransform}
            transition={cardTransition}
          />
        </div>

          <button
            type="button"
            onClick={showNewer}
            aria-label="Newer note"
            disabled={!canNavigateNewer}
            style={{
              border: "none",
              background: "transparent",
              cursor: canNavigateNewer ? "pointer" : "default",
              fontSize: 48,
              lineHeight: 1,
              color: "rgb(0 0 0 / 54%)",
              opacity: canNavigateNewer ? 1 : 0,
              position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 5,
          }}
        >
          ›
        </button>
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <OverlayContainer>
        <div
          style={{
            width: "min(1280px, 100%)",
            margin: "0 auto",
            overflow: "visible",
            animation: "noteOverlayFadeIn 260ms ease-out both",
          }}
        >
          {content}
        </div>
      </OverlayContainer>
    );
  }

  return content;
}
