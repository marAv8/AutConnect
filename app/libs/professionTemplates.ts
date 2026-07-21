export type Profession =
  | "Supervisor"
  | "Educator"
  | "SpeechPathologist"
  | "Caregiver"
  | "BehaviorTherapist"
  | "OccupationalTherapist";

export type TemplateMetricType =
  | "Percentage"
  | "Frequency"
  | "Duration"
  | "Subjective";

export type TemplateAssessmentDomain =
  | "Behavior"
  | "SkillAcquisition"
  | "Communication"
  | "Adaptive"
  | "Regulation"
  | "Other";

export type ProfessionMeasurementOption = {
  value: string;
  label: string;
  metricType: TemplateMetricType;
  classification:
    | "percentage"
    | "frequency"
    | "duration"
    | "ordinalScale"
    | "boolean"
    | "text"
    | "unsupported";
  inputKind: "number" | "duration" | "ordinalScale" | "boolean" | "text";
  normalizationStrategy:
    | "percentage"
    | "count"
    | "duration"
    | "ordinal"
    | "boolean"
    | "textOnly";
  recommendedRange: {
    min: number | null;
    max: number | null;
  };
  direction: "higherIsBetter" | "lowerIsBetter" | "goalDependent";
  scaleLabels?: string[];
};

export type ProfessionTemplateItem = {
  target: string;
  goal: string;
  metricType: TemplateMetricType;
  domain: TemplateAssessmentDomain;
  description?: string;
};

export type ProfessionTargetOption = {
  value: string;
  label: string;
  recommendedMetricType: TemplateMetricType;
  defaultDomain: TemplateAssessmentDomain;
  description?: string;
  tags?: string[];
};

export type ProfessionTemplate = {
  profession: Profession;
  label: string;
  description?: string;
  targets: ProfessionTargetOption[];
  measurements: ProfessionMeasurementOption[];
  items: ProfessionTemplateItem[];
};

function measurement(
  value: string,
  label: string,
  metricType: TemplateMetricType,
  classification: ProfessionMeasurementOption["classification"],
  inputKind: ProfessionMeasurementOption["inputKind"],
  normalizationStrategy: ProfessionMeasurementOption["normalizationStrategy"],
  min: number | null,
  max: number | null,
  direction: ProfessionMeasurementOption["direction"],
  scaleLabels?: string[]
): ProfessionMeasurementOption {
  return {
    value,
    label,
    metricType,
    classification,
    inputKind,
    normalizationStrategy,
    recommendedRange: { min, max },
    direction,
    scaleLabels,
  };
}

const behaviorTherapistMeasurements: ProfessionMeasurementOption[] = [
  measurement("percentage", "Percentage", "Percentage", "percentage", "number", "percentage", 0, 100, "goalDependent"),
  measurement("frequency", "Frequency", "Frequency", "frequency", "number", "count", 0, null, "goalDependent"),
  measurement("duration", "Duration", "Duration", "duration", "duration", "duration", 0, null, "goalDependent"),
  measurement("latency", "Latency", "Duration", "duration", "duration", "duration", 0, null, "lowerIsBetter"),
  measurement("prompt-level", "Prompt Level", "Subjective", "ordinalScale", "ordinalScale", "ordinal", 0, 5, "lowerIsBetter", [
    "Independent",
    "Gestural",
    "Verbal",
    "Model",
    "Partial Physical",
    "Full Physical",
  ]),
  measurement("independence", "Independence", "Percentage", "percentage", "number", "percentage", 0, 100, "higherIsBetter"),
  measurement("subjective", "Subjective", "Subjective", "text", "text", "textOnly", null, null, "goalDependent"),
];

