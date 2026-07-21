import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";
import type { AttentionAudience, AttentionType, ProviderAssignment } from "./types";
import { assignedTodayAudience, entireTeamAudience, roleBasedAudience } from "./helpers";

export function determineAudience(
  type: AttentionType,
  event: ClinicalEvent,
  assignments: ProviderAssignment[] = []
): AttentionAudience {
  if (type === "caregiver_context") {
    return assignedTodayAudience(assignments);
  }

  if (type === "communication_update") {
    return roleBasedAudience([
      "SpeechPathologist",
      "BehaviorTherapist",
      "Educator",
      "Supervisor",
    ]);
  }

  if (type === "sensory_concern") {
    return roleBasedAudience([
      "OccupationalTherapist",
      "BehaviorTherapist",
      "Educator",
      "Supervisor",
    ]);
  }

  if (type === "increased_support" || type === "reduced_independence") {
    return roleBasedAudience([event.source.providerRole, "Supervisor"]);
  }

  return entireTeamAudience();
}

export function supervisorDirectiveAudience(): AttentionAudience {
  return entireTeamAudience();
}
