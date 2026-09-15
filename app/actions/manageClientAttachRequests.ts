"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireCurrentProvider } from "@/lib/authorization";
import {
  activeClientAssignmentWhere,
  activeClientTeamManagerWhere,
  boundedClientTeamAuditMetadata,
} from "@/lib/clientTeamAuthorizationPolicy";
import {
  CLIENT_ATTACH_RATE_LIMIT,
  attachRateLimitBucketStart,
  boundedAttachReason,
  canCancelClientAttachRequest,
  canCreateClientAttachRequest,
  canDecideClientAttachRequest,
  directAttachAdministratorWhere,
  genericClientAttachResponse,
  isOrganizationAlreadyParticipating,
} from "@/lib/clientAttachPolicy";
import { db } from "@/lib/db";

type Transaction = Prisma.TransactionClient;
type SecurityOutcome =
  | "REQUEST_CREATED"
  | "CASE_CODE_NOT_FOUND"
  | "ALREADY_PARTICIPATING"
  | "PENDING_REQUEST_EXISTS"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "FAILED_CLOSED";

export type ClientAttachRequestState = {
  status: "idle" | "submitted";
  message: string;
};

function submittedValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function recordSecurityOutcome(
  tx: Transaction,
  input: {
    actorId: string;
    organizationId?: string;
    requestId?: string;
    outcome: SecurityOutcome;
  }
) {
  await tx.clientAttachSecurityEvent.create({
    data: {
      actorId: input.actorId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      outcome: input.outcome,
    },
  });
}

async function consumeClientAttachRateLimit(
  tx: Transaction,
  actorId: string,
  organizationId: string,
  now: Date
) {
  const bucketStartedAt = attachRateLimitBucketStart(now);
  const rows = await tx.$queryRaw<Array<{ attemptCount: number }>>`
    INSERT INTO "ClientAttachRateLimitBucket" (
      "id", "providerId", "organizationId", "bucketStartedAt",
      "attemptCount", "createdAt", "updatedAt"
    )
    VALUES (
      ${randomUUID()}, ${actorId}, ${organizationId}, ${bucketStartedAt},
      1, ${now}, ${now}
    )
    ON CONFLICT ("providerId", "organizationId", "bucketStartedAt")
    DO UPDATE SET
      "attemptCount" = "ClientAttachRateLimitBucket"."attemptCount" + 1,
      "updatedAt" = EXCLUDED."updatedAt"
    WHERE "ClientAttachRateLimitBucket"."attemptCount" < ${CLIENT_ATTACH_RATE_LIMIT}
    RETURNING "attemptCount"
  `;
  return rows.length === 1;
}

async function bestEffortSecurityAudit(input: {
  actorId: string;
  organizationId?: string;
  outcome: SecurityOutcome;
}) {
  try {
    await db.clientAttachSecurityEvent.create({
      data: input,
    });
  } catch {
    // A failed durable security/rate-limit dependency must never open access.
  }
}

