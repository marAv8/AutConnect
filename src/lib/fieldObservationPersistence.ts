import type { Prisma, PrismaClient } from "@prisma/client";
import {
  FIELD_OBSERVATION_RUBRIC,
  FIELD_OBSERVATION_RUBRIC_VERSION,
  FieldObservationValidationError,
  calculateFieldObservationFidelity,
  validateFieldObservationAuthorization,
  validateFieldObservationContext,
  type FieldObservationRating,
  type FieldObservationSetting,
} from "./fieldObservation";

type FieldObservationDb = Pick<
  PrismaClient,
  "providerClient" | "fieldObservation"
>;

export type CreateFieldObservationItemInput = {
  criterionKey: string;
  rating: string;
  note?: string | null;
};

export type CreateFieldObservationInput = {
  clientId: string;
  observedProviderId: string;
  observedAt: Date | string;
  setting: string;
  durationMinutes?: number | null;
  strengths?: string | null;
  coachingFocus?: string | null;
  followUp?: string | null;
  items: CreateFieldObservationItemInput[];
};

const fieldObservationSelect = {
  id: true,
  clientId: true,
  supervisorId: true,
  observedProviderId: true,
  observedProviderRole: true,
  observedAt: true,
  setting: true,
  durationMinutes: true,
  rubricVersion: true,
  fidelityPercent: true,
  applicableItemCount: true,
  strengths: true,
  coachingFocus: true,
  followUp: true,
  createdAt: true,
  updatedAt: true,
  supervisor: {
    select: { id: true, firstName: true, lastName: true },
  },
  observedProvider: {
    select: { id: true, firstName: true, lastName: true },
  },
  items: {
    orderBy: { displayOrder: "asc" as const },
    select: {
      id: true,
      criterionKey: true,
      criterionLabel: true,
      rating: true,
      displayOrder: true,
      note: true,
    },
  },
} satisfies Prisma.FieldObservationSelect;

export type FieldObservationRecord = Prisma.FieldObservationGetPayload<{
  select: typeof fieldObservationSelect;
}>;

function requiredId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new FieldObservationValidationError(`${label} is required.`);
  }
  return normalized;
}

function optionalText(
  value: string | null | undefined,
  label: string,
  maximumLength: number,
) {
  const normalized = value?.trim() ?? "";
  if (normalized.length > maximumLength) {
    throw new FieldObservationValidationError(
      `${label} must be ${maximumLength} characters or fewer.`,
    );
  }
  return normalized || null;
}

export async function createFieldObservationRecord(
  db: FieldObservationDb,
  supervisorId: string,
  input: CreateFieldObservationInput,
): Promise<FieldObservationRecord> {
  const normalizedSupervisorId = requiredId(supervisorId, "Supervisor");
  const clientId = requiredId(input.clientId, "Client");
  const observedProviderId = requiredId(
    input.observedProviderId,
    "Observed provider",
  );
  const observedAt =
    input.observedAt instanceof Date
      ? input.observedAt
      : new Date(input.observedAt);

  validateFieldObservationContext({
    observedAt,
    setting: input.setting,
    durationMinutes: input.durationMinutes,
  });

  const [supervisorAssignment, observedProviderAssignment] = await Promise.all([
    db.providerClient.findFirst({
      where: {
        clientId,
        providerId: normalizedSupervisorId,
        role: "Supervisor",
        revokedAt: null,
      },
      select: { id: true },
    }),
    db.providerClient.findFirst({
      where: { clientId, providerId: observedProviderId, revokedAt: null },
      select: { id: true, role: true },
    }),
  ]);

  validateFieldObservationAuthorization({
    actorRole: "Supervisor",
    supervisorAssignedToClient: Boolean(supervisorAssignment),
    observedProviderAssignedToClient: Boolean(observedProviderAssignment),
    observedProviderRole: observedProviderAssignment?.role ?? "",
  });

  const fidelity = calculateFieldObservationFidelity(input.items);
  const submittedItems = new Map(
    input.items.map((item) => [item.criterionKey, item]),
  );

  return db.fieldObservation.create({
    data: {
      clientId,
      supervisorId: normalizedSupervisorId,
      observedProviderId,
      observedProviderRole: observedProviderAssignment!.role,
      observedAt,
      setting: input.setting as FieldObservationSetting,
      durationMinutes: input.durationMinutes ?? null,
      rubricVersion: FIELD_OBSERVATION_RUBRIC_VERSION,
      fidelityPercent: fidelity.fidelityPercent,
      applicableItemCount: fidelity.applicableItemCount,
      strengths: optionalText(input.strengths, "Strengths", 5000),
      coachingFocus: optionalText(
        input.coachingFocus,
        "Coaching focus",
        5000,
      ),
      followUp: optionalText(input.followUp, "Follow-up", 5000),
      items: {
        create: FIELD_OBSERVATION_RUBRIC.map((criterion, displayOrder) => {
          const submitted = submittedItems.get(criterion.key)!;
          return {
            criterionKey: criterion.key,
            criterionLabel: criterion.label,
            rating: submitted.rating as FieldObservationRating,
            displayOrder,
            note: optionalText(submitted.note, "Criterion note", 2000),
          };
        }),
      },
    },
    select: fieldObservationSelect,
  });
}

export async function getFieldObservationsForClient(
  db: FieldObservationDb,
  supervisorId: string,
  clientId: string,
): Promise<FieldObservationRecord[]> {
  const normalizedSupervisorId = requiredId(supervisorId, "Supervisor");
  const normalizedClientId = requiredId(clientId, "Client");
  const supervisorAssignment = await db.providerClient.findFirst({
    where: {
      clientId: normalizedClientId,
      providerId: normalizedSupervisorId,
      role: "Supervisor",
      revokedAt: null,
    },
    select: { id: true },
  });

  if (!supervisorAssignment) {
    throw new FieldObservationValidationError(
      "The supervisor is not assigned to this client.",
    );
  }

  return db.fieldObservation.findMany({
    where: { clientId: normalizedClientId },
    orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: fieldObservationSelect,
  });
}
