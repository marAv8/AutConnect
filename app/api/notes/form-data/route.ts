import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadNoteFormData } from "@/app/libs/noteFormData";
import { parseCaretakerContextKind } from "@/app/libs/caretakerContext";
import { parseNoteEntryKind } from "@/app/libs/entryKinds";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const contextKind = parseCaretakerContextKind(searchParams.get("contextKind"));
  const noteKind = parseNoteEntryKind(searchParams.get("noteKind"));
  const workflowKey = searchParams.get("workflowKey") ?? undefined;
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const formData = await loadNoteFormData({
    clientId,
    providerId: session.providerId,
    sessionRole: session.role,
    contextKind,
    noteKind,
    workflowKey,
  });

  if (!formData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(formData);
}
