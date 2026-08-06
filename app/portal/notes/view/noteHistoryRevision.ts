export function formatRevisionUpdate(
  before: unknown,
  after: unknown
): string | null {
  if (Array.isArray(before) && Array.isArray(after)) {
    const previousValues = new Set(before.map(stableValue));
    const updatedValues = after.filter(
      (value) => !previousValues.has(stableValue(value))
    );

    if (updatedValues.length > 0) {
      return formatRevisionValue(updatedValues);
    }

    if (after.length < before.length) {
      return "Removed";
    }

    if (
      before.length === after.length &&
      before.every((value) => {
        const stable = stableValue(value);
        return after.some((candidate) => stableValue(candidate) === stable);
      })
    ) {
      return null;
    }
  }

  if (after === null || after === undefined || after === "") {
    return "Removed";
  }

  return formatRevisionValue(after);
}

function formatRevisionValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((item) => formatRevisionValue(item)).join("; ")
      : "None";
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([key, child]) =>
          `${formatRevisionLabel(key)}: ${formatRevisionValue(child)}`
      )
      .join("; ");
  }
  return String(value);
}

function formatRevisionLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stableValue(value: unknown) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)])
  );
}
