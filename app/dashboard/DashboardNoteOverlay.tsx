"use client";

import { useEffect, useState, type ComponentProps } from "react";
import EntryForm from "@/app/portal/notes/add/EntryForm";
import NoteHistoryViewer from "@/app/portal/notes/view/NoteHistoryViewer";

type OverlayType = "view" | "add" | "update";

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
};

type FormOverlayData = {
  clientId: string;
  role: string;
  providerId: string;
  clientName: string;
  providerName: string;
  providerRole: string;
  mode: "create" | "edit";
  initialValues?: {
    note: string;
    items: EntryFormItem[];
  };
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
  onClose: () => void;
  onRead?: (authorProviderId: string) => void;
  onSaved?: (authorProviderId: string, entryId: string) => void;
};

export default function DashboardNoteOverlay({
  overlayType,
  clientId,
  providerId,
  onClose,
  onRead,
  onSaved,
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
  }, [clientId, onRead, overlayType, providerId]);

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

  if ((overlayType === "add" || overlayType === "update") && formData) {
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
          clientId={formData.clientId}
          providerId={formData.providerId}
          role={formData.role}
          mode={overlayType === "update" ? "edit" : formData.mode}
          clientName={formData.clientName}
          providerName={formData.providerName}
          providerRole={formData.providerRole}
          todayLabel={new Date().toLocaleDateString()}
          initialValues={formData.initialValues}
          onSaved={(entryId) => onSaved?.(formData.providerId, entryId)}
          onSubmitted={onClose}
        />
      </div>
    );
  }

  return null;
}
