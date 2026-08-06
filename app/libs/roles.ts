export const formatRole = (role: string) => {
  switch (role) {
    case "BehaviorTherapist":
      return "Behavior Technician";
    case "SpeechPathologist":
      return "Speech Pathologist";
    case "OccupationalTherapist":
      return "Occupational Therapist";
    case "Caregiver":
      return "Caretaker";
    default:
      return role.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
};

export const formatBadgeRole = (role: string) => {
  switch (role) {
    case "BehaviorTherapist":
      return "Bx Tech";
    case "SpeechPathologist":
      return "SLP";
    case "OccupationalTherapist":
      return "OT";
    case "Supervisor":
      return "BCBA";
    case "Caregiver":
      return "Caretaker";
    default:
      return role;
  }
};

export const formatAssignmentRole = (role: string) => {
  switch (role) {
    case "BehaviorTherapist":
      return "Behavior Technician";
    case "SpeechPathologist":
      return "Speech-Language Pathologist";
    case "OccupationalTherapist":
      return "Occupational Therapist";
    default:
      return role.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
};
