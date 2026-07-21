/**
 * Provider-facing choices used by the Add Note workflow.
 *
 * EntryForm owns interaction and draft state; this module owns the clinical
 * labels, fallback targets, and response scales rendered by that UI. Keeping
 * these definitions separate lets reviewers change wording without parsing the
 * full session-documentation component.
 */
import type { ProfessionMeasurementOption } from "@/app/libs/professionTemplates";
import { MetricType } from "./entryFormHelpers";

export type EducatorMeasurementProfile =
  | "Participation"
  | "SupportLevel"
  | "Completion"
  | "Independence"
  | "Frequency"
  | "PromptLevel"
  | "Duration"
  | "Latency"
  | "Accuracy"
  | "CueingLevel"
  | "AssistanceLevel";

export const educatorFallbackTargetOptions = [
  "Transition to Classroom",
  "Group Participation",
  "Independent Work",
  "Following Directions",
  "Peer Interaction",
  "Assignment Completion",
  "Other",
];

export const otFallbackTargetOptions = [
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
];

export const speechFallbackTargetOptions = [
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
];

export const behaviorTherapistFallbackTargetOptions = [
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
];

export const educatorMeasurementProfiles: Array<{
  value: EducatorMeasurementProfile;
  label: string;
  helper?: string;
}> = [
  { value: "Participation", label: "Participation", helper: "engagement in the classroom activity" },
  { value: "Completion", label: "Task Completion", helper: "how much of the assigned work was completed" },
  { value: "Independence", label: "Independence", helper: "amount of adult support required" },
  { value: "Frequency", label: "Frequency", helper: "how often the behavior or response occurred" },
  { value: "Accuracy", label: "Accuracy", helper: "correct academic responses" },
];

export const educatorResponseProfiles: Record<
  EducatorMeasurementProfile,
  {
    prompt: string;
    metricType: MetricType;
    field: "score" | "rawValue";
    options?: Array<{ label: string; value: string; helper?: string }>;
    placeholder?: string;
  }
> = {
  Participation: {
    prompt: "Today's participation",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Avoided", value: "1" },
      { label: "Participated with Frequent Support", value: "2" },
      { label: "Participated with Some Support", value: "3" },
      { label: "Independent", value: "4" },
    ],
  },
  SupportLevel: {
    prompt: "How did today's transition go?",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Required Full Support", value: "1" },
      { label: "Required Some Support", value: "2" },
      { label: "Mostly Independent", value: "3" },
      { label: "Independent", value: "4" },
    ],
  },
  PromptLevel: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      {
        label: "Maximum Prompting",
        value: "1",
        helper: "e.g. full physical or hand-over-hand assistance",
      },
      {
        label: "Moderate Prompting",
        value: "2",
        helper: "e.g. model or partial physical prompting",
      },
      {
        label: "Minimal Prompting",
        value: "3",
        helper: "e.g. verbal or gestural prompting",
      },
      { label: "Independent", value: "4", helper: "no prompt needed" },
    ],
  },
  CueingLevel: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Maximum Cueing", value: "1" },
      { label: "Moderate Cueing", value: "2" },
      { label: "Minimal Cueing", value: "3" },
      { label: "Independent", value: "4" },
    ],
  },
  AssistanceLevel: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Maximum Assistance", value: "1" },
      { label: "Moderate Assistance", value: "2" },
      { label: "Minimal Assistance", value: "3" },
      { label: "Independent", value: "4" },
    ],
  },
  Accuracy: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Not Yet Accurate", value: "1" },
      { label: "Emerging Accuracy", value: "2" },
      { label: "Mostly Accurate", value: "3" },
      { label: "Consistently Accurate", value: "4" },
    ],
  },
  Completion: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Did Not Attempt", value: "1" },
      { label: "Partial Completion", value: "2" },
      { label: "Completed with Support", value: "3" },
      { label: "Completed Independently", value: "4" },
    ],
  },
  Independence: {
    prompt: "Today's independence",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Required Full Support", value: "1" },
      { label: "Required Some Support", value: "2" },
      { label: "Mostly Independent", value: "3" },
      { label: "Independent", value: "4" },
    ],
  },
  Frequency: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Never", value: "1" },
      { label: "Rarely", value: "2" },
      { label: "Sometimes", value: "3" },
      { label: "Frequently", value: "4" },
    ],
  },
  Duration: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Very Brief", value: "1" },
      { label: "Brief", value: "2" },
      { label: "Sustained", value: "3" },
      { label: "Extended", value: "4" },
    ],
  },
  Latency: {
    prompt: "Today's performance",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Long Delay", value: "1" },
      { label: "Moderate Delay", value: "2" },
      { label: "Brief Delay", value: "3" },
      { label: "Immediate", value: "4" },
    ],
  },
};

