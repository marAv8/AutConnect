"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  caseSupportNotificationAccessWhere,
  createCaseSupportNotifications,
} from "@/app/libs/caseSupportNotifications";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createCaseSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  concern: z.string().trim().min(10).max(4000),
  desiredOutcome: z.string().trim().min(5).max(2000),
});

const caseRequestSchema = z.object({
  clientId: z.string().uuid(),
  recipientSupervisorId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  occurredAt: z.coerce.date(),
  concern: z.string().trim().min(10).max(2000),
  requestedSupport: z.string().trim().min(5).max(1500),
});

const caseRequestDecisionSchema = z.object({
  requestId: z.string().uuid(),
});

const caseRequestUpdateViewSchema = z.object({
  requestId: z.string().uuid(),
});

const caseSupportNotificationOpenSchema = z.object({
  notificationId: z.string().uuid(),
});

const resolveCaseSchema = z.object({
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  resolutionConfidence: z.enum(["CONFIDENT", "UNSURE"]),
  resolutionSummary: z.string().trim().min(5).max(2000),
});

const caseEntryReviewSchema = z.object({
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  entryId: z.string().uuid(),
});

const caseRequestDeclineSchema = caseRequestDecisionSchema.extend({
  responseNote: z.string().trim().min(5).max(1000),
});

const caseEntrySchema = z.object({
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  occurredAt: z.coerce.date(),
  requestSource: z.enum([
    "CLASSROOM_STAFF",
    "SCHOOL_ADMINISTRATION",
    "AGENCY_SUPERVISOR",
    "SAFETY_NEED",
    "SELF_INITIATED",
    "OTHER",
    "UNCLEAR",
  ]),
  requestedBy: z.string().trim().max(160).optional(),
  coverageStatus: z.enum([
    "MAINTAINED",
    "TEMPORARILY_REASSIGNED",
    "NOT_MAINTAINED",
    "UNCLEAR",
  ]),
  durationMinutes: z.number().int().min(1).max(720).optional(),
  whatOccurred: z.string().trim().min(10).max(4000),
  supportProvided: z.string().trim().min(2).max(4000),
  observableOutcome: z.string().trim().min(2).max(4000),
  communication: z.string().trim().max(4000).optional(),
  followUp: z.string().trim().max(4000).optional(),
});

const simplifiedCaseEntrySchema = z.object({
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  occurredAt: z.coerce.date(),
  requestSource: z.enum([
    "SELF_INITIATED",
    "CLASSROOM_STAFF",
    "SCHOOL_ADMINISTRATION",
    "AGENCY_SUPERVISOR",
  ]),
  durationMinutes: z.number().int().min(1).max(720).optional(),
  whatOccurred: z.string().trim().min(10).max(4000),
  supportProvided: z.string().trim().min(2).max(4000),
  observableOutcome: z.string().trim().min(2).max(4000),
});

const caseClarificationSchema = z.object({
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  amendsEntryId: z.string().uuid(),
  clarification: z.string().trim().min(3).max(2000),
});

const caseCoordinationSchema = z.object({
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  path: z.enum(["INTERNAL", "EXTERNAL"]),
  status: z.enum([
    "DOCUMENTED",
    "AWAITING_RESPONSE",
    "RESPONSE_RECEIVED",
    "MONITORING",
    "FOLLOW_UP_NEEDED",
    "COMPLETE",
  ]),
  occurredAt: z.coerce.date(),
  contactOrganization: z.string().trim().max(200).optional(),
  contactRole: z.string().trim().max(160).optional(),
  contactName: z.string().trim().max(160).optional(),
  communicationMethod: z
    .enum([
      "EMAIL",
      "PHONE",
      "IN_PERSON",
      "VIRTUAL_MEETING",
      "WRITTEN_NOTICE",
      "OTHER",
    ])
    .optional(),
  actionTaken: z.string().trim().min(5).max(4000),
  requestOrDecision: z.string().trim().min(3).max(4000),
  responseSummary: z.string().trim().max(4000).optional(),
  nextStep: z.string().trim().max(4000).optional(),
  followUpAt: z.coerce.date().optional(),
});

const allowedScheduleImpacts = new Set([
  "NONE",
  "BREAK",
  "LUNCH",
  "STAFFING",
  "CLIENT_SCHEDULE",
  "OTHER",
  "UNCLEAR",
]);

