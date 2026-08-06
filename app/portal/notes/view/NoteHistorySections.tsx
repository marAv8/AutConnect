/**
 * Reusable visual pieces inside the provider note history overlay.
 *
 * These components render the adjacent-note preview and the touch-friendly
 * dropdown sections. NoteHistoryViewer decides which sections belong to each
 * provider role; this file only controls their shared presentation.
 */

import type { ReactNode } from "react";
import { formatClinicalDateTime } from "@/app/libs/dateTime";
import type {
  NoteHistoryEntry,
  NoteHistoryRevision,
  SensoryObservation,
  SupervisorObservation,
} from "./noteHistoryTypes";
import { formatRevisionUpdate } from "./noteHistoryRevision";

export function NotePreviewCard({
  entry,
  side,
  variant,
  transform,
  transition,
}: {
  entry: NoteHistoryEntry | null;
  side: "left" | "right";
  variant: "page" | "overlay";
  transform: string;
  transition: string;
}) {
  if (!entry) {
    return <div aria-hidden="true" />;
  }

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
        boxShadow: "none",
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
    </div>
  );
}

export function CollapsibleRecordSection({
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
          textAlign: "center",
          padding: "8px 12px",
        }}
      >
        {title}
      </summary>
      <div
        style={{
          border: "1px solid rgb(35 45 55 / 9%)",
          borderRadius: 10,
          padding: 12,
          background: "var(--surface)",
          boxShadow: "none",
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function SensoryObservationSection({
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

export function SupervisorObservationSection({
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

export function RevisionHistorySection({
  revisions,
}: {
  revisions: NoteHistoryRevision[];
}) {
  const updates = revisions
    .filter((revision) => revision.revisionNumber > 1)
    .map((revision) => ({
      ...revision,
      visibleChanges: revision.changes
        .map((change) => ({
          ...change,
          displayValue: formatRevisionUpdate(change.before, change.after),
        }))
        .filter(
          (
            change
          ): change is typeof change & {
            displayValue: string;
          } => Boolean(change.displayValue)
        ),
    }))
    .filter((revision) => revision.visibleChanges.length > 0)
    .sort((left, right) => right.revisionNumber - left.revisionNumber);

  if (updates.length === 0) {
    return null;
  }

  return (
    <CollapsibleRecordSection
      title={`Updates (${updates.length})`}
    >
      <div style={{ display: "grid", gap: 16 }}>
        {updates.map((revision) => (
          <div
            key={revision.id}
            style={{
              display: "grid",
              gap: 10,
              paddingBottom: 16,
              borderBottom: "1px solid rgb(35 45 55 / 9%)",
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.68 }}>
              Updated {formatClinicalDateTime(revision.createdAt)} by{" "}
              {revision.createdByName}
            </div>
            {revision.visibleChanges.map((change) => (
              <div key={`${revision.id}-${change.path}`} style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 600 }}>{change.label}</div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {change.displayValue}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </CollapsibleRecordSection>
  );
}
