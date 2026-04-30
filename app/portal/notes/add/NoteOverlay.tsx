"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import EntryForm from "./EntryForm";

type Props = {
  clientId: string;
  role: string;
  providerId: string;
  clientName: string;
  providerName: string;
  providerRole: string;
  goalDefinitions: {
    id: string;
    target: string;
    goal: string;
    metricType: "Percentage" | "Frequency" | "Duration" | "Subjective";
    domain:
      | "Behavior"
      | "SkillAcquisition"
      | "Communication"
      | "Adaptive"
      | "Regulation"
      | "Other"
      | null;
    targetValue: number | null;
    comparison: "LessThan" | "GreaterThan" | "Equal" | null;
    weight: number;
  }[];
  mode?: "create" | "edit";
  initialValues?: {
    note: string;
    items: {
      goalId: string;
      target: string;
      goal: string;
      score: string;
      metricType: "Percentage" | "Frequency" | "Duration" | "Subjective" | "";
      domain:
        | "Behavior"
        | "SkillAcquisition"
        | "Communication"
        | "Adaptive"
        | "Regulation"
        | "Other"
        | "";
      rawValue: string;
      supportLevel: string;
    }[];
  };
};

const overlayGlassStyle: CSSProperties = {
  background: "rgba(18, 22, 28, 0.42)",
  backdropFilter: "blur(18px) saturate(1.15)",
  WebkitBackdropFilter: "blur(18px) saturate(1.15)",
};

const overlayPanelStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.62)",
  background: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "blur(26px) saturate(1.18)",
  WebkitBackdropFilter: "blur(26px) saturate(1.18)",
  boxShadow: "0 34px 90px rgba(0, 0, 0, 0.34), 0 2px 18px rgba(0, 0, 0, 0.12)",
};

export default function NoteOverlay({
  clientId,
  role,
  providerId,
  clientName,
  providerName,
  providerRole,
  goalDefinitions,
  mode = "create",
  initialValues,
}: Props) {
  const today = new Date().toLocaleDateString();
  const backLabel = role === "Caregiver" ? "Back to Children" : "Back to Client";

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
        isolation: "isolate",
      }}
    >
      <div
        style={{
          maxHeight: "calc(100vh - 64px)",
          maxWidth: 1220,
          width: "100%",
          overflowY: "auto",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Link
            href={`/dashboard?clientId=${clientId}&view=orbit`}
            style={{
              color: "#fff",
              fontWeight: 600,
              position: "relative",
              zIndex: 6,
              textDecoration: "none",
              textShadow: "0 1px 16px rgba(0, 0, 0, 0.45)",
            }}
          >
            {backLabel}
          </Link>
        </div>

        <div
          style={{
            ...overlayPanelStyle,
            borderRadius: 12,
            margin: "0 auto",
            maxWidth: 1120,
            padding: "28px 32px 32px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <EntryForm
            clientId={clientId}
            providerId={providerId}
            role={role}
            mode={mode}
            goalDefinitions={goalDefinitions}
            clientName={clientName}
            providerName={providerName}
            providerRole={providerRole}
            todayLabel={today}
            initialValues={initialValues}
          />
        </div>
      </div>
    </div>
  );
}
