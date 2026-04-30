"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useInsights, type InsightResponse } from "./useInsights";

type Props = {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
};

const overlayGlassStyle: CSSProperties = {
  background: "rgba(18, 22, 28, 0.42)",
  backdropFilter: "blur(18px) saturate(1.15)",
  WebkitBackdropFilter: "blur(18px) saturate(1.15)",
};

const overlayPanelStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.92)",
  backdropFilter: "blur(26px) saturate(1.18)",
  WebkitBackdropFilter: "blur(26px) saturate(1.18)",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.28), 0 2px 18px rgba(0, 0, 0, 0.1)",
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
          borderRadius: 12,
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
            width: "100%",
            boxSizing: "border-box",
            border: "none",
            borderRadius: 0,
            borderBottom: "1px solid rgba(34, 34, 34, 0.28)",
            background: "transparent",
            color: "#222",
            fontSize: 18,
            lineHeight: 1.35,
            outline: "none",
            padding: "10px 4px 12px",
            textAlign: "center",
          }}
        />

        <button
          type="submit"
          disabled={!question.trim() || isAsking}
          style={{
            border: "none",
            background: "transparent",
            color: "#2248e8",
            cursor: question.trim() && !isAsking ? "pointer" : "default",
            fontSize: 16,
            fontWeight: 600,
            opacity: question.trim() && !isAsking ? 1 : 0.42,
            padding: "4px 8px",
          }}
        >
          {isAsking ? "Asking..." : "Ask"}
        </button>

        {(answer || error) && (
          <div
            style={{
              width: "100%",
              borderTop: "1px solid rgba(34, 34, 34, 0.18)",
              paddingTop: 18,
              display: "grid",
              gap: 10,
              justifyItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: error ? "#8a1f1f" : "#222",
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