const speechPathologistMeasurements: ProfessionMeasurementOption[] = [
  measurement("accuracy", "Accuracy", "Percentage", "percentage", "number", "percentage", 0, 100, "higherIsBetter"),
  measurement("cue-level", "Cue Level", "Subjective", "ordinalScale", "ordinalScale", "ordinal", 0, 5, "lowerIsBetter", [
    "Independent",
    "Indirect Cue",
    "Direct Verbal Cue",
    "Model",
    "Multiple Cues",
    "Full Support",
  ]),
  measurement("opportunities", "Opportunities", "Frequency", "frequency", "number", "count", 0, null, "goalDependent"),
  measurement("frequency", "Frequency", "Frequency", "frequency", "number", "count", 0, null, "goalDependent"),
  measurement("duration", "Duration", "Duration", "duration", "duration", "duration", 0, null, "goalDependent"),
  measurement("intelligibility", "Intelligibility", "Percentage", "percentage", "number", "percentage", 0, 100, "higherIsBetter"),
  measurement("subjective", "Subjective", "Subjective", "text", "text", "textOnly", null, null, "goalDependent"),
];

const occupationalTherapistMeasurements: ProfessionMeasurementOption[] = [
  measurement("assistance-level", "Assistance Level", "Subjective", "ordinalScale", "ordinalScale", "ordinal", 0, 5, "lowerIsBetter", [
    "Independent",
    "Supervision",
    "Minimal",
    "Moderate",
    "Maximal",
    "Dependent",
  ]),
  measurement("independence-level", "Independence Level", "Percentage", "percentage", "number", "percentage", 0, 100, "higherIsBetter"),
  measurement("duration", "Duration", "Duration", "duration", "duration", "duration", 0, null, "goalDependent"),
  measurement("repetitions", "Repetitions", "Frequency", "frequency", "number", "count", 0, null, "higherIsBetter"),
  measurement("tolerance", "Tolerance", "Subjective", "ordinalScale", "ordinalScale", "ordinal", 1, 5, "higherIsBetter", [
    "Avoided",
    "Brief",
    "Partial",
    "Sustained",
    "Independent",
  ]),
  measurement("frequency", "Frequency", "Frequency", "frequency", "number", "count", 0, null, "goalDependent"),
  measurement("subjective", "Subjective", "Subjective", "text", "text", "textOnly", null, null, "goalDependent"),
];

const educatorMeasurements: ProfessionMeasurementOption[] = [
  measurement("completion-percent", "Completion %", "Percentage", "percentage", "number", "percentage", 0, 100, "higherIsBetter"),
  measurement("accuracy", "Accuracy", "Percentage", "percentage", "number", "percentage", 0, 100, "higherIsBetter"),
  measurement("participation", "Participation", "Subjective", "ordinalScale", "ordinalScale", "ordinal", 1, 5, "higherIsBetter", [
    "None",
    "Low",
    "Partial",
    "Active",
    "Independent",
  ]),
  measurement("frequency", "Frequency", "Frequency", "frequency", "number", "count", 0, null, "goalDependent"),
  measurement("duration", "Duration", "Duration", "duration", "duration", "duration", 0, null, "goalDependent"),
  measurement("subjective", "Subjective", "Subjective", "text", "text", "textOnly", null, null, "goalDependent"),
];

const caregiverMeasurements: ProfessionMeasurementOption[] = [
  measurement("frequency", "Frequency", "Frequency", "frequency", "number", "count", 0, null, "goalDependent"),
  measurement("duration", "Duration", "Duration", "duration", "duration", "duration", 0, null, "goalDependent"),
  measurement("intensity", "Intensity", "Subjective", "ordinalScale", "ordinalScale", "ordinal", 1, 5, "lowerIsBetter", [
    "None",
    "Mild",
    "Moderate",
    "High",
    "Severe",
  ]),
  measurement("yes-no", "Yes / No", "Subjective", "boolean", "boolean", "boolean", 0, 1, "goalDependent"),
  measurement("subjective", "Subjective", "Subjective", "text", "text", "textOnly", null, null, "goalDependent"),
];

