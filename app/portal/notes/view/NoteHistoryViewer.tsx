"use client";

/**
 * Detailed provider-note reader opened from a provider badge.
 * This is the evidence layer beneath the client handoff: it preserves authorship,
 * provider-specific sections, recent-note navigation, and raw session details.
 */

import Link from "next/link";
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import OverlayContainer from "@/components/ui/OverlayContainer";
import type { ClinicalHandoff } from "@/app/api/aiGateway";
import { formatClinicalDateTime } from "@/app/libs/dateTime";

type EntryItem = {
  id: string;
  kind?:
    | "SessionNote"
    | "MorningContext"
    | "EveningContext"
    | "SupervisorObservation"
    | "ClinicalNote"
    | "SensoryObservation"
      | "SpeechProgress"
      | "CommunicationObservation";
  status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | string;
  note: string;
  clinicalReflection: string | null;
  clinicalHandoff?: ClinicalHandoff | null;
  clinicalHandoffMetrics?: {
    generationTimeMs: number;
    confidence: ClinicalHandoff["confidence"] | null;
    importantEventCount: number;
    watchItemCount: number;
    carryForwardCount: number;
  } | null;
  contextData?: unknown;
  date: string;
  completedAt?: string;
  finalScore: number | null;
  providerName: string;
  providerRole: string;
  items: Array<{
    target: string;
    goal: string;
    score: number | null;
    metricType: "Percentage" | "Frequency" | "Duration" | "Subjective" | null;
    domain:
      | "Behavior"
      | "SkillAcquisition"
      | "Communication"
      | "Adaptive"
      | "Regulation"
      | "Other"
      | null;
    rawValue: number | null;
    supportLevel: number | null;
    goalDefinition: {
      targetValue: number | null;
      comparison: "LessThan" | "GreaterThan" | "Equal" | null;
      measurementProfile: string | null;
    } | null;
  }>;
  abcObservations: Array<{
    id: string;
    antecedent: string;
    behavior: string;
    consequence: string;
  }>;
  sensoryObservations?: SensoryObservation[];
  communicationObservations?: SensoryObservation[];
};

type SensoryObservation = {
  category: string;
  observation: string;
  recommendation: string;
  timestamp?: string;
  author?: string;
};

type SupervisorObservation = {
  category: string;
  observation: string;
  timestamp?: string;
  author?: string;
};

type Props = {
  clientId: string;
  clientInitials: string;
  entries: EntryItem[];
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

  const current = entries[index];
  const olderEntry = index < entries.length - 1 ? entries[index + 1] : null;
  const newerEntry = index > 0 ? entries[index - 1] : null;
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
      ? entries
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
  const aiSummarySubject = isEducatorClassroomProgress
    ? progressSectionTitle.toLowerCase()
    : entryKindTitle(current.kind).toLowerCase();
  const isInProgressNote = current?.status && current.status !== "COMPLETED";

  const showOlder = () => {
    setDragOffset(0);
    if (!canNavigateOlder) {
      return;
    }

    setIndex((value) => Math.min(entries.length - 1, value + 1));
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

              {current.clinicalHandoff ? (
                <ClinicalHandoffSection
                  handoff={current.clinicalHandoff}
                  metrics={current.clinicalHandoffMetrics ?? null}
                />
              ) : (
                <RecordSection title="AI Daily Summary">
                  <div style={{ opacity: 0.72 }}>
                    Summary placeholder. AI-generated {aiSummarySubject} summaries will appear here.
                  </div>
                </RecordSection>
              )}

              {current.clinicalHandoff && current.clinicalReflection ? (
                <CollapsibleRecordSection title="Clinical Reflection (Legacy)">
                  <div style={{ display: "grid", gap: 8, whiteSpace: "pre-wrap" }}>
                    {current.clinicalReflection}
                  </div>
                </CollapsibleRecordSection>
              ) : null}

              {isEducatorClassroomProgress ? (
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

              {!current.clinicalHandoff && current.clinicalReflection ? (
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

function ClinicalHandoffSection({
  handoff,
  metrics,
}: {
  handoff: ClinicalHandoff;
  metrics: EntryItem["clinicalHandoffMetrics"];
}) {
  return (
    <RecordSection title="AI Clinical Handoff">
      <div style={{ display: "grid", gap: 14 }}>
        {handoff.summary.trim().length > 0 ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{handoff.summary}</div>
        ) : null}

        <ClinicalHandoffList
          title="Important Events"
          items={handoff.importantEvents.map((event) => ({
            id: event.id,
            title: event.title,
            detail: event.summary,
          }))}
        />
        <ClinicalHandoffList
          title="Care Team Connections"
          items={handoff.careTeamConnections.map((connection) => ({
            id: connection.id,
            title: connection.providerRoles.join(" + "),
            detail: connection.summary,
          }))}
        />
        <ClinicalHandoffList
          title="Watch Items"
          items={handoff.watchItems.map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.reason,
          }))}
        />
        <ClinicalHandoffList
          title="Carry Forward"
          items={handoff.carryForwardItems.map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.detail,
          }))}
        />

        {metrics ? (
          <div
            style={{
              display: "grid",
              gap: 4,
              paddingTop: 2,
              fontSize: 12,
              opacity: 0.66,
            }}
          >
            <div>Validation diagnostics</div>
            <div>
              Confidence: {metrics.confidence ?? "unavailable"} · Generated in{" "}
              {metrics.generationTimeMs}ms · Important events:{" "}
              {metrics.importantEventCount} · Watch items: {metrics.watchItemCount} · Carry
              forward: {metrics.carryForwardCount}
            </div>
          </div>
        ) : null}
      </div>
    </RecordSection>
  );
}

