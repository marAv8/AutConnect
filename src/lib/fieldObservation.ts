export const FIELD_OBSERVATION_RUBRIC_VERSION = "1.0" as const;
export const FIELD_OBSERVATION_CARD_COUNT = 10 as const;

export function getFieldObservationDashboardHref(clientId: string): string {
  return `/dashboard?clientId=${encodeURIComponent(clientId)}&view=orbit`;
}

export function getFieldObservationCardIndex(
  currentIndex: number,
  offset: number,
): number {
  return Math.min(
    FIELD_OBSERVATION_CARD_COUNT - 1,
    Math.max(0, currentIndex + offset),
  );
}

export const FIELD_OBSERVATION_ELIGIBLE_ROLES = [
  "BehaviorTherapist",
  "OccupationalTherapist",
  "SpeechPathologist",
  "Educator",
] as const;

export type FieldObservationEligibleRole =
  (typeof FIELD_OBSERVATION_ELIGIBLE_ROLES)[number];

export const FIELD_OBSERVATION_SETTINGS = [
  "CLINIC",
  "HOME",
  "SCHOOL",
  "COMMUNITY",
  "TELEHEALTH",
  "OTHER",
] as const;

export type FieldObservationSetting =
  (typeof FIELD_OBSERVATION_SETTINGS)[number];

export const FIELD_OBSERVATION_RATINGS = [
  "IMPLEMENTED",
  "PARTIALLY_IMPLEMENTED",
  "NOT_IMPLEMENTED",
  "NOT_OBSERVED",
] as const;

export type FieldObservationRating =
  (typeof FIELD_OBSERVATION_RATINGS)[number];

export const FIELD_OBSERVATION_RATING_DEFINITIONS = {
  IMPLEMENTED: { label: "Implemented", points: 2 },
  PARTIALLY_IMPLEMENTED: { label: "Partially implemented", points: 1 },
  NOT_IMPLEMENTED: { label: "Not implemented", points: 0 },
  NOT_OBSERVED: { label: "Not assessed", points: null },
} as const satisfies Record<
  FieldObservationRating,
  { label: string; points: number | null }
>;

export const FIELD_OBSERVATION_RUBRIC = [
  {
    key: "session_preparation",
    label: "Session preparation",
    description:
      "The provider is prepared with the materials, plan, and relevant client information needed for the session.",
  },
  {
    key: "plan_implementation",
    label: "Plan implementation",
    description:
      "The provider follows the current clinical or educational plan as written and within their role.",
  },
  {
    key: "proactive_support",
    label: "Proactive support",
    description:
      "The provider anticipates needs and uses appropriate supports before avoidable difficulty occurs.",
  },
  {
    key: "prompting_and_independence",
    label: "Prompting and independence",
    description:
      "Prompts are appropriate, timely, and faded when possible to support client independence.",
  },
  {
    key: "reinforcement",
    label: "Reinforcement",
    description:
      "Reinforcement is meaningful, contingent when appropriate, and delivered consistently.",
  },
  {
    key: "response_to_behavior",
    label: "Response to behavior",
    description:
      "The provider responds to behavior safely, calmly, and consistently with the current plan.",
  },
  {
    key: "data_collection",
    label: "Data collection",
    description:
      "The provider records relevant data accurately and according to the established workflow.",
  },
  {
    key: "dignity_and_assent",
    label: "Dignity and assent",
    description:
      "The provider protects dignity, recognizes assent or withdrawal, and communicates respectfully.",
  },
] as const;

export type FieldObservationCriterionKey =
  (typeof FIELD_OBSERVATION_RUBRIC)[number]["key"];

export type FieldObservationScoredItem = {
  criterionKey: string;
  rating: string;
};

export function buildFieldObservationItemSnapshot(
  criterionRatings: Readonly<Record<string, string | undefined>>,
) {
  return FIELD_OBSERVATION_RUBRIC.map((criterion) => ({
    criterionKey: criterion.key,
    rating: criterionRatings[criterion.key] || "NOT_OBSERVED",
    note: null,
  }));
}

export type FieldObservationCoverage = {
  assessedItemCount: number;
  excludedItemCount: number;
  fidelityPercent: number | null;
};

export function getFieldObservationCoverage(
  criterionRatings: Readonly<Record<string, string | undefined>>,
): FieldObservationCoverage {
  let assessedItemCount = 0;
  let earnedPoints = 0;

  for (const criterion of FIELD_OBSERVATION_RUBRIC) {
    const rating = criterionRatings[criterion.key];
    if (!rating || !isFieldObservationRating(rating)) continue;
    const points = FIELD_OBSERVATION_RATING_DEFINITIONS[rating].points;
    if (points === null) continue;
    assessedItemCount += 1;
    earnedPoints += points;
  }

  const possiblePoints = assessedItemCount * 2;
  return {
    assessedItemCount,
    excludedItemCount: FIELD_OBSERVATION_RUBRIC.length - assessedItemCount,
    fidelityPercent:
      possiblePoints > 0
        ? Math.round((earnedPoints / possiblePoints) * 100)
        : null,
  };
}