const supervisorMeasurements: ProfessionMeasurementOption[] = [
  measurement("fidelity", "Fidelity", "Percentage", "percentage", "number", "percentage", 0, 100, "higherIsBetter"),
  measurement("percentage", "Percentage", "Percentage", "percentage", "number", "percentage", 0, 100, "goalDependent"),
  measurement("frequency", "Frequency", "Frequency", "frequency", "number", "count", 0, null, "goalDependent"),
  measurement("duration", "Duration", "Duration", "duration", "duration", "duration", 0, null, "goalDependent"),
  measurement("subjective", "Subjective", "Subjective", "text", "text", "textOnly", null, null, "goalDependent"),
];

const abaTargets: ProfessionTargetOption[] = [
  "Manding",
  "Tacting",
  "Intraverbals",
  "Listener Responding",
  "Receptive Identification",
  "Expressive Labeling",
  "Imitation",
  "Matching",
  "Transitions",
  "Aggression Reduction",
  "Elopement Reduction",
  "Self Help",
  "Toileting",
  "Social Skills",
  "Functional Communication",
  "Replacement Behavior",
  "Other",
].map((target) => ({
  value: target,
  label: target,
  recommendedMetricType: "Subjective",
  defaultDomain:
    target === "Manding" ||
    target === "Tacting" ||
    target === "Intraverbals" ||
    target === "Listener Responding" ||
    target === "Receptive Identification" ||
    target === "Expressive Labeling" ||
    target === "Functional Communication"
      ? "Communication"
      : target === "Transitions" || target === "Self Help" || target === "Toileting"
        ? "Adaptive"
        : target === "Aggression Reduction" ||
            target === "Elopement Reduction" ||
            target === "Replacement Behavior"
          ? "Behavior"
          : target === "Other"
            ? "Other"
            : "SkillAcquisition",
  tags: ["aba"],
}));

const speechPathologistTargets: ProfessionTargetOption[] = [
  "Expressive Language",
  "Receptive Language",
  "Requesting",
  "Answering Questions",
  "Following Directions",
  "Articulation",
  "Speech Sounds",
  "Conversation Skills",
  "Eye Contact",
  "Turn Taking",
  "Pragmatic Language",
  "AAC",
  "Other",
].map((target) => ({
  value: target,
  label: target,
  recommendedMetricType: "Subjective",
  defaultDomain: target === "Other" ? "Other" : "Communication",
  tags: ["speech"],
}));

const occupationalTherapistTargets: ProfessionTargetOption[] = [
  "Fine Motor Coordination",
  "Handwriting",
  "Scissor Skills",
  "Buttoning",
  "Zippering",
  "Bilateral Coordination",
  "Visual Motor Integration",
  "Core Strength",
  "Postural Control",
  "Sensory Regulation",
  "Feeding Skills",
  "Dressing Skills",
  "Toileting Independence",
  "Attention to Task",
  "Transitions",
  "Other",
].map((target) => ({
  value: target,
  label: target,
  recommendedMetricType: "Subjective",
  defaultDomain:
    target === "Sensory Regulation" ||
    target === "Attention to Task" ||
    target === "Transitions"
      ? "Regulation"
      : target === "Other"
        ? "Other"
        : "Adaptive",
  tags: ["occupational therapy"],
}));