export async function requestExistingClientAttachment(
  _previousState: ClientAttachRequestState,
  formData: FormData
): Promise<ClientAttachRequestState> {
  const publicResponse = genericClientAttachResponse();
  let actor: Awaited<ReturnType<typeof requireCurrentProvider>>;
  try {
    actor = await requireCurrentProvider();
  } catch {
    return publicResponse;
  }

  const organizationId = submittedValue(formData, "organizationId");
  const submittedCaseCode = submittedValue(formData, "caseCode");

  try {
    await db.$transaction(
      async (tx) => {
        const [organization, membership] = await Promise.all([
          organizationId
            ? tx.organization.findUnique({
                where: { id: organizationId },
                select: { id: true },
              })
            : Promise.resolve(null),
          organizationId
            ? tx.organizationMembership.findFirst({
                where: {
                  providerId: actor.id,
                  organizationId,
                  active: true,
                },
                select: {
                  providerId: true,
                  organizationId: true,
                  role: true,
                  active: true,
                },
              })
            : Promise.resolve(null),
        ]);

        if (
          !organization ||
          !membership ||
          !canCreateClientAttachRequest({
            actorId: actor.id,
            organizationId,
            providerStatus: actor.status,
            membership,
            organizationParticipates: false,
            pendingRequestExists: false,
          })
        ) {
          await recordSecurityOutcome(tx, {
            actorId: actor.id,
            organizationId: organization?.id,
            outcome: "UNAUTHORIZED",
          });
          return;
        }

        const now = new Date();
        if (
          !(await consumeClientAttachRateLimit(
            tx,
            actor.id,
            organizationId,
            now
          ))
        ) {
          await recordSecurityOutcome(tx, {
            actorId: actor.id,
            organizationId,
            outcome: "RATE_LIMITED",
          });
          return;
        }

        const client =
          submittedCaseCode.length > 0 && submittedCaseCode.length <= 128
            ? await tx.client.findUnique({
                where: { caseCode: submittedCaseCode },
                select: { id: true },
              })
            : null;

        if (!client) {
          await recordSecurityOutcome(tx, {
            actorId: actor.id,
            organizationId,
            outcome: "CASE_CODE_NOT_FOUND",
          });
          return;
        }

        const [participation, pendingRequest, latestTerminalRequest] =
          await Promise.all([
            tx.clientOrganization.findUnique({
              where: {
                clientId_organizationId: {
                  clientId: client.id,
                  organizationId,
                },
              },
              select: { status: true, revokedAt: true },
            }),
            tx.clientAttachRequest.findFirst({
              where: {
                clientId: client.id,
                organizationId,
                status: "PENDING",
              },
              select: { id: true },
            }),
            tx.clientAttachRequest.findFirst({
              where: {
                clientId: client.id,
                organizationId,
                status: { in: ["REJECTED", "CANCELLED"] },
              },
              orderBy: { requestedAt: "desc" },
              select: { status: true },
            }),
          ]);

        const organizationParticipates =
          isOrganizationAlreadyParticipating(participation);
        if (
          !canCreateClientAttachRequest({
            actorId: actor.id,
            organizationId,
            providerStatus: actor.status,
            membership,
            organizationParticipates,
            pendingRequestExists: Boolean(pendingRequest),
          })
        ) {
          await recordSecurityOutcome(tx, {
            actorId: actor.id,
            organizationId,
            outcome: organizationParticipates
              ? "ALREADY_PARTICIPATING"
              : "PENDING_REQUEST_EXISTS",
          });
          return;
        }

        const request = await tx.clientAttachRequest.create({
          data: {
            clientId: client.id,
            organizationId,
            requestedById: actor.id,
          },
          select: { id: true },
        });
        await Promise.all([
          tx.clientTeamAuditEvent.create({
            data: {
              clientId: client.id,
              actorId: actor.id,
              action: "ATTACH_REQUESTED",
              organizationId,
              metadata: boundedClientTeamAuditMetadata({
                transition: latestTerminalRequest ? "REREQUESTED" : "REQUESTED",
                priorDisposition: latestTerminalRequest?.status ?? null,
              }),
            },
          }),
          recordSecurityOutcome(tx, {
            actorId: actor.id,
            organizationId,
            requestId: request.id,
            outcome: "REQUEST_CREATED",
          }),
        ]);
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    const duplicatePendingConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";
    await bestEffortSecurityAudit({
      actorId: actor.id,
      organizationId: duplicatePendingConflict ? organizationId : undefined,
      outcome: duplicatePendingConflict
        ? "PENDING_REQUEST_EXISTS"
        : "FAILED_CLOSED",
    });
  }

  revalidatePath("/portal/organization/attach-client");
  return publicResponse;
}

async function decideClientAttachRequest(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  reason: string | null
) {
  const actor = await requireCurrentProvider();
  let clientId = "";

  await db.$transaction(
    async (tx) => {
      const request = await tx.clientAttachRequest.findFirst({
        where: { id: requestId, status: "PENDING" },
        select: {
          id: true,
          clientId: true,
          organizationId: true,
          requestedById: true,
        },
      });
      if (!request) throw new Error("Attach request could not be changed.");
      clientId = request.clientId;

      const [assignment, manager] = await Promise.all([
        tx.providerClient.findFirst({
          where: activeClientAssignmentWhere(actor.id, request.clientId),
          select: { providerId: true, clientId: true, revokedAt: true },
        }),
        tx.clientTeamManager.findFirst({
          where: activeClientTeamManagerWhere(actor.id, request.clientId),
          select: { providerId: true, clientId: true, revokedAt: true },
        }),
      ]);
      if (
        !canDecideClientAttachRequest({
          actorId: actor.id,
          clientId: request.clientId,
          providerStatus: actor.status,
          assignment,
          teamManager: manager,
        })
      ) {
        throw new Error("Attach request could not be changed.");
      }

      const now = new Date();
      const updated = await tx.clientAttachRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decidedById: actor.id,
          decidedAt: now,
          reason,
        },
      });
      if (updated.count !== 1) {
        throw new Error("Attach request could not be changed.");
      }

      if (decision === "APPROVE") {
        await tx.clientOrganization.upsert({
          where: {
            clientId_organizationId: {
              clientId: request.clientId,
              organizationId: request.organizationId,
            },
          },
          create: {
            clientId: request.clientId,
            organizationId: request.organizationId,
            role: "PARTICIPATING",
            status: "ACTIVE",
            requestedById: request.requestedById,
            approvedById: actor.id,
            requestedAt: now,
            activatedAt: now,
          },
          update: {
            role: "PARTICIPATING",
            status: "ACTIVE",
            requestedById: request.requestedById,
            approvedById: actor.id,
            requestedAt: now,
            activatedAt: now,
            revokedAt: null,
            revokedById: null,
            revocationReason: null,
          },
        });
      }

      await tx.clientTeamAuditEvent.create({
        data: {
          clientId: request.clientId,
          actorId: actor.id,
          action: decision === "APPROVE" ? "ATTACH_APPROVED" : "ATTACH_REJECTED",
          organizationId: request.organizationId,
          metadata: boundedClientTeamAuditMetadata({
            transition: decision,
            reasonRecorded: Boolean(reason),
          }),
        },
      });
    },
    { isolationLevel: "Serializable" }
  );

  revalidatePath("/dashboard");
  revalidatePath(`/portal/supervisor/edit-providers/${clientId}`);
  revalidatePath("/portal/organization/attach-client");
}

