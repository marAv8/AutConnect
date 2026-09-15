import type { MasteryCandidateResult } from "./masteryCandidatePolicy";

export type PersistedMasteryBasis =
  | "LEGACY_NORMALIZED"
  | "POLICY_V1"
  | null;

export type MasteryPersistenceAction = "mark" | "clear" | "none";

export function masteryPersistenceAction(input: {
  isMastered: boolean;
  masteryBasis: PersistedMasteryBasis;
  candidateStatus: MasteryCandidateResult["status"];
}): MasteryPersistenceAction {
  if (input.masteryBasis === "LEGACY_NORMALIZED") {
    return "none";
  }
  if (input.candidateStatus === "candidate") {
    return "mark";
  }
  return input.masteryBasis === "POLICY_V1" ? "clear" : "none";
}

export function activateCorrectedGoal(hasActiveReplacement: boolean) {
  return !hasActiveReplacement;
}