function parseNewCaseSupportEntry(
  formData: FormData,
  simplified: boolean,
  durationValue: string | undefined
) {
  const sharedInput = {
    caseId: formData.get("caseId"),
    clientId: formData.get("clientId"),
    occurredAt: formData.get("occurredAt"),
    requestSource: formData.get("requestSource"),
    durationMinutes: durationValue ? Number(durationValue) : undefined,
    whatOccurred: formData.get("whatOccurred"),
    supportProvided: formData.get("supportProvided"),
    observableOutcome: formData.get("observableOutcome"),
  };

  if (simplified) {
    const parsed = simplifiedCaseEntrySchema.safeParse(sharedInput);
    return parsed.success
      ? {
          data: {
            ...parsed.data,
            requestedBy: undefined,
            coverageStatus: "UNCLEAR" as const,
            communication: undefined,
            followUp: undefined,
          },
          scheduleImpacts: [] as string[],
        }
      : null;
  }

  const parsed = caseEntrySchema.safeParse({
    ...sharedInput,
    requestedBy: formData.get("requestedBy")?.toString() || undefined,
    coverageStatus: formData.get("coverageStatus"),
    communication: formData.get("communication")?.toString() || undefined,
    followUp: formData.get("followUp")?.toString() || undefined,
  });
  if (!parsed.success) {
    return null;
  }

  return {
    data: parsed.data,
    scheduleImpacts: [
      ...new Set(
        formData
          .getAll("scheduleImpacts")
          .filter(
            (value): value is string =>
              typeof value === "string" && allowedScheduleImpacts.has(value)
          )
      ),
    ],
  };
}

async function requireSupervisorForClient(clientId: string) {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    throw new Error("Unauthorized");
  }

  const assignment = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      role: "Supervisor",
      revokedAt: null,
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new Error("Unauthorized");
  }

  return session;
}

