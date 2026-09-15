const CAREGIVER_CONTEXT_KINDS = new Set(["MorningContext", "EveningContext"]);

export function canViewCaregiverMedication(input: {
  viewerProviderId: string;
  viewerRole: string;
  authorProviderId: string;
}) {
  return (
    input.viewerRole === "Supervisor" ||
    (input.viewerRole === "Caregiver" &&
      input.viewerProviderId === input.authorProviderId)
  );
}

export function shouldRedactCaregiverMedication(input: {
  kind: string;
  viewerProviderId: string;
  viewerRole: string;
  authorProviderId: string;
}) {
  return (
    CAREGIVER_CONTEXT_KINDS.has(input.kind) &&
    !canViewCaregiverMedication(input)
  );
}

export function redactMedicationContextData(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const context = value as Record<string, unknown>;
  const entries = Array.isArray(context.entries)
    ? context.entries.filter((entry) => !isMedicationEntry(entry))
    : context.entries;

  return {
    ...context,
    ...(Array.isArray(context.entries) ? { entries } : {}),
  };
}

export function redactMedicationNote(value: string | null) {
  if (!value) return value;
  const redacted = value
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:prescribed\s+)?medication\s*:/i.test(line))
    .join("\n")
    .trim();
  return redacted || null;
}

export function redactMedicationRevisionValue<T>(value: T): T {
  if (typeof value === "string") {
    return (redactMedicationNote(value) ?? "") as T;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isMedicationEntry(item))
      .map(redactMedicationRevisionValue) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) =>
        key.toLowerCase() !== "medication" && !isMedicationEntry(item)
      )
      .map(([key, item]) => [key, redactMedicationRevisionValue(item)])
  ) as T;
}

function isMedicationEntry(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    (typeof entry.key === "string" && entry.key.toLowerCase() === "medication") ||
    (typeof entry.label === "string" &&
      entry.label.trim().toLowerCase() === "medication")
  );
}
