export type CaretakerContextKind = "MorningContext" | "EveningContext";

export type CaretakerContextCard = {
  key: string;
  label: string;
  prompt: string;
  placeholder?: string;
  options?: string[];
  kind?: "choice" | "comment";
};

export type CaretakerContextData = {
  kind: CaretakerContextKind;
  entries: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  comment: string;
};

const morningBaseCards: CaretakerContextCard[] = [
  {
    key: "sleep",
    label: "Sleep",
    prompt: "How was sleep?",
    options: ["Good", "Restless", "Poor", "Woke early"],
  },
  {
    key: "breakfast",
    label: "Breakfast",
    prompt: "How was breakfast?",
    options: ["Ate well", "Ate some", "Skipped", "Not sure"],
  },
  {
    key: "schoolTransition",
    label: "School Transition",
    prompt: "How was the transition to school or care?",
    options: ["Smooth", "Slow", "Difficult", "Not applicable"],
  },
];

const medicationCard: CaretakerContextCard = {
  key: "medication",
  label: "Medication",
  prompt: "Was prescribed medication given?",
  options: ["Given", "Not given", "Not sure"],
};

const morningCommentCard: CaretakerContextCard = {
  key: "comment",
  label: "Comment",
  prompt: "Is there anything important you'd like your care team to know today?",
  placeholder:
    "Include sleep, mood, medication, routine changes, new reinforcers, things that helped, or anything that may affect today's sessions.",
  kind: "comment",
};

const eveningCards: CaretakerContextCard[] = [
  {
    key: "overallEvening",
    label: "Overall Evening",
    prompt: "How was the evening overall?",
    options: ["Calm", "Mixed", "Hard", "Great"],
  },
  {
    key: "dinnerAppetite",
    label: "Dinner / Appetite",
    prompt: "How was dinner or appetite?",
    options: ["Ate well", "Ate some", "Skipped", "Not sure"],
  },
  {
    key: "homeRoutine",
    label: "Home Routine",
    prompt: "How did the home routine go?",
    options: ["Smooth", "Needed support", "Difficult", "Different routine"],
  },
  {
    key: "comment",
    label: "Comment",
    prompt: "Is there anything important you'd like your care team to know about tonight?",
    placeholder:
      "Include mood, meals, medication, routine changes, new reinforcers, things that helped, or anything the team should carry into tomorrow.",
    kind: "comment",
  },
];

export function getCaretakerContextCards({
  kind,
  receivesPrescribedMedication,
}: {
  kind: CaretakerContextKind;
  receivesPrescribedMedication: boolean;
}) {
  if (kind === "EveningContext") {
    return eveningCards;
  }

  return receivesPrescribedMedication
    ? [
        morningBaseCards[0],
        morningBaseCards[1],
        medicationCard,
        morningBaseCards[2],
        morningCommentCard,
      ]
    : [...morningBaseCards, morningCommentCard];
}

export function contextKindLabel(kind: CaretakerContextKind) {
  return kind === "MorningContext" ? "Morning Context" : "Evening Context";
}

export function parseCaretakerContextKind(value: string | null) {
  return value === "MorningContext" || value === "EveningContext" ? value : null;
}
