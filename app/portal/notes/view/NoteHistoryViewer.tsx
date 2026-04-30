"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

type EntryItem = {
  id: string;
  note: string;
  date: string;
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
    } | null;
  }>;
};

type Props = {
  clientId: string;
  clientInitials: string;
  entries: EntryItem[];
  variant?: "page" | "overlay";
  backLabel?: string;
};

const overlayGlassStyle: CSSProperties = {
  background: "rgba(18, 22, 28, 0.42)",
  backdropFilter: "blur(18px) saturate(1.15)",
  WebkitBackdropFilter: "blur(18px) saturate(1.15)",
};

const activeOverlayCardStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.62)",
  background: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "blur(26px) saturate(1.18)",
  WebkitBackdropFilter: "blur(26px) saturate(1.18)",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.34), 0 2px 18px rgba(0, 0, 0, 0.12)",
};

const activePageCardStyle: CSSProperties = {
  border: "1px solid #ddd",
  background: "#fff",
  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.08)",
};

export default function NoteHistoryViewer({
  clientId,
  clientInitials,
  entries,
  variant = "page",
  backLabel = "Back to Client",
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
        <Link
          href={`/dashboard?clientId=${clientId}&view=orbit`}
          style={{
            color: variant === "overlay" ? "#fff" : undefined,
            fontWeight: 600,
            position: "relative",
            zIndex: 6,
            textDecoration: "none",
            textShadow:
              variant === "overlay" ? "0 1px 16px rgba(0, 0, 0, 0.45)" : undefined,
          }}
        >
          {backLabel}
        </Link>
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
              color: variant === "overlay" ? "#fff" : "#444",
              opacity: canNavigateOlder ? 1 : 0,
              position: "absolute",
              left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 5,
            textShadow:
              variant === "overlay" ? "0 2px 18px rgba(0, 0, 0, 0.5)" : undefined,
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
              padding: 40,
              borderRadius: 12,
              ...(variant === "overlay" ? activeOverlayCardStyle : activePageCardStyle),
              height: 500,
              boxSizing: "border-box",
              overflowY: "auto",
              transform: activeCardTransform,
              transition: cardTransition,
              willChange: "transform",
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
            </div>

            {hasComment ? (
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  minHeight: 64,
                  flex: "0 0 auto",
                }}
              >
                {current.note}
              </div>
            ) : null}

            {hasSummary ? (
              <div
                style={{
                  marginBottom: 16,
                  flex: "1 1 auto",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: hasComment ? "flex-start" : "center",
                }}
              >
                <div style={{ marginBottom: 10, fontWeight: 600 }}>Summary</div>
                <div
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {highestScore !== null ? <div>Highest: {highestScore}%</div> : null}
                  {lowestScore !== null ? <div>Lowest: {lowestScore}%</div> : null}
                  {overallPercent !== null ? <div>Overall: {overallPercent}%</div> : null}
                  {domainScores.length > 0 ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      {domainScores.map((domainScore) => (
                        <div key={domainScore.domain}>
                          {formatDomain(domainScore.domain)}: {domainScore.percent}%
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {scoreRange !== null ? (
                    <div style={{ marginTop: 4, opacity: 0.72 }}>
                      Spread: {scoreRange} points between the highest and lowest entries.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
              color: variant === "overlay" ? "#fff" : "#444",
              opacity: canNavigateNewer ? 1 : 0,
              position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 5,
            textShadow:
              variant === "overlay" ? "0 2px 18px rgba(0, 0, 0, 0.5)" : undefined,
          }}
        >
          ›
        </button>
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          ...overlayGlassStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          animation: "noteOverlayFadeIn 260ms ease-out both",
          isolation: "isolate",
        }}
      >
        <div
          style={{
            width: "min(1180px, 100%)",
            maxHeight: "calc(100vh - 64px)",
            overflow: "visible",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
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
            ? "1px solid rgba(255, 255, 255, 0.58)"
            : "1px solid #e5e5e5",
        borderRadius: 12,
        background: variant === "overlay" ? "rgba(255, 255, 255, 0.76)" : "#fff",
        backdropFilter: variant === "overlay" ? "blur(18px) saturate(1.12)" : undefined,
        WebkitBackdropFilter:
          variant === "overlay" ? "blur(18px) saturate(1.12)" : undefined,
        color: variant === "overlay" ? "rgba(23, 23, 23, 0.78)" : undefined,
        opacity: variant === "overlay" ? undefined : 0.42,
        position: "relative",
        zIndex: 1,
        transform,
        transition,
        pointerEvents: "none",
        boxShadow: "0 18px 54px rgba(0, 0, 0, 0.22)",
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