async function requireRequestRecipient(requestId: string) {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    throw new Error("Unauthorized");
  }

  const request = await db.caseSupportRequest.findFirst({
    where: {
      id: requestId,
      recipientSupervisorId: session.providerId,
      client: {
        providerClients: {
          some: { providerId: session.providerId, revokedAt: null },
        },
      },
    },
    include: {
      requester: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Unauthorized");
  }

  return { session, request };
}

async function requireActiveRequestAgency(
  clientId: string,
  organizationId: string | null,
  requesterId: string,
  supervisorId: string
) {
  if (!organizationId) {
    throw new Error(
      "This request does not have a verified agency affiliation."
    );
  }

  const assignments = await db.providerClient.findMany({
    where: {
      clientId,
      organizationId,
      revokedAt: null,
      organization: { type: "AGENCY" },
      OR: [
        { providerId: requesterId },
        { providerId: supervisorId, role: "Supervisor" },
      ],
    },
    select: { providerId: true, role: true },
  });

  const affiliatedProviderIds = new Set(
    assignments.map(({ providerId }) => providerId)
  );
  const hasAgencySupervisor = assignments.some(
    ({ providerId, role }) =>
      providerId === supervisorId && role === "Supervisor"
  );
  if (
    !affiliatedProviderIds.has(requesterId) ||
    !affiliatedProviderIds.has(supervisorId) ||
    !hasAgencySupervisor
  ) {
    throw new Error(
      "The requester and supervisor must belong to the same agency team for this client."
    );
  }

  return organizationId;
}

export async function submitCaseSupportRequest(formData: FormData) {
  const parsed = caseRequestSchema.safeParse({
    clientId: formData.get("clientId"),
    recipientSupervisorId: formData.get("recipientSupervisorId"),
    title: formData.get("title"),
    occurredAt: formData.get("occurredAt"),
    concern: formData.get("concern"),
    requestedSupport: formData.get("requestedSupport"),
  });

  if (!parsed.success) {
    throw new Error("Complete the request details and support needed.");
  }

  const session = await getSession();
  if (
    !session ||
    session.role === "Supervisor" ||
    session.role === "Caregiver"
  ) {
    throw new Error("Unauthorized");
  }

  const assignment = await db.providerClient.findFirst({
    where: {
      clientId: parsed.data.clientId,
      providerId: session.providerId,
      revokedAt: null,
      organizationId: { not: null },
      organization: { type: "AGENCY" },
    },
    select: { organizationId: true },
  });

  if (!assignment?.organizationId) {
    throw new Error(
      "Case Support is available only to providers assigned to this client through the responsible agency."
    );
  }

  const [recipient, existingRequest] = await Promise.all([
    db.providerClient.findFirst({
      where: {
        clientId: parsed.data.clientId,
        organizationId: assignment.organizationId,
        role: "Supervisor",
        providerId: parsed.data.recipientSupervisorId,
        revokedAt: null,
        NOT: { providerId: session.providerId },
        provider: {
          role: "Supervisor",
        },
        organization: { type: "AGENCY" },
      },
      select: { providerId: true },
    }),
    db.caseSupportRequest.findFirst({
      where: {
        clientId: parsed.data.clientId,
        requesterId: session.providerId,
        organizationId: assignment.organizationId,
        status: { in: ["REQUESTED", "ACKNOWLEDGED"] },
      },
      select: { id: true },
    }),
  ]);

  if (!recipient) {
    throw new Error(
      "No supervisor from your agency is assigned to this client."
    );
  }

  if (existingRequest) {
    redirect(
      `/portal/case-support/request/${parsed.data.clientId}?alreadyPending=1`
    );
  }

  await db.caseSupportRequest.create({
    data: {
      clientId: parsed.data.clientId,
      requesterId: session.providerId,
      recipientSupervisorId: recipient.providerId,
      organizationId: assignment.organizationId,
      linkedCaseId: null,
      title: parsed.data.title,
      occurredAt: parsed.data.occurredAt,
      concern: parsed.data.concern,
      requestedSupport: parsed.data.requestedSupport,
      status: "REQUESTED",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/portal/case-support/requests");
  revalidatePath(`/portal/case-support/request/${parsed.data.clientId}`);
  redirect(`/portal/case-support/request/${parsed.data.clientId}?submitted=1`);
}

export async function acknowledgeCaseSupportRequest(formData: FormData) {
  const parsed = caseRequestDecisionSchema.safeParse({
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) {
    throw new Error("Missing Case Support request.");
  }

  const { request } = await requireRequestRecipient(parsed.data.requestId);
  if (request.status === "REQUESTED") {
    await db.caseSupportRequest.update({
      where: { id: request.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        requesterViewedAt: null,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/portal/case-support/requests");
  revalidatePath(`/portal/case-support/request/${request.clientId}`);
  redirect("/portal/case-support/requests?acknowledged=1");
}

export async function declineCaseSupportRequest(formData: FormData) {
  const parsed = caseRequestDeclineSchema.safeParse({
    requestId: formData.get("requestId"),
    responseNote: formData.get("responseNote"),
  });
  if (!parsed.success) {
    throw new Error("Add a short reason before closing the request.");
  }

  const { request } = await requireRequestRecipient(parsed.data.requestId);
  if (!["REQUESTED", "ACKNOWLEDGED"].includes(request.status)) {
    throw new Error("This request has already been reviewed.");
  }

  await db.caseSupportRequest.update({
    where: { id: request.id },
    data: {
      status: "DECLINED",
      responseNote: parsed.data.responseNote,
      respondedAt: new Date(),
      acknowledgedAt: request.acknowledgedAt ?? new Date(),
      requesterViewedAt: null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/portal/case-support/requests");
  revalidatePath(`/portal/case-support/request/${request.clientId}`);
  redirect("/portal/case-support/requests?declined=1");
}

export async function convertCaseSupportRequest(formData: FormData) {
  const parsed = caseRequestDecisionSchema.safeParse({
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) {
    throw new Error("Missing Case Support request.");
  }

  const { session, request } = await requireRequestRecipient(
    parsed.data.requestId
  );
  if (!["REQUESTED", "ACKNOWLEDGED"].includes(request.status)) {
    throw new Error("This request has already been reviewed.");
  }

  const organizationId = await requireActiveRequestAgency(
    request.clientId,
    request.organizationId,
    request.requesterId,
    session.providerId
  );

  const supportCaseId = await db.$transaction(async (tx) => {
    const existingCase = await tx.caseSupportCase.findFirst({
      where: {
        clientId: request.clientId,
        ownerSupervisorId: session.providerId,
        organizationId,
        status: "OPEN",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    const supportCase =
      existingCase ??
      (await tx.caseSupportCase.create({
        data: {
          clientId: request.clientId,
          ownerSupervisorId: session.providerId,
          organizationId,
          title: request.title?.trim() || requestTitle(request.concern),
          concern: request.concern,
          desiredOutcome: request.requestedSupport,
        },
        select: { id: true },
      }));

    await tx.caseSupportMember.upsert({
      where: {
        caseId_providerId: {
          caseId: supportCase.id,
          providerId: request.requesterId,
        },
      },
      create: {
        caseId: supportCase.id,
        providerId: request.requesterId,
        grantedById: session.providerId,
        accessLevel: "CONTRIBUTOR",
      },
      update: {
        grantedById: session.providerId,
        grantedAt: new Date(),
        revokedAt: null,
        accessLevel: "CONTRIBUTOR",
      },
    });

    await tx.caseSupportRequest.update({
      where: { id: request.id },
      data: {
        linkedCaseId: supportCase.id,
        status: "CASE_OPENED",
        acknowledgedAt: request.acknowledgedAt ?? new Date(),
        respondedAt: new Date(),
        requesterViewedAt: null,
      },
    });

    const auditEvents: Prisma.CaseSupportAuditEventCreateManyInput[] = [
      {
        caseId: supportCase.id,
        actorId: session.providerId,
        action: existingCase
          ? "CASE_REQUEST_MERGED"
          : "CASE_CREATED_FROM_REQUEST",
        details: {
          requestId: request.id,
          requesterId: request.requesterId,
          requesterName:
            `${request.requester.firstName} ${request.requester.lastName}`.trim(),
          requesterRole: request.requester.role,
          requestTitle: request.title,
          occurredAt: request.occurredAt?.toISOString() ?? null,
          concern: request.concern,
          requestedSupport: request.requestedSupport,
        } as Prisma.InputJsonValue,
      },
      {
        caseId: supportCase.id,
        actorId: session.providerId,
        action: "ACCESS_GRANTED",
        details: {
          providerId: request.requesterId,
          providerName:
            `${request.requester.firstName} ${request.requester.lastName}`.trim(),
          providerRole: request.requester.role,
        } as Prisma.InputJsonValue,
      },
    ];

    await tx.caseSupportAuditEvent.createMany({ data: auditEvents });
    await createCaseSupportNotifications(tx, {
      caseId: supportCase.id,
      actorId: session.providerId,
      eventType: "CASE_OPENED",
      eventKey: `CASE_OPENED:${request.id}`,
    });
    return supportCase.id;
  });

  revalidatePath("/dashboard");
  revalidatePath("/portal/case-support/requests");
  revalidatePath(`/portal/case-support/request/${request.clientId}`);
  revalidatePath(`/portal/case-support/${request.clientId}`);
  redirect(
    `/portal/case-support/${request.clientId}?requestOpened=1&caseId=${supportCaseId}`
  );
}

export async function viewCaseSupportRequestUpdate(formData: FormData) {
  const parsed = caseRequestUpdateViewSchema.safeParse({
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) {
    throw new Error("Missing Case Support request update.");
  }

  const session = await getSession();
  if (!session || session.role === "Supervisor" || session.role === "Caregiver") {
    throw new Error("Unauthorized");
  }

  const request = await db.caseSupportRequest.findFirst({
    where: {
      id: parsed.data.requestId,
      requesterId: session.providerId,
      status: { in: ["ACKNOWLEDGED", "DECLINED", "CASE_OPENED"] },
    },
    select: {
      id: true,
      clientId: true,
      status: true,
      linkedCaseId: true,
    },
  });
  if (!request) {
    throw new Error("Case Support request update not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.caseSupportRequest.update({
      where: { id: request.id },
      data: { requesterViewedAt: new Date() },
    });

    if (request.status === "CASE_OPENED" && request.linkedCaseId) {
      await tx.caseSupportNotification.updateMany({
        where: {
          caseId: request.linkedCaseId,
          eventKey: `CASE_OPENED:${request.id}`,
          readAt: null,
          ...caseSupportNotificationAccessWhere(session.providerId),
        },
        data: { readAt: new Date() },
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath(`/portal/case-support/request/${request.clientId}`);
  revalidatePath(`/portal/case-support/${request.clientId}`);

  if (request.status === "CASE_OPENED" && request.linkedCaseId) {
    redirect(`/portal/case-support/${request.clientId}`);
  }
  redirect(`/portal/case-support/request/${request.clientId}`);
}

export async function openCaseSupportNotification(formData: FormData) {
  const parsed = caseSupportNotificationOpenSchema.safeParse({
    notificationId: formData.get("notificationId"),
  });
  if (!parsed.success) {
    throw new Error("Missing Case Support notification.");
  }

  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const notification = await db.caseSupportNotification.findFirst({
    where: {
      id: parsed.data.notificationId,
      ...caseSupportNotificationAccessWhere(session.providerId),
    },
    select: {
      id: true,
      case: { select: { clientId: true } },
    },
  });
  if (!notification) {
    throw new Error("Case Support notification not found.");
  }

  await db.caseSupportNotification.updateMany({
    where: {
      id: notification.id,
      recipientId: session.providerId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/dashboard");
  revalidatePath("/portal/case-support/requests");
  redirect(`/portal/case-support/${notification.case.clientId}`);
}

export async function createCaseSupportCase(formData: FormData) {
  const parsed = createCaseSchema.safeParse({
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    concern: formData.get("concern"),
    desiredOutcome: formData.get("desiredOutcome"),
  });

  if (!parsed.success) {
    throw new Error("Complete the case title, concern, and desired outcome.");
  }

  const session = await requireSupervisorForClient(parsed.data.clientId);
  const supervisorAssignment = await db.providerClient.findFirst({
    where: {
      clientId: parsed.data.clientId,
      providerId: session.providerId,
      role: "Supervisor",
      revokedAt: null,
      organizationId: { not: null },
      organization: { type: "AGENCY" },
    },
    select: { organizationId: true },
  });
  if (!supervisorAssignment?.organizationId) {
    throw new Error(
      "Identify the responsible agency team in the client assignment before opening Case Support."
    );
  }
  const selectedProviderIds = uniqueProviderIds(formData);
  const assignedProviders = await db.providerClient.findMany({
    where: {
      clientId: parsed.data.clientId,
      organizationId: supervisorAssignment.organizationId,
      revokedAt: null,
      providerId: {
        in: selectedProviderIds,
        not: session.providerId,
      },
    },
    select: {
      providerId: true,
      provider: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  await db.$transaction(async (tx) => {
    const supportCase = await tx.caseSupportCase.create({
      data: {
        clientId: parsed.data.clientId,
        ownerSupervisorId: session.providerId,
        organizationId: supervisorAssignment.organizationId,
        title: parsed.data.title,
        concern: parsed.data.concern,
        desiredOutcome: parsed.data.desiredOutcome,
      },
      select: { id: true },
    });

    if (assignedProviders.length > 0) {
      await tx.caseSupportMember.createMany({
        data: assignedProviders.map(({ providerId }) => ({
          caseId: supportCase.id,
          providerId,
          grantedById: session.providerId,
          accessLevel: "CONTRIBUTOR",
        })),
      });
    }

    await tx.caseSupportAuditEvent.create({
      data: {
        caseId: supportCase.id,
        actorId: session.providerId,
        action: "CASE_CREATED",
        details: {
          title: parsed.data.title,
        } as Prisma.InputJsonValue,
      },
    });

    for (const { providerId, provider } of assignedProviders) {
      const accessEvent = await tx.caseSupportAuditEvent.create({
        data: {
          caseId: supportCase.id,
          actorId: session.providerId,
          action: "ACCESS_GRANTED",
          details: {
            providerId,
            providerName: `${provider.firstName} ${provider.lastName}`.trim(),
            providerRole: provider.role,
          } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await createCaseSupportNotifications(tx, {
        caseId: supportCase.id,
        actorId: session.providerId,
        eventType: "ACCESS_GRANTED",
        eventKey: `ACCESS_GRANTED:${accessEvent.id}:${providerId}`,
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath(`/portal/case-support/${parsed.data.clientId}`);
  redirect(`/portal/case-support/${parsed.data.clientId}?created=1`);
}

export async function resolveCaseSupportCase(formData: FormData) {
  const parsed = resolveCaseSchema.safeParse({
    caseId: formData.get("caseId"),
    clientId: formData.get("clientId"),
    resolutionConfidence: formData.get("resolutionConfidence"),
    resolutionSummary: formData.get("resolutionSummary"),
  });
  if (!parsed.success) {
    throw new Error(
      "Choose a confidence level and add a short resolution summary before closing the case."
    );
  }

  const session = await requireSupervisorForClient(parsed.data.clientId);
  const supportCase = await db.caseSupportCase.findFirst({
    where: {
      id: parsed.data.caseId,
      clientId: parsed.data.clientId,
      ownerSupervisorId: session.providerId,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (!supportCase) {
    throw new Error("Only the case owner can resolve this open case.");
  }

  const resolvedAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.caseSupportCase.update({
      where: { id: supportCase.id },
      data: {
        status: "RESOLVED",
        resolvedAt,
      },
    });
    const resolvedEvent = await tx.caseSupportAuditEvent.create({
      data: {
        caseId: supportCase.id,
        actorId: session.providerId,
        action: "CASE_RESOLVED",
        details: {
          resolutionSummary: parsed.data.resolutionSummary,
          resolutionConfidence: parsed.data.resolutionConfidence,
          resolvedAt: resolvedAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    await createCaseSupportNotifications(tx, {
      caseId: supportCase.id,
      actorId: session.providerId,
      eventType: "CASE_RESOLVED",
      eventKey: `CASE_RESOLVED:${resolvedEvent.id}`,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath(`/portal/case-support/${parsed.data.clientId}`);
  revalidatePath(`/portal/case-support/request/${parsed.data.clientId}`);
  redirect(`/portal/case-support/${parsed.data.clientId}?resolved=1`);
}

export async function updateCaseSupportAccess(formData: FormData) {
  const clientId = formData.get("clientId")?.toString();
  const caseId = formData.get("caseId")?.toString();
  if (!clientId || !caseId) {
    throw new Error("Missing case support record.");
  }

  const session = await requireSupervisorForClient(clientId);
  const supportCase = await db.caseSupportCase.findFirst({
    where: {
      id: caseId,
      clientId,
      ownerSupervisorId: session.providerId,
      status: "OPEN",
    },
    select: {
      id: true,
      organizationId: true,
      members: {
        select: {
          id: true,
          providerId: true,
          revokedAt: true,
          provider: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!supportCase) {
    throw new Error("Unauthorized");
  }
  if (!supportCase.organizationId) {
    throw new Error(
      "Identify the responsible agency before changing access to this legacy case."
    );
  }

  const supervisorAgencyAssignment = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      role: "Supervisor",
      organizationId: supportCase.organizationId,
      revokedAt: null,
      organization: { type: "AGENCY" },
    },
    select: { id: true },
  });
  if (!supervisorAgencyAssignment) {
    throw new Error("The case owner is not assigned through this agency.");
  }

  const selectedProviderIds = uniqueProviderIds(formData).filter(
    (providerId) => providerId !== session.providerId
  );
  const assignedProviders = await db.providerClient.findMany({
    where: {
      clientId,
      organizationId: supportCase.organizationId,
      providerId: { in: selectedProviderIds },
      revokedAt: null,
    },
    select: {
      providerId: true,
      provider: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });
  const allowedProviderIds = new Set(
    assignedProviders.map(({ providerId }) => providerId)
  );
  const activeMembers = supportCase.members.filter(
    (member) => member.revokedAt === null
  );
  const activeProviderIds = new Set(
    activeMembers.map(({ providerId }) => providerId)
  );
  const grantedProviders = assignedProviders.filter(
    ({ providerId }) => !activeProviderIds.has(providerId)
  );
  const revokedMembers = activeMembers.filter(
    ({ providerId }) => !allowedProviderIds.has(providerId)
  );

  await db.$transaction(async (tx) => {
    for (const provider of grantedProviders) {
      await tx.caseSupportMember.upsert({
        where: {
          caseId_providerId: {
            caseId,
            providerId: provider.providerId,
          },
        },
        create: {
          caseId,
          providerId: provider.providerId,
          grantedById: session.providerId,
          accessLevel: "CONTRIBUTOR",
        },
        update: {
          grantedById: session.providerId,
          grantedAt: new Date(),
          revokedAt: null,
          accessLevel: "CONTRIBUTOR",
        },
      });
    }

    if (revokedMembers.length > 0) {
      await tx.caseSupportMember.updateMany({
        where: {
          id: { in: revokedMembers.map(({ id }) => id) },
        },
        data: { revokedAt: new Date() },
      });
    }

    for (const { providerId, provider } of grantedProviders) {
      const accessEvent = await tx.caseSupportAuditEvent.create({
        data: {
          caseId,
          actorId: session.providerId,
          action: "ACCESS_GRANTED",
          details: {
            providerId,
            providerName: `${provider.firstName} ${provider.lastName}`.trim(),
            providerRole: provider.role,
          } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await createCaseSupportNotifications(tx, {
        caseId,
        actorId: session.providerId,
        eventType: "ACCESS_GRANTED",
        eventKey: `ACCESS_GRANTED:${accessEvent.id}:${providerId}`,
      });
    }

    const revokeEvents = revokedMembers.map(({ providerId, provider }) => ({
      caseId,
      actorId: session.providerId,
      action: "ACCESS_REVOKED",
      details: {
        providerId,
        providerName: `${provider.firstName} ${provider.lastName}`.trim(),
        providerRole: provider.role,
      } as Prisma.InputJsonValue,
    }));

    if (revokeEvents.length > 0) {
      await tx.caseSupportAuditEvent.createMany({ data: revokeEvents });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath(`/portal/case-support/${clientId}`);
  redirect(`/portal/case-support/${clientId}?accessUpdated=1`);
}

export async function markCaseSupportEntryReviewed(formData: FormData) {
  const parsed = caseEntryReviewSchema.safeParse({
    caseId: formData.get("caseId"),
    clientId: formData.get("clientId"),
    entryId: formData.get("entryId"),
  });

  if (!parsed.success) {
    throw new Error("Missing Case Support documentation.");
  }

  const session = await requireSupervisorForClient(parsed.data.clientId);
  const supportCase = await db.caseSupportCase.findFirst({
    where: {
      id: parsed.data.caseId,
      clientId: parsed.data.clientId,
      ownerSupervisorId: session.providerId,
      status: "OPEN",
    },
    select: { id: true },
  });

  if (!supportCase) {
    throw new Error("Only the case owner can review this documentation.");
  }

  const entry = await db.caseSupportEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      caseId: supportCase.id,
      amendsEntryId: null,
    },
    select: {
      id: true,
      createdAt: true,
      amendments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  if (!entry) {
    throw new Error("Case Support documentation not found.");
  }

  const reviewEvents = await db.caseSupportAuditEvent.findMany({
    where: {
      caseId: supportCase.id,
      action: "DOCUMENTATION_REVIEWED",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, details: true },
  });
  const latestActivityAt = entry.amendments[0]?.createdAt ?? entry.createdAt;
  const alreadyReviewed = reviewEvents.some((event) => {
    const details = event.details;
    return (
      typeof details === "object" &&
      details !== null &&
      !Array.isArray(details) &&
      "entryId" in details &&
      details.entryId === entry.id &&
      event.createdAt >= latestActivityAt
    );
  });

  if (!alreadyReviewed) {
    await db.caseSupportAuditEvent.create({
      data: {
        caseId: supportCase.id,
        actorId: session.providerId,
        action: "DOCUMENTATION_REVIEWED",
        details: { entryId: entry.id } as Prisma.InputJsonValue,
      },
    });
  }

  revalidatePath(`/portal/case-support/${parsed.data.clientId}`);
  redirect(`/portal/case-support/${parsed.data.clientId}?reviewed=1`);
}

export async function createCaseSupportEntry(formData: FormData) {
  const durationValue = formData.get("durationMinutes")?.toString().trim();
  const amendsEntryValue = formData.get("amendsEntryId")?.toString().trim();
  const identity = z
    .object({
      caseId: z.string().uuid(),
      clientId: z.string().uuid(),
    })
    .safeParse({
      caseId: formData.get("caseId"),
      clientId: formData.get("clientId"),
    });

  if (!identity.success) {
    throw new Error("Missing case support record.");
  }

  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const supportCase = await db.caseSupportCase.findFirst({
    where: {
      id: identity.data.caseId,
      clientId: identity.data.clientId,
      status: "OPEN",
      client: {
        providerClients: {
          some: { providerId: session.providerId, revokedAt: null },
        },
      },
      OR: [
        { ownerSupervisorId: session.providerId },
        {
          members: {
            some: {
              providerId: session.providerId,
              accessLevel: "CONTRIBUTOR",
              revokedAt: null,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      ownerSupervisorId: true,
    },
  });

  if (!supportCase) {
    throw new Error("Unauthorized");
  }

  if (amendsEntryValue) {
    const clarification = caseClarificationSchema.safeParse({
      ...identity.data,
      amendsEntryId: amendsEntryValue,
      clarification: formData.get("clarification"),
    });
    if (!clarification.success) {
      throw new Error("Add a short clarification.");
    }

    const original = await db.caseSupportEntry.findFirst({
      where: {
        id: clarification.data.amendsEntryId,
        caseId: supportCase.id,
        authorId: session.providerId,
        amendsEntryId: null,
      },
    });
    if (!original) {
      throw new Error("Only the original author can clarify this documentation.");
    }

    await db.$transaction(async (tx) => {
      const entry = await tx.caseSupportEntry.create({
        data: {
          caseId: supportCase.id,
          authorId: session.providerId,
          amendsEntryId: original.id,
          entryType: "CLARIFICATION",
          occurredAt: original.occurredAt,
          requestSource: original.requestSource,
          requestedBy: original.requestedBy,
          coverageStatus: original.coverageStatus,
          durationMinutes: original.durationMinutes,
          scheduleImpacts: original.scheduleImpacts,
          whatOccurred: original.whatOccurred,
          supportProvided: original.supportProvided,
          observableOutcome: original.observableOutcome,
          communication: original.communication,
          followUp: original.followUp,
          clarification: clarification.data.clarification,
        },
        select: { id: true },
      });

      await tx.caseSupportAuditEvent.create({
        data: {
          caseId: supportCase.id,
          actorId: session.providerId,
          action: "DOCUMENTATION_CLARIFIED",
          details: {
            entryId: entry.id,
            entryType: "CLARIFICATION",
            amendsEntryId: original.id,
          } as Prisma.InputJsonValue,
        },
      });
      await createCaseSupportNotifications(tx, {
        caseId: supportCase.id,
        actorId: session.providerId,
        eventType: "CLARIFICATION",
        eventKey: `CLARIFICATION:${entry.id}`,
      });
    });

    revalidatePath(`/portal/case-support/${identity.data.clientId}`);
    redirect(`/portal/case-support/${identity.data.clientId}?saved=1`);
  }

  const usesSimplifiedDocumentation =
    session.role === "Supervisor" ||
    formData.get("documentationMode") === "SIMPLIFIED";
  const parsed = parseNewCaseSupportEntry(
    formData,
    usesSimplifiedDocumentation,
    durationValue
  );

  if (!parsed) {
    throw new Error("Complete every required documentation field.");
  }
  const entryType =
    supportCase.ownerSupervisorId === session.providerId
      ? ("SUPERVISOR_COORDINATION" as const)
      : ("PROVIDER_ACCOUNT" as const);

  await db.$transaction(async (tx) => {
    const entry = await tx.caseSupportEntry.create({
      data: {
        caseId: supportCase.id,
        authorId: session.providerId,
        entryType,
        occurredAt: parsed.data.occurredAt,
        requestSource: parsed.data.requestSource,
        requestedBy: parsed.data.requestedBy || null,
        coverageStatus: parsed.data.coverageStatus,
        durationMinutes: parsed.data.durationMinutes ?? null,
        scheduleImpacts: parsed.scheduleImpacts,
        whatOccurred: parsed.data.whatOccurred,
        supportProvided: parsed.data.supportProvided,
        observableOutcome: parsed.data.observableOutcome,
        communication: parsed.data.communication || null,
        followUp: parsed.data.followUp || null,
      },
      select: { id: true },
    });

    await tx.caseSupportAuditEvent.create({
      data: {
        caseId: supportCase.id,
        actorId: session.providerId,
        action: "DOCUMENTATION_ADDED",
        details: {
          entryId: entry.id,
          entryType,
          amendsEntryId: null,
          ...(usesSimplifiedDocumentation
            ? { documentationMode: "SIMPLIFIED" }
            : {}),
        } as Prisma.InputJsonValue,
      },
    });
    await createCaseSupportNotifications(tx, {
      caseId: supportCase.id,
      actorId: session.providerId,
      eventType: "CASE_UPDATE",
      eventKey: `CASE_UPDATE:${entry.id}`,
    });
  });

  revalidatePath(`/portal/case-support/${identity.data.clientId}`);
  redirect(`/portal/case-support/${identity.data.clientId}?saved=1`);
}

export async function createCaseSupportCoordination(formData: FormData) {
  const followUpValue = formData.get("followUpAt")?.toString().trim();
  const parsed = caseCoordinationSchema.safeParse({
    caseId: formData.get("caseId"),
    clientId: formData.get("clientId"),
    path: formData.get("path"),
    status: formData.get("status"),
    occurredAt: formData.get("occurredAt"),
    contactOrganization:
      formData.get("contactOrganization")?.toString() || undefined,
    contactRole: formData.get("contactRole")?.toString() || undefined,
    contactName: formData.get("contactName")?.toString() || undefined,
    communicationMethod:
      formData.get("communicationMethod")?.toString() || undefined,
    actionTaken: formData.get("actionTaken"),
    requestOrDecision: formData.get("requestOrDecision"),
    responseSummary:
      formData.get("responseSummary")?.toString() || undefined,
    nextStep: formData.get("nextStep")?.toString() || undefined,
    followUpAt: followUpValue || undefined,
  });

  if (!parsed.success) {
    throw new Error("Complete every required coordination field.");
  }

  const session = await requireSupervisorForClient(parsed.data.clientId);
  const supportCase = await db.caseSupportCase.findFirst({
    where: {
      id: parsed.data.caseId,
      clientId: parsed.data.clientId,
      ownerSupervisorId: session.providerId,
      status: "OPEN",
    },
    select: { id: true },
  });

  if (!supportCase) {
    throw new Error("Unauthorized");
  }

  if (
    parsed.data.path === "EXTERNAL" &&
    (!parsed.data.contactOrganization ||
      !parsed.data.contactRole ||
      !parsed.data.communicationMethod)
  ) {
    throw new Error(
      "Add the outside organization, contact role, and communication method."
    );
  }

  const validStatusesByPath = {
    INTERNAL: new Set([
      "DOCUMENTED",
      "MONITORING",
      "FOLLOW_UP_NEEDED",
      "COMPLETE",
    ]),
    EXTERNAL: new Set([
      "AWAITING_RESPONSE",
      "RESPONSE_RECEIVED",
      "FOLLOW_UP_NEEDED",
      "COMPLETE",
    ]),
  };

  if (!validStatusesByPath[parsed.data.path].has(parsed.data.status)) {
    throw new Error(`Choose a valid ${parsed.data.path.toLowerCase()} status.`);
  }

  if (
    parsed.data.status === "RESPONSE_RECEIVED" &&
    !parsed.data.responseSummary
  ) {
    throw new Error("Summarize the response that was received.");
  }

  await db.$transaction(async (tx) => {
    const coordination = await tx.caseSupportCoordination.create({
      data: {
        caseId: supportCase.id,
        authorId: session.providerId,
        path: parsed.data.path,
        status: parsed.data.status,
        occurredAt: parsed.data.occurredAt,
        contactOrganization:
          parsed.data.path === "EXTERNAL"
            ? parsed.data.contactOrganization
            : null,
        contactRole:
          parsed.data.path === "EXTERNAL" ? parsed.data.contactRole : null,
        contactName:
          parsed.data.path === "EXTERNAL"
            ? parsed.data.contactName || null
            : null,
        communicationMethod:
          parsed.data.path === "EXTERNAL"
            ? parsed.data.communicationMethod
            : null,
        actionTaken: parsed.data.actionTaken,
        requestOrDecision: parsed.data.requestOrDecision,
        responseSummary: parsed.data.responseSummary || null,
        nextStep: parsed.data.nextStep || null,
        followUpAt: parsed.data.followUpAt ?? null,
      },
      select: { id: true },
    });

    await tx.caseSupportAuditEvent.create({
      data: {
        caseId: supportCase.id,
        actorId: session.providerId,
        action: "COORDINATION_ADDED",
        details: {
          coordinationId: coordination.id,
          path: parsed.data.path,
          status: parsed.data.status,
        } as Prisma.InputJsonValue,
      },
    });
    await createCaseSupportNotifications(tx, {
      caseId: supportCase.id,
      actorId: session.providerId,
      eventType: "CASE_UPDATE",
      eventKey: `CASE_UPDATE:COORDINATION:${coordination.id}`,
    });
  });

  revalidatePath(`/portal/case-support/${parsed.data.clientId}`);
  redirect(
    `/portal/case-support/${parsed.data.clientId}?coordinationSaved=1`
  );
}

function uniqueProviderIds(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("providerIds")
        .filter((value): value is string => typeof value === "string")
    ),
  ];
}

function requestTitle(concern: string) {
  const firstSentence = concern.split(/[.!?]/, 1)[0]?.trim() || concern.trim();
  const shortened =
    firstSentence.length > 112
      ? `${firstSentence.slice(0, 109).trimEnd()}…`
      : firstSentence;
  return shortened.length >= 3 ? shortened : "Provider support request";
}
