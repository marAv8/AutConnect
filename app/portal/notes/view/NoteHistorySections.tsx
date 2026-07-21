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
  SensoryObservation,
  SupervisorObservation,
} from "./noteHistoryTypes";

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
