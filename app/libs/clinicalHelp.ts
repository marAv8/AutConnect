import type { ContextualHelpContent } from "@/components/ContextualHelp";

export type ClinicalHelpKey =
  | "Accuracy"
  | "Antecedent"
  | "AssistanceLevel"
  | "Behavior"
  | "Completion"
  | "Consequence"
  | "CueingLevel"
  | "Duration"
  | "Frequency"
  | "Independence"
  | "Latency"
  | "Participation"
  | "Percentage"
  | "PromptLevel"
  | "SupportLevel";

export const clinicalHelpContent: Record<ClinicalHelpKey, ContextualHelpContent> = {
  Accuracy: {
    title: "Accuracy",
    explanation: "Measures how many responses were correct or successful.",
    whenToUse: "the target is based on correct responses across opportunities.",
    example: "The client answered 8 of 10 questions correctly.",
  },
  Antecedent: {
    title: "Antecedent",
    explanation: "Events or conditions immediately before the behavior that may have influenced it.",
    examples: [
      "Classroom transition",
      "Loud environment",
      "Demand placed",
      "Peer interaction",
      "Preferred item removed",
    ],
  },
  AssistanceLevel: {
    title: "Assistance Level",
    explanation: "Measures how much help was required to complete the activity.",
    whenToUse: "documenting physical, verbal, or environmental support.",
    example: "Moderate assistance was needed for buttoning a jacket.",
  },
  Behavior: {
    title: "Behavior",
    explanation: "The observable behavior that occurred.",
    examples: [
      "Verbal aggression",
      "Elopement",
      "Task refusal",
      "Self-injury",
      "Property destruction",
    ],
    notes: "Focus on observable actions rather than interpretations.",
  },
  Completion: {
    title: "Task Completion",
    explanation: "Measures how much of the assigned activity was finished.",
    whenToUse: "the goal is finishing work, routines, or therapeutic tasks.",
    example: "The worksheet was completed with adult support.",
  },
  Consequence: {
    title: "Consequence",
    explanation: "What happened immediately after the behavior.",
    examples: [
      "Redirected to task",
      "Differential reinforcement",
      "Planned ignoring",
      "Break provided",
      "Prompted replacement behavior",
    ],
    notes: "Describe the response provided rather than whether it was successful.",
  },
  CueingLevel: {
    title: "Cueing Level",
    explanation: "Measures the amount of verbal, visual, or modeled cueing needed.",
    whenToUse: "support is provided through cues rather than direct physical assistance.",
    example: "A visual cue helped the client start the next step.",
  },
  Duration: {
    title: "Duration",
    explanation: "Measures how long a behavior, skill, or activity lasted.",
    whenToUse: "time spent in an activity is clinically meaningful.",
    example: "The client remained seated for five minutes.",
  },
  Frequency: {
    title: "Frequency",
    explanation: "Counts how often a behavior, response, or skill occurred.",
    whenToUse: "the number of occurrences matters more than quality or length.",
    example: "The client requested help four times.",
  },
  Independence: {
    title: "Independence",
    explanation: "Measures how much of the skill was completed without support.",
    whenToUse: "the goal is reducing adult help over time.",
    example: "The client finished the routine with occasional prompts.",
  },
  Latency: {
    title: "Latency",
    explanation: "Measures the time between an instruction or cue and the response beginning.",
    whenToUse: "response speed or delay is part of the target.",
    example: "The client started within ten seconds of the direction.",
  },
  Participation: {
    title: "Participation",
    explanation: "Captures engagement during an activity, lesson, or therapy task.",
    whenToUse: "the goal is involvement rather than a single correct response.",
    example: "The client participated with prompts during group work.",
  },
  Percentage: {
    title: "Percentage",
    explanation: "Records performance as a percent of opportunities or expected responses.",
    whenToUse: "the target is scored as a percentage rather than a count or time.",
    example: "The client completed 80% of independent work items.",
  },
  PromptLevel: {
    title: "Prompt Level",
    explanation: "Measures the amount of assistance required to complete the target.",
    whenToUse: "tracking movement from prompted performance toward independence.",
    example: "Independent: no prompt. Minimal: verbal or gestural cue. Moderate: model or partial physical prompt. Maximum: full physical assistance.",
  },
  SupportLevel: {
    title: "Support Level",
    explanation: "Measures the overall support needed for the client to complete the task.",
    whenToUse: "the support does not fit a more specific prompt, cue, or assistance category.",
    example: "The transition was completed with some adult support.",
  },
};

const clinicalHelpAliases: Record<string, ClinicalHelpKey> = {
  accuracy: "Accuracy",
  antecedent: "Antecedent",
  "assistance-level": "AssistanceLevel",
  "assistance level": "AssistanceLevel",
  behavior: "Behavior",
  completion: "Completion",
  consequence: "Consequence",
  "task-completion": "Completion",
  "task completion": "Completion",
  "cueing-level": "CueingLevel",
  "cueing level": "CueingLevel",
  duration: "Duration",
  frequency: "Frequency",
  independence: "Independence",
  latency: "Latency",
  participation: "Participation",
  percentage: "Percentage",
  "prompt-level": "PromptLevel",
  "prompt level": "PromptLevel",
  support: "SupportLevel",
  "support-level": "SupportLevel",
  "support level": "SupportLevel",
};

export function getClinicalHelpContent(key: string | null | undefined) {
  if (!key) {
    return null;
  }

  const exact = clinicalHelpContent[key as ClinicalHelpKey];
  if (exact) {
    return exact;
  }

  const alias = clinicalHelpAliases[key.trim().toLowerCase()];
  return alias ? clinicalHelpContent[alias] : null;
}
