function normalizeFirstNamePart(value: string) {
  const letters = value.match(/\p{L}/gu) ?? [];
  const isUniformCase =
    letters.length > 0 &&
    (letters.every((letter) => letter === letter.toLocaleLowerCase()) ||
      letters.every((letter) => letter === letter.toLocaleUpperCase()));

  if (!isUniformCase) {
    return value.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase());
  }

  return value
    .toLocaleLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase()}`
    );
}

export function formatCompactProviderBadgeName(
  firstName: string | null | undefined
) {
  return (firstName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeFirstNamePart)
    .join(" ");
}

export function formatProviderDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
) {
  const normalizedFirstName = formatCompactProviderBadgeName(firstName);
  const lastInitial = (lastName ?? "")
    .trim()
    .match(/[\p{L}\p{N}]/u)?.[0]
    ?.toLocaleUpperCase();

  return [normalizedFirstName, lastInitial ? `${lastInitial}.` : ""]
    .filter(Boolean)
    .join(" ");
}

export function formatStoredProviderDisplayName(
  fullName: string | null | undefined
) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const lastName = parts.length > 1 ? parts.pop() : "";

  return formatProviderDisplayName(parts.join(" "), lastName);
}
