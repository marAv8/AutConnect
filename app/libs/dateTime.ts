const CLINICAL_TIME_ZONE = "America/Los_Angeles";

export function formatClinicalDateTime(value: Date | string | number) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: CLINICAL_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatClinicalShortDateTime(value: Date | string | number) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: CLINICAL_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
