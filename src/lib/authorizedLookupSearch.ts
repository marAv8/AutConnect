export const AUTHORIZED_LOOKUP_MIN_LENGTH = 2;
export const AUTHORIZED_LOOKUP_RESULT_LIMIT = 8;

export function normalizeAuthorizedLookupQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function lookupTokens(value: string) {
  return normalizeAuthorizedLookupQuery(value).toLocaleLowerCase().split(" ").filter(Boolean);
}

export function providerMatchRank(
  provider: { firstName: string; lastName: string },
  query: string
) {
  const tokens = lookupTokens(query);
  const first = provider.firstName.toLocaleLowerCase();
  const last = provider.lastName.toLocaleLowerCase();
  const full = `${first} ${last}`;
  if (!tokens.length || !tokens.every((token) => first.includes(token) || last.includes(token) || full.includes(token))) {
    return Number.POSITIVE_INFINITY;
  }
  const normalized = tokens.join(" ");
  if (first.startsWith(normalized) || last.startsWith(normalized) || full.startsWith(normalized)) return 0;
  if (tokens.every((token) => first.startsWith(token) || last.startsWith(token))) return 1;
  return 2;
}

export function organizationMatchRank(name: string, query: string) {
  const normalizedName = name.toLocaleLowerCase();
  const normalizedQuery = normalizeAuthorizedLookupQuery(query).toLocaleLowerCase();
  if (!normalizedQuery || !normalizedName.includes(normalizedQuery)) return Number.POSITIVE_INFINITY;
  return normalizedName.startsWith(normalizedQuery) ? 0 : 1;
}

export function rankAndLimit<T>(
  items: T[],
  rank: (item: T) => number,
  label: (item: T) => string,
  limit = AUTHORIZED_LOOKUP_RESULT_LIMIT
) {
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((a, b) => a.rank - b.rank || label(a.item).localeCompare(label(b.item), undefined, { sensitivity: "base" }) || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function nextAutocompleteIndex(current: number, itemCount: number, key: "ArrowDown" | "ArrowUp") {
  if (!itemCount) return -1;
  if (key === "ArrowDown") return current < itemCount - 1 ? current + 1 : 0;
  return current > 0 ? current - 1 : itemCount - 1;
}
