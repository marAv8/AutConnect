"use client";

import { useEffect, useState, type ComponentProps } from "react";
import type {
  CaretakerContextCard,
  CaretakerContextKind,
} from "@/app/libs/caretakerContext";
import type { NoteEntryKind } from "@/app/libs/entryKinds";
import EntryForm from "@/app/portal/notes/add/EntryForm";
import NoteHistoryViewer from "@/app/portal/notes/view/NoteHistoryViewer";

type OverlayType = "view" | "add" | "update" | "educatorTarget";

type EntryFormItem = {
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
    measurementProfile?: string | null;
  };

type FormOverlayData = {
  clientId: string;
  role: string;
  providerId: string;
  clientName: string;
  providerName: string;
  providerRole: string;
  targetOptions: TargetOption[];
  noteKind?: NoteEntryKind;
  contextKind?: CaretakerContextKind;
  contextCards?: CaretakerContextCard[];
  mode: "create" | "edit";
  initialValues?: {
    note: string;
    items: EntryFormItem[];
    visibility?: "Private" | "Shared";
    contextValues?: Record<string, string>;
    contextComment?: string;
  };
  draft?: {
    data: unknown;
    updatedAt: string;
  } | null;
  draftWorkflowKey: string;
};

type TargetOption = {
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

type HistoryOverlayData = {
  clientId: string;
  clientInitials: string;
  backLabel: string;
  entries: ComponentProps<typeof NoteHistoryViewer>["entries"];
};

type Props = {
  overlayType: OverlayType;
  clientId: string;
  providerId: string;
  noteKind?: NoteEntryKind | null;
  contextKind?: CaretakerContextKind | null;
  onClose: () => void;
  onRead?: (authorProviderId: string) => void;
  onSaved?: (
    authorProviderId: string,
    entryId: string,
    visibility?: "Private" | "Shared",
    status?: string
  ) => void;
  onReturnToProgress?: () => void;
};

export default function DashboardNoteOverlay({
  overlayType,
  clientId,
  providerId,
  noteKind,
  contextKind,
  onClose,
  onRead,
  onSaved,
  onReturnToProgress,
}: Props) {
  const [formData, setFormData] = useState<FormOverlayData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryOverlayData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadOverlayData() {
      setStatus("loading");
      setFormData(null);
      setHistoryData(null);

      try {
        const params = new URLSearchParams({ clientId });
        if (overlayType === "view") {
          params.set("authorProviderId", providerId);
        } else if (overlayType === "educatorTarget") {
          params.set("noteKind", noteKind ?? "SessionNote");
          params.set("workflowKey", `${noteKind ?? "SessionNote"}:addTarget`);
        } else if (contextKind) {
          params.set("contextKind", contextKind);
          params.set("workflowKey", contextKind);
        } else if (noteKind) {
          params.set("noteKind", noteKind);
          params.set("workflowKey", noteKind);
        }

        const endpoint =
          overlayType === "view"
            ? `/api/notes/history?${params.toString()}`
            : `/api/notes/form-data?${params.toString()}`;

        const response = await fetch(endpoint, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load note overlay: ${response.status}`);
        }

        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        if (overlayType === "view") {
          if (!payload.entries?.length) {
            setStatus("empty");
            return;
          }

          setHistoryData(payload);
          onRead?.(providerId);
        } else {
          setFormData(payload);
        }

        setStatus("ready");
      } catch (error) {
        if (!isMounted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setStatus("error");
      }
    }

    loadOverlayData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientId, contextKind, noteKind, onRead, overlayType, providerId]);

  if (status === "loading") {
    return (
      <div className="p-8 text-center text-foreground">
        Loading notes...
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="p-8 text-center text-foreground">
        <p className="mb-6">No notes are available for this provider yet.</p>
        <button type="button" onClick={onClose} className="back-link">
          Client
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-8 text-center text-foreground">
        <p className="mb-6">Notes could not be loaded.</p>
        <button type="button" onClick={onClose} className="back-link">
          Client
        </button>
      </div>
    );
  }

  if (overlayType === "view" && historyData) {
    return (
      <NoteHistoryViewer
        clientId={historyData.clientId}
        clientInitials={historyData.clientInitials}
        entries={historyData.entries}
        variant="page"
        backLabel={historyData.backLabel}
        onClose={onClose}
      />
    );
  }

  if (
    (overlayType === "add" ||
      overlayType === "update" ||
      overlayType === "educatorTarget") &&
    formData
  ) {
    return (
      <div>
        <div className="mb-6 flex items-center">
          <button
            type="button"
            onClick={onClose}
            className="back-link"
          >
            {formData.role === "Caregiver" ? "Children" : "Client"}
          </button>
        </div>
          <EntryForm
          key={`${overlayType}-${formData.noteKind ?? "SessionNote"}-${formData.clientId}-${formData.providerId}`}
          clientId={formData.clientId}
          providerId={formData.providerId}
          role={formData.role}
          mode={overlayType === "update" ? "edit" : formData.mode}
          clientName={formData.clientName}
          providerName={formData.providerName}
          providerRole={formData.providerRole}
          todayLabel={new Date().toLocaleDateString()}
          initialValues={formData.initialValues}
          draft={formData.draft}
          draftWorkflowKey={formData.draftWorkflowKey}
          targetOptions={formData.targetOptions}
          noteKind={formData.noteKind}
          contextKind={formData.contextKind}
          contextCards={formData.contextCards}
          educatorMode={overlayType === "educatorTarget" ? "addTarget" : undefined}
          onSaved={(entryId, visibility, status) =>
            onSaved?.(formData.providerId, entryId, visibility, status)
          }
          onSubmitted={onClose}
          onCancel={onClose}
          onCancelToProgress={onReturnToProgress}
        />
      </div>
    );
  }

  return null;
}
