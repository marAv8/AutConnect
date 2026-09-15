export const ORGANIZATION_SEARCH_MIN_LENGTH = 2;

export function normalizeOrganizationSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export function organizationSearchValidation(query: string) {
  const normalizedQuery = normalizeOrganizationSearchQuery(query);
  return {
    normalizedQuery,
    isEmpty: normalizedQuery.length === 0,
    isTooShort:
      normalizedQuery.length > 0 &&
      normalizedQuery.length < ORGANIZATION_SEARCH_MIN_LENGTH,
  };
}
