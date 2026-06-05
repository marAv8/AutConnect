"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useInsights, type InsightResponse } from "./useInsights";

type Props = {
  clientId: string;
  isOpen: boolean;
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

export default function InsightsOverlay({ clientId, isOpen, onClose }: Props) {
  const { ask } = useInsights(clientId);
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
      const result = await ask(trimmedQuestion);
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
        onSubmit={onSubmit}
        style={{
          ...overlayPanelStyle,
          width: "min(100%, 560px)",
          borderRadius: 18,
          padding: "30px 32px",
          boxSizing: "border-box",
          display: "grid",
          justifyItems: "center",
          gap: 18,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this client"
          autoFocus
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

        {(answer || error) && (
          <div
            style={{
              width: "100%",
              borderTop: "none",
              paddingTop: 18,
              display: "grid",
              gap: 10,
              justifyItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: error ? "var(--danger)" : "var(--foreground)",
                fontSize: 18,
                lineHeight: 1.48,
                maxWidth: 480,
              }}
            >
              {error || answer?.summary}
            </div>

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
          </div>
        )}
      </form>
    </div>
  );
}
