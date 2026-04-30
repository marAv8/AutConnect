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