export const behaviorTherapistMeasurementProfiles: typeof educatorMeasurementProfiles = [
  { value: "PromptLevel", label: "Prompt Level", helper: "maximum, moderate, minimal, or none" },
  { value: "Frequency", label: "Frequency", helper: "how often it occurred" },
  { value: "Duration", label: "Duration", helper: "how long it lasted" },
  { value: "Latency", label: "Latency", helper: "time before the response began" },
  { value: "Accuracy", label: "Accuracy", helper: "correct responding across opportunities" },
];

export const speechMeasurementProfiles: typeof educatorMeasurementProfiles = [
  { value: "CueingLevel", label: "Cueing Level", helper: "amount of verbal, visual, or modeled cueing" },
  { value: "Accuracy", label: "Accuracy", helper: "correct responses or productions" },
  { value: "Participation", label: "Participation", helper: "engagement in the communication activity" },
  { value: "Frequency", label: "Frequency", helper: "number or rate of occurrences" },
  { value: "Completion", label: "Completion", helper: "whether the communication task was completed" },
];

export const otMeasurementProfiles: typeof educatorMeasurementProfiles = [
  { value: "AssistanceLevel", label: "Assistance Level", helper: "physical or verbal help required" },
  { value: "Independence", label: "Independence", helper: "ability to perform the skill without help" },
  { value: "Completion", label: "Task Completion", helper: "how much of the activity was completed" },
  { value: "Participation", label: "Participation", helper: "engagement in the therapeutic activity" },
  { value: "Frequency", label: "Frequency", helper: "how often the response occurred" },
];

export const otResponseProfiles: typeof educatorResponseProfiles = {
  Participation: {
    ...educatorResponseProfiles.Participation,
    options: [
      { label: "Refused", value: "1" },
      { label: "Limited Participation", value: "2" },
      { label: "Participated With Prompts", value: "3" },
      { label: "Fully Participated", value: "4" },
    ],
  },
  SupportLevel: educatorResponseProfiles.AssistanceLevel,
  PromptLevel: educatorResponseProfiles.PromptLevel,
  CueingLevel: educatorResponseProfiles.CueingLevel,
  AssistanceLevel: educatorResponseProfiles.AssistanceLevel,
  Accuracy: educatorResponseProfiles.Accuracy,
  Completion: educatorResponseProfiles.Completion,
  Independence: {
    ...educatorResponseProfiles.Independence,
    options: [
      { label: "Fully Dependent", value: "1" },
      { label: "Needs Frequent Prompts", value: "2" },
      { label: "Needs Occasional Prompts", value: "3" },
      { label: "Independent", value: "4" },
    ],
  },
  Frequency: {
    prompt: "How often was this observed today?",
    metricType: MetricType.Subjective,
    field: "score",
    options: [
      { label: "Never", value: "1" },
      { label: "Rarely", value: "2" },
      { label: "Sometimes", value: "3" },
      { label: "Frequently", value: "4" },
    ],
  },
  Duration: educatorResponseProfiles.Duration,
  Latency: educatorResponseProfiles.Latency,
};