export async function approveClientAttachRequest(formData: FormData) {
  const requestId = submittedValue(formData, "requestId");
  if (!requestId) throw new Error("Invalid attach request.");
  return decideClientAttachRequest(
    requestId,
    "APPROVE",
    boundedAttachReason(formData.get("reason"))
  );
}

export async function rejectClientAttachRequest(formData: FormData) {
  const requestId = submittedValue(formData, "requestId");
  if (!requestId) throw new Error("Invalid attach request.");
  return decideClientAttachRequest(
    requestId,
    "REJECT",
    boundedAttachReason(formData.get("reason"))
  );
}

export async function cancelClientAttachRequest(formData: FormData) {
  const actor = await requireCurrentProvider();
  const requestId = submittedValue(formData, "requestId");
  if (!requestId) throw new Error("Invalid attach request.");

  await db.$transaction(
    async (tx) => {
      const request = await tx.clientAttachRequest.findFirst({
        where: { id: requestId, status: "PENDING" },
        select: {
          id: true,
          clientId: true,
          organizationId: true,
          requestedById: true,
        },
      });
      if (!request) throw new Error("Attach request could not be changed.");

      const membership = await tx.organizationMembership.findFirst({
        where: directAttachAdministratorWhere(actor.id, request.organizationId),
        select: {
          providerId: true,
          organizationId: true,
          role: true,
          active: true,
        },
      });
      if (
        !canCancelClientAttachRequest({
          actorId: actor.id,
          organizationId: request.organizationId,
          requestedById: request.requestedById,
          providerStatus: actor.status,
          membership,
        })
      ) {
        throw new Error("Attach request could not be changed.");
      }

      const updated = await tx.clientAttachRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: {
          status: "CANCELLED",
          decidedById: actor.id,
          decidedAt: new Date(),
          reason: null,
        },
      });
      if (updated.count !== 1) {
        throw new Error("Attach request could not be changed.");
      }

      await tx.clientTeamAuditEvent.create({
        data: {
          clientId: request.clientId,
          actorId: actor.id,
          action: "ATTACH_CANCELLED",
          organizationId: request.organizationId,
          metadata: boundedClientTeamAuditMetadata({ transition: "CANCELLED" }),
        },
      });
    },
    { isolationLevel: "Serializable" }
  );

  revalidatePath("/portal/organization/attach-client");
}
