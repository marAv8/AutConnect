"use client";

import { createEntry } from "@/app/actions/createEntry";
import { useCallback } from "react";
import { buildPayload, type EntryItemDraft } from "./entryFormHelpers";

type SubmitEntryData = {
  clientId: string;
  note: string;
  items: EntryItemDraft[];
  canSubmitCommentOnly: boolean;
  redirectOnSuccess?: boolean;
};

type SubmitEntryResult = Awaited<ReturnType<typeof createEntry>> & {
  noteForSave: string;
};

export function useEntrySubmit() {
  const handleSubmit = useCallback(
    async ({
      clientId,
      note,
      items,
      canSubmitCommentOnly,
      redirectOnSuccess = false,
    }: SubmitEntryData): Promise<SubmitEntryResult> => {
      const payload = buildPayload({
        clientId,
        note,
        items,
        canSubmitCommentOnly,
      });

      if (!payload.ok) {
        return { ok: false, reason: "invalid_data", noteForSave: payload.noteForSave };
      }

      const result = await createEntry(payload.formData);

      if (result.ok && redirectOnSuccess) {
        // Kept for backwards-compatible callers; note overlays close in place.
      }

      return { ...result, noteForSave: payload.noteForSave };
    },
    []
  );

  return { handleSubmit };
}
