"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentSupervisor } from "@/lib/authorization";
import { activeClientTeamManagerWhere } from "@/lib/clientTeamAuthorizationPolicy";
import { db } from "@/lib/db";

export async function removeSupervisorClient(clientId: string) {
  const supervisor = await requireCurrentSupervisor();
  await db.$transaction(async (tx) => {
    const assignment = await tx.providerClient.findFirst({
      where: { clientId, providerId: supervisor.id, revokedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!assignment) return;
    const now = new Date();
    await tx.providerClient.update({
      where: { id: assignment.id },
      data: {
        revokedAt: now,
        revokedById: supervisor.id,
        revocationReason: "SUPERVISOR_LEFT_CLIENT",
      },
    });
    await tx.clientTeamManager.updateMany({
      where: { clientId, providerId: supervisor.id, revokedAt: null },
      data: { revokedAt: now, revokedById: supervisor.id },
    });
    await tx.clientTeamAuditEvent.create({
      data: {
        clientId,
        actorId: supervisor.id,
        action: "PROVIDER_REVOKED",
        subjectProviderId: supervisor.id,
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
      },
    });
  });
  revalidatePath("/dashboard");
  revalidatePath("/portal/supervisor/edit-providers");
  return { ok: true };
}

export async function addSupervisorClient(
  clientId: string
): Promise<{ ok: boolean }> {
  void clientId;
  await requireCurrentSupervisor();
  throw new Error(
    "Legacy Link Client is unavailable. Use the approved attach-request workflow."
  );
}

export async function updateClientAssignments(formData: FormData): Promise<void> {
  const supervisor = await requireCurrentSupervisor();
  const clientId = formData.get("clientId")?.toString();
  const fullNameValue = formData.get("fullName")?.toString().trim() ?? "";
  const receivesPrescribedMedication =
    formData.get("receivesPrescribedMedication") === "true";
  if (!clientId) throw new Error("Missing client id");
  const nameParts = fullNameValue.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  if (!firstName || !lastName) throw new Error("Client first and last name required");

  const manager = await db.clientTeamManager.findFirst({
    where: activeClientTeamManagerWhere(supervisor.id, clientId),
    select: { id: true },
  });
  if (!manager) throw new Error("Unauthorized");
  await db.client.update({
    where: { id: clientId },
    data: { firstName, lastName, receivesPrescribedMedication },
  });
  revalidatePath("/dashboard");
  revalidatePath("/portal/supervisor/edit-providers");
  revalidatePath(`/portal/supervisor/edit-providers/${clientId}`);
  redirect(`/dashboard?clientId=${clientId}&view=orbit`);
}

export type ClientDetailsUpdateState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateClientDetailsFromCareTeam(
  _previousState: ClientDetailsUpdateState,
  formData: FormData
): Promise<ClientDetailsUpdateState> {
  try {
    const supervisor = await requireCurrentSupervisor();
    const clientId = formData.get("clientId")?.toString();
    const fullNameValue = formData.get("fullName")?.toString().trim() ?? "";
    const medicationValue = formData.get("receivesPrescribedMedication");
    if (!clientId || (medicationValue !== "true" && medicationValue !== "false")) {
      return { status: "error", message: "Client details could not be saved." };
    }

    const nameParts = fullNameValue.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ");
    if (!firstName || !lastName) {
      return {
        status: "error",
        message: "Enter the Client's first and last name.",
      };
    }

    const manager = await db.clientTeamManager.findFirst({
      where: activeClientTeamManagerWhere(supervisor.id, clientId),
      select: { id: true },
    });
    if (!manager) {
      return { status: "error", message: "Client details could not be saved." };
    }

    await db.client.update({
      where: { id: clientId },
      data: {
        firstName,
        lastName,
        receivesPrescribedMedication: medicationValue === "true",
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/portal/supervisor/edit-providers");
    revalidatePath(`/portal/supervisor/edit-providers/${clientId}`);
    return { status: "success", message: "Client details saved" };
  } catch {
    return { status: "error", message: "Client details could not be saved." };
  }
}
