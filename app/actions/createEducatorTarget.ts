"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AssessmentDomain,
  ComparisonType,
  MetricType,
  Role,
} from "@prisma/client";
import { getProfessionTemplate } from "@/app/libs/professionTemplates";

const educatorMeasurementProfiles = [
  "Participation",
  "SupportLevel",
  "Completion",
  "Independence",
  "Frequency",
  "PromptLevel",
  "Duration",
  "Latency",
  "Accuracy",
  "CueingLevel",
  "AssistanceLevel",
] as const;

const profileMetricType: Record<(typeof educatorMeasurementProfiles)[number], MetricType> = {
  Participation: MetricType.Subjective,
  SupportLevel: MetricType.Subjective,
  Completion: MetricType.Subjective,
  Independence: MetricType.Subjective,
  Frequency: MetricType.Subjective,
  PromptLevel: MetricType.Subjective,
  Duration: MetricType.Subjective,
  Latency: MetricType.Subjective,
  Accuracy: MetricType.Subjective,
  CueingLevel: MetricType.Subjective,
  AssistanceLevel: MetricType.Subjective,
};

function metricTypeForProfile(profile: (typeof educatorMeasurementProfiles)[number]) {
  return profileMetricType[profile];
}

const schema = z.object({
  clientId: z.string().uuid(),
  target: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(500),
  measurementProfile: z.enum(educatorMeasurementProfiles),
});

function targetSemantics(role: Role, target: string) {
  const definition = getProfessionTemplate(role)?.targets.find(
    (option) => option.value.toLowerCase() === target.toLowerCase()
  );

  return {
    domain: definition?.defaultDomain
      ? AssessmentDomain[definition.defaultDomain]
      : AssessmentDomain.Other,
    comparison:
      definition?.direction === "higherIsBetter"
        ? ComparisonType.GreaterThan
        : definition?.direction === "lowerIsBetter"
          ? ComparisonType.LessThan
          : null,
  };
}

const targetRoles: Role[] = [
  Role.BehaviorTherapist,
  Role.Educator,
  Role.OccupationalTherapist,
  Role.SpeechPathologist,
];

export async function createEducatorTarget(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const parsed = schema.safeParse({
    clientId: formData.get("clientId")?.toString(),
    target: formData.get("target")?.toString(),
    goal: formData.get("goal")?.toString(),
    measurementProfile: formData.get("measurementProfile")?.toString(),
  });

  if (!parsed.success) {
    return { ok: false, reason: "invalid_data" as const };
  }

  const assignment = await db.providerClient.findFirst({
    where: {
      clientId: parsed.data.clientId,
      providerId: session.providerId,
      revokedAt: null,
      role: { in: targetRoles },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!assignment || !targetRoles.includes(assignment.role)) {
    return { ok: false, reason: "forbidden" as const };
  }

  const semantics = targetSemantics(assignment.role, parsed.data.target);

  const duplicate = await db.goalDefinition.findFirst({
    where: {
      clientId: parsed.data.clientId,
      providerId: session.providerId,
      isActive: true,
      isMastered: false,
      target: {
        equals: parsed.data.target,
        mode: "insensitive",
      },
      goal: {
        equals: parsed.data.goal,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    return { ok: false, reason: "duplicate_target" as const };
  }

  const goalDefinition = await db.goalDefinition.create({
    data: {
      clientId: parsed.data.clientId,
      providerId: session.providerId,
      target: parsed.data.target,
      goal: parsed.data.goal,
      metricType: metricTypeForProfile(
        parsed.data.measurementProfile
      ),
      domain: semantics.domain,
      comparison: semantics.comparison,
      measurementProfile: parsed.data.measurementProfile,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");

  return { ok: true, goalId: goalDefinition.id };
}

export async function updateEducatorTarget(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const parsed = schema.extend({
    goalId: z.string().uuid(),
  }).safeParse({
    clientId: formData.get("clientId")?.toString(),
    goalId: formData.get("goalId")?.toString(),
    target: formData.get("target")?.toString(),
    goal: formData.get("goal")?.toString(),
    measurementProfile: formData.get("measurementProfile")?.toString(),
  });

  if (!parsed.success) {
    return { ok: false, reason: "invalid_data" as const };
  }

  const assignment = await db.providerClient.findFirst({
    where: {
      clientId: parsed.data.clientId,
      providerId: session.providerId,
      role: { in: targetRoles },
      revokedAt: null,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!assignment || !targetRoles.includes(assignment.role)) {
    return { ok: false, reason: "forbidden" as const };
  }

  const semantics = targetSemantics(assignment.role, parsed.data.target);

  const result = await db.goalDefinition.updateMany({
    where: {
      id: parsed.data.goalId,
      clientId: parsed.data.clientId,
      providerId: session.providerId,
      isActive: true,
      isMastered: false,
    },
    data: {
      target: parsed.data.target,
      goal: parsed.data.goal,
      metricType: metricTypeForProfile(
        parsed.data.measurementProfile
      ),
      domain: semantics.domain,
      ...(semantics.comparison ? { comparison: semantics.comparison } : {}),
      measurementProfile: parsed.data.measurementProfile,
    },
  });

  if (result.count === 0) {
    return { ok: false, reason: "not_found" as const };
  }

  revalidatePath("/dashboard");

  return { ok: true };
}
