import type { InsightResult } from "./insightsEngine";

const RESTRICTED_QUESTION =
  /\b(treatment[^.?!]*should|what should (?:the )?(?:provider|care team|team|caregiver)|should (?:the )?(?:provider|care team|team|caregiver)|recommend(?:ation|ed)?|treatment plan|intervention|next steps?|action plan|disciplin\w*|termination|terminate|fire|employment decision|competenc(?:e|y)|incompetent|rank (?:the )?providers?|best provider|worst provider|who (?:is|was) better|which provider (?:has|had|shows?|performed)?\s*(?:the )?(?:highest|lowest|better|worse))\b/i;

const UNSAFE_SYNTHESIS =
  /\b(should|must|recommend(?:s|ed|ation)?|needs? to|treatment plan|intervention|next steps?|action plan|disciplin(?:e|ary)?|terminate|termination|fire|incompetent|poor provider|best provider|worst provider|underperform(?:ed|ing)?|outperform(?:ed|ing)?|caused|because of|resulted in|led to|due to)\b/i;

const INTERPRETIVE_OUTCOME =
  /\b(improved|improvement|progressed|regressed|regression|declined|mastered|mastery)\b/i;

export function restrictedQuestionAnswer(
  question: string
): InsightResult | null {
  if (!RESTRICTED_QUESTION.test(question)) return null;
  return {
    headline: "Question outside Insights scope",
    summary:
      "Insights can describe provider-linked measurements, documentation, and supervisor Field Observations, but it cannot recommend treatment or make personnel, disciplinary, competency, or employment decisions.",
    answerMode: "insufficient",
    confidence: "high",
    limitations: [
      "Ask for the recorded measurements, documented provider activity, or Field Observation rubric results instead.",
    ],
    evidence: [],
  };
}

export function synthesizedAnswerIsGuarded(
  synthesized: Pick<InsightResult, "headline" | "summary" | "limitations">,
  deterministic: InsightResult
) {
  const generatedText = [
    synthesized.headline,
    synthesized.summary,
    ...(synthesized.limitations ?? []),
  ].join(" ");
  if (UNSAFE_SYNTHESIS.test(generatedText)) return false;
  if (
    INTERPRETIVE_OUTCOME.test(generatedText) &&
    !INTERPRETIVE_OUTCOME.test(
      `${deterministic.headline ?? ""} ${deterministic.summary}`
    )
  ) {
    return false;
  }
  return true;
}