const educatorTargets: ProfessionTargetOption[] = [
  {
    value: "Transition to Classroom",
    label: "Transition to Classroom",
    recommendedMetricType: "Subjective",
    defaultDomain: "Adaptive",
    tags: ["transition", "classroom", "support level"],
  },
  {
    value: "Group Participation",
    label: "Group Participation",
    recommendedMetricType: "Subjective",
    defaultDomain: "SkillAcquisition",
    tags: ["classroom", "participation", "group"],
  },
  {
    value: "Independent Work",
    label: "Independent Work",
    recommendedMetricType: "Subjective",
    defaultDomain: "SkillAcquisition",
    tags: ["independence", "academic"],
  },
  {
    value: "Following Directions",
    label: "Following Directions",
    recommendedMetricType: "Subjective",
    defaultDomain: "Adaptive",
    tags: ["directions", "independence"],
  },
  {
    value: "Reading",
    label: "Reading",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    tags: ["academic", "accuracy"],
  },
  {
    value: "Writing",
    label: "Writing",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    tags: ["academic", "completion"],
  },
  {
    value: "Math",
    label: "Math",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    tags: ["academic", "accuracy"],
  },
  {
    value: "Following Classroom Routine",
    label: "Following Classroom Routine",
    recommendedMetricType: "Percentage",
    defaultDomain: "Adaptive",
    tags: ["routine", "completion"],
  },
  {
    value: "Task Completion",
    label: "Task Completion",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    tags: ["completion", "academic engagement"],
  },
  {
    value: "Assignment Completion",
    label: "Assignment Completion",
    recommendedMetricType: "Subjective",
    defaultDomain: "SkillAcquisition",
    tags: ["completion", "academic"],
  },
  {
    value: "Peer Interaction",
    label: "Peer Interaction",
    recommendedMetricType: "Frequency",
    defaultDomain: "SkillAcquisition",
    tags: ["social", "frequency"],
  },
  {
    value: "Attention",
    label: "Attention",
    recommendedMetricType: "Duration",
    defaultDomain: "Regulation",
    tags: ["engagement", "duration"],
  },
  {
    value: "Academic Engagement",
    label: "Academic Engagement",
    recommendedMetricType: "Duration",
    defaultDomain: "SkillAcquisition",
    tags: ["engagement", "duration"],
  },
  {
    value: "Transitioning",
    label: "Transitioning",
    recommendedMetricType: "Duration",
    defaultDomain: "Adaptive",
    tags: ["routine", "duration"],
  },
  {
    value: "Homework Completion",
    label: "Homework Completion",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    tags: ["completion", "homework"],
  },
  {
    value: "Participation",
    label: "Participation",
    recommendedMetricType: "Subjective",
    defaultDomain: "SkillAcquisition",
    tags: ["classroom", "engagement"],
  },
];

const caregiverTargets: ProfessionTargetOption[] = [
  {
    value: "Sleep",
    label: "Sleep",
    recommendedMetricType: "Duration",
    defaultDomain: "Adaptive",
    description: "Tracks sleep duration, night waking, or bedtime settling.",
    tags: ["home routine", "duration"],
  },
  {
    value: "Meals",
    label: "Meals",
    recommendedMetricType: "Subjective",
    defaultDomain: "Adaptive",
    tags: ["home routine", "feeding"],
  },
  {
    value: "Medication",
    label: "Medication",
    recommendedMetricType: "Subjective",
    defaultDomain: "Adaptive",
    tags: ["home observation", "health"],
  },
  {
    value: "Community Outings",
    label: "Community Outings",
    recommendedMetricType: "Subjective",
    defaultDomain: "Adaptive",
    tags: ["generalization", "community"],
  },
  {
    value: "Play",
    label: "Play",
    recommendedMetricType: "Duration",
    defaultDomain: "SkillAcquisition",
    tags: ["home observation", "duration"],
  },
  {
    value: "Communication",
    label: "Communication",
    recommendedMetricType: "Frequency",
    defaultDomain: "Communication",
    tags: ["home observation", "frequency"],
  },
  {
    value: "Behavior at Home",
    label: "Behavior at Home",
    recommendedMetricType: "Frequency",
    defaultDomain: "Behavior",
    tags: ["home observation", "behavior"],
  },
  {
    value: "Morning Routine",
    label: "Morning Routine",
    recommendedMetricType: "Subjective",
    defaultDomain: "Adaptive",
    tags: ["home routine", "independence"],
  },
  {
    value: "Bedtime Routine",
    label: "Bedtime Routine",
    recommendedMetricType: "Subjective",
    defaultDomain: "Adaptive",
    tags: ["home routine", "independence"],
  },
  {
    value: "Toileting",
    label: "Toileting",
    recommendedMetricType: "Frequency",
    defaultDomain: "Adaptive",
    tags: ["home routine", "adaptive"],
  },
  {
    value: "Family Interaction",
    label: "Family Interaction",
    recommendedMetricType: "Subjective",
    defaultDomain: "SkillAcquisition",
    tags: ["home observation", "social"],
  },
  {
    value: "Safety",
    label: "Safety",
    recommendedMetricType: "Frequency",
    defaultDomain: "Behavior",
    tags: ["home observation", "safety"],
  },
];