export function isFieldObservationFinishEnabled(input: {
  observedProviderId: string;
  observedAt: string;
  setting: string;
  criterionRatings: Readonly<Record<string, string | undefined>>;
}): boolean {
  return Boolean(
    input.observedProviderId &&
      input.observedAt &&
      input.setting &&
      getFieldObservationCoverage(input.criterionRatings).assessedItemCount > 0,
  );
}

export type FieldObservationFidelityResult = {
  fidelityPercent: number;
  applicableItemCount: number;
  earnedPoints: number;
  possiblePoints: number;
};

export class FieldObservationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldObservationValidationError";
  }
}

const canonicalCriterionKeys = FIELD_OBSERVATION_RUBRIC.map(
  (criterion) => criterion.key,
);
const canonicalCriterionKeySet = new Set<string>(canonicalCriterionKeys);
const recognizedRatingSet = new Set<string>(FIELD_OBSERVATION_RATINGS);

export function isFieldObservationEligibleRole(
  role: string,
): role is FieldObservationEligibleRole {
  return FIELD_OBSERVATION_ELIGIBLE_ROLES.includes(
    role as FieldObservationEligibleRole,
  );
}

export function isFieldObservationSetting(
  setting: string,
): setting is FieldObservationSetting {
  return FIELD_OBSERVATION_SETTINGS.includes(
    setting as FieldObservationSetting,
  );
}

export function isFieldObservationRating(
  rating: string,
): rating is FieldObservationRating {
  return FIELD_OBSERVATION_RATINGS.includes(
    rating as FieldObservationRating,
  );
}

export function validateFieldObservationItems(
  items: readonly FieldObservationScoredItem[],
): void {
  if (items.length !== canonicalCriterionKeys.length) {
    throw new FieldObservationValidationError(
      "Submitted criteria must exactly match the current Field Observation rubric.",
    );
  }

  const submittedKeys = new Set<string>();

  for (const item of items) {
    if (!canonicalCriterionKeySet.has(item.criterionKey)) {
      throw new FieldObservationValidationError(
        `Unrecognized Field Observation criterion: ${item.criterionKey}.`,
      );
    }
    if (submittedKeys.has(item.criterionKey)) {
      throw new FieldObservationValidationError(
        `Duplicate Field Observation criterion: ${item.criterionKey}.`,
      );
    }
    if (!recognizedRatingSet.has(item.rating)) {
      throw new FieldObservationValidationError(
        `Unrecognized Field Observation rating: ${item.rating}.`,
      );
    }
    submittedKeys.add(item.criterionKey);
  }

  for (const criterionKey of canonicalCriterionKeys) {
    if (!submittedKeys.has(criterionKey)) {
      throw new FieldObservationValidationError(
        `Missing Field Observation criterion: ${criterionKey}.`,
      );
    }
  }
}

export function calculateFieldObservationFidelity(
  items: readonly FieldObservationScoredItem[],
): FieldObservationFidelityResult {
  validateFieldObservationItems(items);

  let applicableItemCount = 0;
  let earnedPoints = 0;

  for (const item of items) {
    const rating = item.rating as FieldObservationRating;
    const points = FIELD_OBSERVATION_RATING_DEFINITIONS[rating].points;
    if (points === null) continue;
    applicableItemCount += 1;
    earnedPoints += points;
  }

  if (applicableItemCount === 0) {
    throw new FieldObservationValidationError(
      "At least one Field Observation criterion must be assessed.",
    );
  }

  const possiblePoints = applicableItemCount * 2;
  return {
    fidelityPercent: Math.round((earnedPoints / possiblePoints) * 100),
    applicableItemCount,
    earnedPoints,
    possiblePoints,
  };
}

export function validateFieldObservationAuthorization(input: {
  actorRole: string;
  supervisorAssignedToClient: boolean;
  observedProviderAssignedToClient: boolean;
  observedProviderRole: string;
}): void {
  if (input.actorRole !== "Supervisor") {
    throw new FieldObservationValidationError(
      "Only supervisors can create Field Observations.",
    );
  }
  if (!input.supervisorAssignedToClient) {
    throw new FieldObservationValidationError(
      "The supervisor is not assigned to this client.",
    );
  }
  if (!input.observedProviderAssignedToClient) {
    throw new FieldObservationValidationError(
      "The observed provider is not assigned to this client.",
    );
  }
  if (!isFieldObservationEligibleRole(input.observedProviderRole)) {
    throw new FieldObservationValidationError(
      "The selected provider role is not eligible for Field Observation.",
    );
  }
}

export function validateFieldObservationContext(input: {
  observedAt: Date;
  setting: string;
  durationMinutes?: number | null;
  now?: Date;
}): void {
  if (!(input.observedAt instanceof Date) || Number.isNaN(input.observedAt.getTime())) {
    throw new FieldObservationValidationError(
      "A valid observation date and time is required.",
    );
  }

  const now = input.now ?? new Date();
  if (input.observedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new FieldObservationValidationError(
      "The observation date cannot be in the future.",
    );
  }

  if (!isFieldObservationSetting(input.setting)) {
    throw new FieldObservationValidationError(
      "A recognized observation setting is required.",
    );
  }

  if (
    input.durationMinutes !== undefined &&
    input.durationMinutes !== null &&
    (!Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 1 ||
      input.durationMinutes > 1440)
  ) {
    throw new FieldObservationValidationError(
      "Duration must be a whole number between 1 and 1440 minutes.",
    );
  }
}
