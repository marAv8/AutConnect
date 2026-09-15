"use client";

import Link from "next/link";
import OverlayContainer from "@/components/ui/OverlayContainer";
import EntryForm from "./EntryForm";
import type {
  CaretakerContextCard,
  CaretakerContextKind,
} from "@/app/libs/caretakerContext";
import type { NoteEntryKind } from "@/app/libs/entryKinds";
import AuthenticatedPageHeader from "@/app/components/AuthenticatedPageHeader";

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
    contextValues?: Record<string, string>;
    contextComment?: string;
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
      observation: string;
      measurementProfile?: string | null;
    }[];
  };
  draft?: {
    data: unknown;
    updatedAt: string;
  } | null;
  draftWorkflowKey?: string;
  targetOptions?: ComponentTargetOption[];
  noteKind?: NoteEntryKind;
  contextKind?: CaretakerContextKind;
  contextCards?: CaretakerContextCard[];
  onClose?: () => void;
  onSubmitted?: () => void;
  educatorMode?: "classroomProgress" | "addTarget";
};

type ComponentTargetOption = {
  value: string;
  label: string;
  recommendedMetricType: "Percentage" | "Frequency" | "Duration" | "Subjective";
  defaultDomain:
    | "Behavior"
    | "SkillAcquisition"
    | "Communication"
    | "Adaptive"
    | "Regulation"
    | "Other";
  description?: string;
  tags?: string[];
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
  draft,
  draftWorkflowKey,
  targetOptions,
  noteKind,
  contextKind,
  contextCards,
  onClose,
  onSubmitted,
  educatorMode,
}: Props) {
  const today = new Date().toLocaleDateString();
  return (
    <OverlayContainer>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {role === "Supervisor" ? (
          <AuthenticatedPageHeader displayName={providerName} role={role} />
        ) : null}
        <div className="mb-6 flex items-center">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="back-link"
            >
              Back
            </button>
          ) : (
            <Link
              href={`/dashboard?clientId=${clientId}&view=orbit`}
              className="back-link"
            >
              Back
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
            draft={draft}
            draftWorkflowKey={draftWorkflowKey}
            targetOptions={targetOptions}
            noteKind={noteKind}
            contextKind={contextKind}
            contextCards={contextCards}
            educatorMode={educatorMode}
            onSubmitted={onSubmitted}
          />
        </div>
      </div>
    </OverlayContainer>
  );
}