export const speechResponseProfiles: typeof educatorResponseProfiles = {
  Participation: {
    ...educatorResponseProfiles.Participation,
    options: [
      { label: "Did Not Participate", value: "1" },
      { label: "Participated with Support", value: "2" },
      { label: "Participated Consistently", value: "3" },
      { label: "Fully Engaged", value: "4" },
    ],
  },
  SupportLevel: educatorResponseProfiles.CueingLevel,
  PromptLevel: educatorResponseProfiles.PromptLevel,
  CueingLevel: educatorResponseProfiles.CueingLevel,
  AssistanceLevel: educatorResponseProfiles.AssistanceLevel,
  Accuracy: educatorResponseProfiles.Accuracy,
  Completion: educatorResponseProfiles.Completion,
  Independence: otResponseProfiles.Independence,
  Frequency: otResponseProfiles.Frequency,
  Duration: educatorResponseProfiles.Duration,
  Latency: educatorResponseProfiles.Latency,
};

export const behaviorTherapistResponseProfiles: typeof educatorResponseProfiles = {
  Participation: speechResponseProfiles.Participation,
  SupportLevel: educatorResponseProfiles.PromptLevel,
  PromptLevel: educatorResponseProfiles.PromptLevel,
  CueingLevel: educatorResponseProfiles.CueingLevel,
  AssistanceLevel: educatorResponseProfiles.AssistanceLevel,
  Accuracy: educatorResponseProfiles.Accuracy,
  Completion: educatorResponseProfiles.Completion,
  Independence: otResponseProfiles.Independence,
  Frequency: otResponseProfiles.Frequency,
  Duration: educatorResponseProfiles.Duration,
  Latency: educatorResponseProfiles.Latency,
};

export const observationCategoryOptions = [
  "Behavior Therapist",
  "Client",
  "Environment",
  "Caretaker",
  "Team",
  "Other",
];

export const sensoryObservationCategoryOptions = [
  "Sensory Seeking",
  "Sensory Avoiding",
  "Self Regulation",
  "Fine Motor",
  "Gross Motor",
  "Motor Planning",
  "Visual Motor",
  "Environmental",
  "Other",
];

export const sensoryRecommendationOptions = [
  "Continue Current Strategy",
  "Increase Sensory Breaks",
  "Modify Environment",
  "Introduce Adaptive Equipment",
  "Discuss with Team",
  "Other",
];

export const communicationObservationCategoryOptions = [
  "Expressive Language",
  "Receptive Language",
  "Articulation",
  "Fluency",
  "Pragmatic Language",
  "AAC",
  "Voice",
  "Social Communication",
  "Feeding / Oral Motor",
  "Other",
];

export const communicationRecommendationOptions = [
  "Continue Current Strategy",
  "Increase Modeling",
  "Provide Additional Visual Supports",
  "Modify Prompting",
  "Discuss with Team",
  "Other",
];

export const fallbackMeasurementOptions: ProfessionMeasurementOption[] = [
  {
    value: "percentage",
    label: "Percentage",
    metricType: MetricType.Percentage,
    classification: "percentage",
    inputKind: "number",
    normalizationStrategy: "percentage",
    recommendedRange: { min: 0, max: 100 },
    direction: "goalDependent",
  },
  {
    value: "frequency",
    label: "Frequency",
    metricType: MetricType.Frequency,
    classification: "frequency",
    inputKind: "number",
    normalizationStrategy: "count",
    recommendedRange: { min: 0, max: null },
    direction: "goalDependent",
  },
  {
    value: "duration",
    label: "Duration",
    metricType: MetricType.Duration,
    classification: "duration",
    inputKind: "duration",
    normalizationStrategy: "duration",
    recommendedRange: { min: 0, max: null },
    direction: "goalDependent",
  },
  {
    value: "subjective",
    label: "Subjective",
    metricType: MetricType.Subjective,
    classification: "text",
    inputKind: "text",
    normalizationStrategy: "textOnly",
    recommendedRange: { min: null, max: null },
    direction: "goalDependent",
  },
];
