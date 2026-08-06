"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useInsights, type InsightResponse } from "./useInsights";
import {
  INSIGHT_CATEGORY_DEFINITIONS,
  type InsightCategory,
} from "@/app/libs/insights/categories";
import { formatClinicalShortDateTime } from "@/app/libs/dateTime";

type Props = {
  clientId: string;
  isOpen: boolean;
  hasCaseSupportAccess?: boolean;
  onClose: () => void;
};

const overlayGlassStyle: CSSProperties = {
  background: "rgb(0 0 0 / 25%)",
  backdropFilter: "blur(3px)",
  WebkitBackdropFilter: "blur(3px)",
};

const overlayPanelStyle: CSSProperties = {
  background: "var(--note-neo-surface)",
  border: "none",
  boxShadow: "var(--note-neo-raised)",
};

const recessedInputStyle: CSSProperties = {
  background: "rgb(255 255 255 / 78%)",
  border: "none",
  boxShadow: "var(--note-neo-input)",
};

const elevatedControlStyle: CSSProperties = {
  background: "var(--note-neo-surface)",
  border: "none",
  boxShadow: "var(--note-neo-control)",
};

export default function InsightsOverlay({
  clientId,
  isOpen,
  hasCaseSupportAccess = false,
  onClose,
}: Props) {
  const { ask } = useInsights(clientId);
  const [category, setCategory] = useState<InsightCategory>("overview");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<InsightResponse | null>(null);
  const [error, setError] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setCategory("overview");
      setQuestion("");
      setAnswer(null);
      setError("");
      setIsAsking(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isAsking) return;

    setIsAsking(true);
    setError("");

    try {
      const result = await ask(trimmedQuestion, category);
      setAnswer(result);
    } catch (caught) {
      setAnswer(null);
      setError(caught instanceof Error ? caught.message : "Unable to load insight.");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div
      className="insights-overlay-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        ...overlayGlassStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        isolation: "isolate",
      }}
      onClick={onClose}
    >
      <form
        className="insights-overlay-panel"
        onSubmit={onSubmit}
        style={{
          ...overlayPanelStyle,
          width: "min(100%, 720px)",
          maxHeight: "min(88vh, 760px)",
          overflowY: "auto",
          borderRadius: 18,
          padding: "26px clamp(18px, 5vw, 34px) 30px",
          boxSizing: "border-box",
          display: "grid",
          justifyItems: "center",
          gap: 18,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
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
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 650 }}>
            Insights
          </h2>
          <span aria-hidden="true" />
        </div>

        <div
          aria-label="Insight categories"
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
          }}
        >
          {INSIGHT_CATEGORY_DEFINITIONS.filter(
            (definition) =>
              definition.id !== "caseSupport" || hasCaseSupportAccess
          ).map((definition) => {
            const selected = category === definition.id;
            return (
              <button
                key={definition.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  setCategory(definition.id);
                  setQuestion("");
                  setAnswer(null);
                  setError("");
                }}
                style={{
                  background: selected
                    ? "rgb(255 255 255 / 92%)"
                    : "rgb(255 255 255 / 58%)",
                  border: selected
                    ? "1px solid rgb(40 55 76 / 28%)"
                    : "1px solid rgb(40 55 76 / 10%)",
                  borderRadius: 13,
                  boxShadow: selected
                    ? "0 5px 14px rgb(31 42 57 / 12%)"
                    : "none",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  display: "grid",
                  gap: 4,
                  minHeight: 76,
                  padding: "12px 10px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 650 }}>
                  {definition.label}
                </span>
                <span
                  style={{
                    color: "rgba(34, 34, 34, 0.6)",
                    fontSize: 11,
                    lineHeight: 1.25,
                  }}
                >
                  {definition.description}
                </span>
              </button>
            );
          })}
        </div>

        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={
            INSIGHT_CATEGORY_DEFINITIONS.find(
              (definition) => definition.id === category
            )?.placeholder ?? "Ask about this client"
          }
          style={{
            ...recessedInputStyle,
            width: "100%",
            boxSizing: "border-box",
            color: "var(--foreground)",
            fontSize: 18,
            lineHeight: 1.35,
            outline: "none",
            padding: "12px 18px",
            borderRadius: 14,
            textAlign: "center",
          }}
        />

        <button
          type="submit"
          disabled={!question.trim() || isAsking}
          style={{
            ...elevatedControlStyle,
            borderRadius: 13,
            color: "var(--foreground)",
            cursor: question.trim() && !isAsking ? "pointer" : "default",
            fontSize: 16,
            fontWeight: 600,
            opacity: question.trim() && !isAsking ? 1 : 0.42,
            padding: "8px 16px",
          }}
        >
          {isAsking ? "Asking..." : "Ask"}
        </button>

        <div
          className="insights-answer-viewport"
          aria-live="polite"
          aria-busy={isAsking}
        >
          {isAsking && !answer && !error ? (
            <div className="insights-answer-status">Reviewing client records…</div>
          ) : null}

          {(answer || error) ? (
            <div className="insights-answer-content">
            <div
              style={{
                color: error ? "var(--danger)" : "var(--foreground)",
                fontSize: 18,
                lineHeight: 1.48,
                maxWidth: 480,
              }}
            >
              {answer?.headline && !error ? (
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.035em",
                  }}
                >
                  {answer.headline}
                </div>
              ) : null}
              {error || answer?.summary}
            </div>

            {answer?.evidence?.length ? (
              <div
                style={{
                  width: "100%",
                  display: "grid",
                  gap: 8,
                  textAlign: "left",
                }}
              >
                {answer.evidence.slice(0, 4).map((item, index) => (
                  <div
                    key={`${item.sourceId ?? item.label}:${index}`}
                    style={{
                      background: "rgb(255 255 255 / 64%)",
                      border: "1px solid rgb(40 55 76 / 10%)",
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {item.label}
                    </div>
                    <div
                      style={{
                        color: "rgba(34, 34, 34, 0.72)",
                        fontSize: 13,
                        lineHeight: 1.4,
                        marginTop: 2,
                      }}
                    >
                      {item.value}
                    </div>
                    {item.date ? (
                      <div
                        style={{
                          color: "rgba(34, 34, 34, 0.48)",
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        {formatClinicalShortDateTime(item.date)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {answer?.trend || answer?.supportingData?.sessions !== undefined ? (
              <div
                style={{
                  color: "rgba(34, 34, 34, 0.62)",
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {answer.trend ? `Trend: ${answer.trend}` : null}
                {answer.trend && answer.supportingData?.sessions !== undefined ? " · " : null}
                {answer.supportingData?.sessions !== undefined
                  ? `${answer.supportingData.sessions} sessions`
                  : null}
              </div>
            ) : null}

            {answer?.confidence ? (
              <div
                style={{
                  color: "rgba(34, 34, 34, 0.58)",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {answer.answerMode === "synthesized"
                  ? `Synthesized from ${
                      answer.evidence?.length ?? 0
                    } cited record${answer.evidence?.length === 1 ? "" : "s"}`
                  : answer.answerMode === "insufficient"
                    ? "Available records are insufficient"
                    : "Verified from structured records"}
                {" · "}
                {`${answer.confidence[0].toUpperCase()}${answer.confidence.slice(
                  1
                )} confidence`}
              </div>
            ) : null}

            {answer?.limitations?.length ? (
              <div
                style={{
                  color: "rgba(34, 34, 34, 0.56)",
                  fontSize: 12,
                  lineHeight: 1.45,
                  maxWidth: 480,
                }}
              >
                {answer.limitations.join(" ")}
              </div>
            ) : null}
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
