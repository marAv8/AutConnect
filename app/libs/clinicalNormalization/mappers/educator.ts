import type { ClinicalEvent, NormalizableEntry } from "../types";
import { targetProgressEvent } from "../helpers";

export function mapEducatorEntry(entry: NormalizableEntry): ClinicalEvent[] {
  return (entry.items ?? [])
    .map((item, index) =>
      targetProgressEvent(entry, item, index, {
        eventType: "academic_target_progress",
        titlePrefix: "Academic Progress",
        tags: ["educator", "academic", item.domain ?? "unspecified"],
      })
    )
    .filter((event): event is ClinicalEvent => event !== null);
}