function ClinicalHandoffList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; detail: string }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: "grid", gap: 2 }}>
            {item.title.trim().length > 0 ? (
              <div style={{ fontWeight: 600 }}>{item.title}</div>
            ) : null}
            {item.detail.trim().length > 0 ? (
              <div style={{ opacity: 0.76, whiteSpace: "pre-wrap" }}>{item.detail}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function entryKindTitle(kind: EntryItem["kind"]) {
  switch (kind) {
    case "SupervisorObservation":
      return "Observation";
    case "ClinicalNote":
      return "Clinical Note";
    case "SensoryObservation":
      return "Sensory Observation Summary";
    case "CommunicationObservation":
      return "Communication Observations";
    case "SpeechProgress":
      return "Speech Progress";
    case "MorningContext":
      return "Morning Context";
    case "EveningContext":
      return "Evening Context";
    case "SessionNote":
    default:
      return "Provider Note";
  }
}

function NotePreviewCard({
  entry,
  side,
  variant,
  transform,
  transition,
}: {
  entry: EntryItem | null;
  side: "left" | "right";
  variant: "page" | "overlay";
  transform: string;
  transition: string;
}) {
  if (!entry) {
    return <div aria-hidden="true" />;
  }

  const overallPercent =
    entry.finalScore !== null && entry.finalScore !== undefined ? entry.finalScore * 10 : null;

  return (
    <div
      aria-hidden="true"
      style={{
        justifySelf: side === "left" ? "end" : "start",
        width: 220,
        height: 320,
        boxSizing: "border-box",
        overflow: "hidden",
        padding: 24,
        border:
          variant === "overlay"
            ? "1px solid rgb(0 0 0 / 14%)"
            : "1px solid rgb(0 0 0 / 12%)",
        borderRadius: 18,
        background: "var(--surface-raised)",
        color: "rgb(0 0 0 / 76%)",
        opacity: variant === "overlay" ? undefined : 0.42,
        position: "relative",
        zIndex: 1,
        transform,
        transition,
        pointerEvents: "none",
        boxShadow: "var(--shadow-soft), var(--inset-paper)",
        willChange: "transform",
      }}
    >
      <div style={{ marginBottom: 16, fontSize: 13, opacity: 0.72 }}>
        <div>{entry.providerName}</div>
        <div>{entry.providerRole}</div>
        <div>{new Date(entry.date).toLocaleDateString()}</div>
      </div>
      <div
        style={{
          whiteSpace: "pre-wrap",
          fontSize: 13,
          lineHeight: 1.4,
          maxHeight: 160,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        {entry.note || "No comment."}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        Overall: {overallPercent !== null ? `${overallPercent}%` : "Not enough data"}
      </div>
    </div>
  );
}

function RecordSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 16, flex: "0 0 auto" }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>{title}</div>
      <div
        style={{
          border: "none",
          borderRadius: 14,
          padding: 12,
          boxShadow:
            "inset 0 2px 3px rgb(0 0 0 / 10%), inset 0 1px 1px rgb(0 0 0 / 5%), inset 0 -2px 2px rgb(255 255 255 / 42%)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function CollapsibleRecordSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details style={{ marginBottom: 16, flex: "0 0 auto" }}>
      <summary
        style={{
          marginBottom: 8,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {title}
      </summary>
      <div
        style={{
          border: "none",
          borderRadius: 14,
          padding: 12,
          boxShadow:
            "inset 0 2px 3px rgb(0 0 0 / 10%), inset 0 1px 1px rgb(0 0 0 / 5%), inset 0 -2px 2px rgb(255 255 255 / 42%)",
        }}
      >
        {children}
      </div>
    </details>
  );
}

function SensoryObservationSection({
  title,
  observations,
  fallbackDate,
  fallbackAuthor,
}: {
  title: string;
  observations: SensoryObservation[];
  fallbackDate: string;
  fallbackAuthor: string;
}) {
  return (
    <CollapsibleRecordSection title={title}>
      <div style={{ display: "grid", gap: 14 }}>
        {observations.map((observation, observationIndex) => (
          <div
            key={`${observation.category}-${observationIndex}`}
            style={{ display: "grid", gap: 6 }}
          >
            <div>
              <span style={{ fontWeight: 600 }}>Observation Category: </span>
              {observation.category}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>
              <span style={{ fontWeight: 600 }}>Observation: </span>
              {observation.observation}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Recommendation: </span>
              {observation.recommendation || "Not recorded"}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Timestamp: </span>
              {formatClinicalDateTime(observation.timestamp ?? fallbackDate)}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Author: </span>
              {observation.author || fallbackAuthor}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleRecordSection>
  );
}

function SupervisorObservationSection({
  title,
  observations,
  fallbackDate,
  fallbackAuthor,
}: {
  title: string;
  observations: SupervisorObservation[];
  fallbackDate: string;
  fallbackAuthor: string;
}) {
  return (
    <CollapsibleRecordSection title={title}>
      <div style={{ display: "grid", gap: 14 }}>
        {observations.map((observation, observationIndex) => (
          <div
            key={`${observation.category}-${observationIndex}`}
            style={{ display: "grid", gap: 6 }}
          >
            <div>
              <span style={{ fontWeight: 600 }}>Observation: </span>
              {observation.category}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{observation.observation}</div>
            <div>
              <span style={{ fontWeight: 600 }}>Timestamp: </span>
              {formatClinicalDateTime(observation.timestamp ?? fallbackDate)}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Author: </span>
              {observation.author || fallbackAuthor}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleRecordSection>
  );
}

function parseSupervisorObservation(
  value: unknown,
  note: string,
  date: string,
  author: string
): SupervisorObservation | null {
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    const category =
      typeof data.observationCategory === "string" ? data.observationCategory.trim() : "";
    const observation =
      typeof data.observation === "string" ? data.observation.trim() : "";

    if (category || observation) {
      return {
        category: category || "Observation",
        observation,
        timestamp: date,
        author,
      };
    }
  }

  const categoryMatch = note.match(/^Observation Category:\s*(.+)$/m);
  const observationMatch = note.match(/^Observation:\s*([\s\S]+)$/m);
  const observation = observationMatch?.[1]?.trim() ?? note.trim();

  if (!observation) {
    return null;
  }

  return {
    category: categoryMatch?.[1]?.trim() || "Observation",
    observation,
    timestamp: date,
    author,
  };
}

function getItemPercent(item: EntryItem["items"][number]) {
  if (item.metricType === "Percentage" && typeof item.rawValue === "number") {
    return clampPercent(item.rawValue);
  }

  if (item.metricType === "Subjective" && typeof item.score === "number") {
    return clampPercent(item.score * 10);
  }

  if (
    (item.metricType === "Frequency" || item.metricType === "Duration") &&
    typeof item.rawValue === "number" &&
    item.rawValue > 0 &&
    typeof item.goalDefinition?.targetValue === "number" &&
    item.goalDefinition.targetValue > 0
  ) {
    switch (item.goalDefinition.comparison) {
      case "LessThan":
        return clampPercent((item.goalDefinition.targetValue / item.rawValue) * 100);
      case "GreaterThan":
        return clampPercent((item.rawValue / item.goalDefinition.targetValue) * 100);
      case "Equal":
        return clampPercent(
          (1 -
            Math.abs(item.rawValue - item.goalDefinition.targetValue) /
              item.goalDefinition.targetValue) *
            100
        );
      default:
        return null;
    }
  }

  return null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getDomainScores(items: EntryItem["items"]) {
  const groups = new Map<string, number[]>();

  for (const item of items) {
    if (!item.domain) {
      continue;
    }

    const percent = getItemPercent(item);
    if (percent === null) {
      continue;
    }

    const existing = groups.get(item.domain) ?? [];
    existing.push(percent);
    groups.set(item.domain, existing);
  }

  return Array.from(groups.entries()).map(([domain, scores]) => ({
    domain,
    percent: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
  }));
}

function formatDomain(domain: string) {
  switch (domain) {
    case "SkillAcquisition":
      return "Skill acquisition";
    default:
      return domain;
  }
}

function formatMetricValue(item: EntryItem["items"][number], percent: number | null) {
  const rawValue =
    typeof item.rawValue === "number" && Number.isFinite(item.rawValue)
      ? `${item.rawValue}${item.metricType === "Percentage" ? "%" : ""}`
      : null;
  const score =
    typeof item.score === "number" && Number.isFinite(item.score)
      ? `${item.score}/10`
      : null;
  const support =
    typeof item.supportLevel === "number" && Number.isFinite(item.supportLevel)
      ? `Support ${item.supportLevel}/10`
      : null;
  const normalized = percent !== null ? `Normalized ${percent}%` : null;

  return [rawValue ?? score ?? item.metricType, normalized, support]
    .filter(Boolean)
    .join(" | ");
}

function formatEducatorResponse(
  item: EntryItem["items"][number],
  isOtProgress = false,
  isSpeechProgress = false,
  isBehaviorTechnicianProgress = false
) {
  const profile = educatorProfileForHistoryItem(item);

  if (profile === "Frequency") {
    if (
      (isOtProgress || isSpeechProgress || isBehaviorTechnicianProgress) &&
      typeof item.score === "number"
    ) {
      return (
        {
          1: "Never",
          2: "Rarely",
          3: "Sometimes",
          4: "Frequently",
        }[item.score] ?? `${item.score}/10`
      );
    }

    return typeof item.rawValue === "number" ? `${item.rawValue}` : "Not recorded";
  }

  if (typeof item.score !== "number") {
    return "Not recorded";
  }

  const educatorLabels: Record<string, Record<number, string>> = {
    Participation: {
      1: "Avoided",
      2: "Participated with Frequent Support",
      3: "Participated with Some Support",
      4: "Independent",
    },
    SupportLevel: {
      1: "Required Full Support",
      2: "Required Some Support",
      3: "Mostly Independent",
      4: "Independent",
    },
    Completion: {
      1: "Did Not Attempt",
      2: "Partial Completion",
      3: "Completed with Support",
      4: "Completed Independently",
    },
    Independence: {
      1: "Required Full Support",
      2: "Required Some Support",
      3: "Mostly Independent",
      4: "Independent",
    },
    Accuracy: {
      1: "Not Yet Accurate",
      2: "Emerging Accuracy",
      3: "Mostly Accurate",
      4: "Consistently Accurate",
    },
  };

  const otLabels: Record<string, Record<number, string>> = {
    Participation: {
      1: "Refused",
      2: "Limited Participation",
      3: "Participated With Prompts",
      4: "Fully Participated",
    },
    SupportLevel: {
      1: "Maximum Assistance",
      2: "Moderate Assistance",
      3: "Minimal Assistance",
      4: "Independent",
    },
    AssistanceLevel: {
      1: "Maximum Assistance",
      2: "Moderate Assistance",
      3: "Minimal Assistance",
      4: "Independent",
    },
    Completion: educatorLabels.Completion,
    Independence: {
      1: "Fully Dependent",
      2: "Needs Frequent Prompts",
      3: "Needs Occasional Prompts",
      4: "Independent",
    },
    Accuracy: educatorLabels.Accuracy,
  };

  const speechLabels: Record<string, Record<number, string>> = {
    Participation: {
      1: "Did Not Participate",
      2: "Participated with Support",
      3: "Participated Consistently",
      4: "Fully Engaged",
    },
    SupportLevel: {
      1: "Maximum Cueing",
      2: "Moderate Cueing",
      3: "Minimal Cueing",
      4: "Independent",
    },
    CueingLevel: {
      1: "Maximum Cueing",
      2: "Moderate Cueing",
      3: "Minimal Cueing",
      4: "Independent",
    },
    Accuracy: educatorLabels.Accuracy,
    Completion: educatorLabels.Completion,
    Independence: otLabels.Independence,
  };

  const behaviorTechnicianLabels: Record<string, Record<number, string>> = {
    ...speechLabels,
    SupportLevel: {
      1: "Maximum Prompting",
      2: "Moderate Prompting",
      3: "Minimal Prompting",
      4: "Independent",
    },
    PromptLevel: {
      1: "Maximum Prompting",
      2: "Moderate Prompting",
      3: "Minimal Prompting",
      4: "Independent",
    },
    Accuracy: educatorLabels.Accuracy,
    Duration: {
      1: "Very Brief",
      2: "Brief",
      3: "Sustained",
      4: "Extended",
    },
    Latency: {
      1: "Long Delay",
      2: "Moderate Delay",
      3: "Brief Delay",
      4: "Immediate",
    },
  };

  const labels = isBehaviorTechnicianProgress
    ? behaviorTechnicianLabels
    : isSpeechProgress
    ? speechLabels
    : isOtProgress
      ? otLabels
      : educatorLabels;

  return labels[profile]?.[item.score] ?? `${item.score}/10`;
}

function educatorProfileForHistoryItem(item: EntryItem["items"][number]) {
  const profile = item.goalDefinition?.measurementProfile;
  if (
    profile === "Participation" ||
    profile === "SupportLevel" ||
    profile === "Completion" ||
    profile === "Independence" ||
    profile === "Frequency" ||
    profile === "PromptLevel" ||
    profile === "Duration" ||
    profile === "Latency" ||
    profile === "Accuracy" ||
    profile === "CueingLevel" ||
    profile === "AssistanceLevel"
  ) {
    return profile;
  }

  if (item.metricType === "Frequency") {
    return "Frequency";
  }

  const normalized = item.target.toLowerCase();
  if (normalized.includes("peer") || normalized.includes("group") || normalized.includes("participation")) {
    return "Participation";
  }

  if (normalized.includes("assignment") || normalized.includes("completion")) {
    return "Completion";
  }

  if (normalized.includes("independent") || normalized.includes("direction")) {
    return "Independence";
  }

  return "SupportLevel";
}

function parseSensoryObservations(value: unknown) {
  if (!value || typeof value !== "object" || !("observations" in value)) {
    return [];
  }

  const observations = (value as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations
    .map((item) => ({
      category:
        typeof item === "object" &&
        item !== null &&
        "category" in item &&
        typeof item.category === "string"
          ? item.category
          : "",
      observation:
        typeof item === "object" &&
        item !== null &&
        "observation" in item &&
        typeof item.observation === "string"
          ? item.observation
          : "",
      recommendation:
        typeof item === "object" &&
        item !== null &&
        "recommendation" in item &&
        typeof item.recommendation === "string"
          ? item.recommendation
          : "",
    }))
    .filter((item) => item.category && item.observation);
}

function getAbcObservation(note: string) {
  if (!/\bABC:|antecedent|behavior=|consequence\b/i.test(note)) {
    return null;
  }

  return note
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => /\bABC:|antecedent|behavior=|consequence\b/i.test(line)) ??
    "A-B-C data documented.";
}
