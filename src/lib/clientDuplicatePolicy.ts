export const POSSIBLE_DUPLICATE_LIMIT = 5;

export type PossibleDuplicateInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
};

function normalizedNamePart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function possibleDuplicateDiscoveryScope(
  providerId: string,
  input: PossibleDuplicateInput
) {
  const firstName = normalizedNamePart(input.firstName);
  const lastName = normalizedNamePart(input.lastName);

  // The current create-Client form does not collect DOB. Name alone is not a
  // meaningful identity boundary, so Phase 3A intentionally returns no query.
  if (!firstName || !lastName || !input.dateOfBirth) return null;

  return {
    providerId,
    firstName,
    lastName,
    dateOfBirth: input.dateOfBirth,
  };
}
