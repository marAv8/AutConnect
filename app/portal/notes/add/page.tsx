import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import NoteOverlay from "./NoteOverlay";
import { loadNoteFormData } from "@/app/libs/noteFormData";
import { parseCaretakerContextKind } from "@/app/libs/caretakerContext";
import { parseNoteEntryKind } from "@/app/libs/entryKinds";

export default async function AddNotePage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    edit?: string;
    contextKind?: string;
    noteKind?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { clientId, edit, contextKind, noteKind } = await searchParams;
  if (!clientId) redirect("/dashboard");

  const formData = await loadNoteFormData({
    clientId,
    providerId: session.providerId,
    sessionRole: session.role,
    forceEditMode: edit === "1",
    requireAssignedClient: false,
    contextKind: parseCaretakerContextKind(contextKind ?? null),
    noteKind: parseNoteEntryKind(noteKind ?? null),
  });

  if (!formData) redirect("/dashboard");

  return (
    <NoteOverlay
      clientId={formData.clientId}
      role={formData.role}
      providerId={formData.providerId}
      clientName={formData.clientName}
      providerName={formData.providerName}
      providerRole={formData.providerRole}
      mode={formData.mode}
      initialValues={formData.initialValues}
      draft={formData.draft}
      draftWorkflowKey={formData.draftWorkflowKey}
      targetOptions={formData.targetOptions}
      noteKind={formData.noteKind}
      contextKind={formData.contextKind}
      contextCards={formData.contextCards}
    />
  );
}
