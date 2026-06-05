"use client";

import Link from "next/link";
import OverlayContainer from "@/components/ui/OverlayContainer";
import EntryForm from "./EntryForm";

type Props = {
  clientId: string;
  role: string;
  providerId: string;
  clientName: string;
  providerName: string;
  providerRole: string;
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
  onClose?: () => void;
  onSubmitted?: () => void;
};

export default function NoteOverlay({
  clientId,
  role,
  providerId,
  clientName,
  providerName,
  providerRole,
  mode = "create",
  initialValues,
  onClose,
  onSubmitted,
}: Props) {
  const today = new Date().toLocaleDateString();
  const backLabel = role === "Caregiver" ? "Back to Children" : "Back to Client";

  return (
    <OverlayContainer>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div className="mb-6 flex items-center">
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

        <div className="paper-surface add-note-shell p-8">
          <EntryForm
            clientId={clientId}
            providerId={providerId}
            role={role}
            mode={mode}
            clientName={clientName}
            providerName={providerName}
            providerRole={providerRole}
            todayLabel={today}
            initialValues={initialValues}
            onSubmitted={onSubmitted}
          />
        </div>
      </div>
    </OverlayContainer>
  );
}
