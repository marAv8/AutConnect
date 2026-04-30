import type { AssessmentItemInput } from "@/app/libs/schemas/entry";

export function parseAssessmentItems(value: FormDataEntryValue | null): AssessmentItemInput[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