const supervisorTargets: ProfessionTargetOption[] = [
  {
    value: "Program Integrity",
    label: "Program Integrity",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    description: "Measures whether program steps are implemented as written.",
    tags: ["treatment integrity", "fidelity"],
  },
  {
    value: "Staff Performance",
    label: "Staff Performance",
    recommendedMetricType: "Subjective",
    defaultDomain: "Other",
    tags: ["supervision", "coaching"],
  },
  {
    value: "Generalization",
    label: "Generalization",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    tags: ["clinical review", "settings"],
  },
  {
    value: "Maintenance",
    label: "Maintenance",
    recommendedMetricType: "Percentage",
    defaultDomain: "SkillAcquisition",
    tags: ["clinical review", "mastery"],
  },
  {
    value: "Prompt Fading",
    label: "Prompt Fading",
    recommendedMetricType: "Subjective",
    defaultDomain: "SkillAcquisition",
    tags: ["prompting", "independence"],
  },
  {
    value: "Behavior Plan Fidelity",
    label: "Behavior Plan Fidelity",
    recommendedMetricType: "Percentage",
    defaultDomain: "Behavior",
    tags: ["behavior plan", "fidelity"],
  },
  {
    value: "Caregiver Training",
    label: "Caregiver Training",
    recommendedMetricType: "Subjective",
    defaultDomain: "Other",
    tags: ["training", "caregiver"],
  },
  {
    value: "Clinical Observation",
    label: "Clinical Observation",
    recommendedMetricType: "Subjective",
    defaultDomain: "Other",
    tags: ["observation", "clinical review"],
  },
  {
    value: "Goal Review",
    label: "Goal Review",
    recommendedMetricType: "Subjective",
    defaultDomain: "Other",
    tags: ["goal review", "progress"],
  },
];

export const professionTemplates: Record<Profession, ProfessionTemplate> = {
  BehaviorTherapist: {
    profession: "BehaviorTherapist",
    label: "Behavior Therapist",
    description: "ABA target and metric defaults for session note setup.",
    targets: abaTargets,
    measurements: behaviorTherapistMeasurements,
    items: [],
  },
  SpeechPathologist: {
    profession: "SpeechPathologist",
    label: "Speech Pathologist",
    description: "Speech and language targets for communication-focused session notes.",
    targets: speechPathologistTargets,
    measurements: speechPathologistMeasurements,
    items: [],
  },
  OccupationalTherapist: {
    profession: "OccupationalTherapist",
    label: "Occupational Therapist",
    description: "Occupational therapy targets for participation, regulation, and daily living.",
    targets: occupationalTherapistTargets,
    measurements: occupationalTherapistMeasurements,
    items: [],
  },
  Educator: {
    profession: "Educator",
    label: "Educator",
    description: "Education targets for classroom participation and academic progress.",
    targets: educatorTargets,
    measurements: educatorMeasurements,
    items: [],
  },
  Caregiver: {
    profession: "Caregiver",
    label: "Caretaker",
    description: "Home observation targets for routines, safety, and family context.",
    targets: caregiverTargets,
    measurements: caregiverMeasurements,
    items: [],
  },
  Supervisor: {
    profession: "Supervisor",
    label: "Supervisor",
    description: "BCBA supervision targets for fidelity, clinical review, and training.",
    targets: supervisorTargets,
    measurements: supervisorMeasurements,
    items: [],
  },
};

export function getProfessionTemplate(role: string | null | undefined) {
  if (!role || !(role in professionTemplates)) {
    return null;
  }

  return professionTemplates[role as Profession];
}
