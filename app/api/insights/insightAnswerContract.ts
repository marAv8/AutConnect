import type { InsightCategory } from "@/app/libs/insights/categories";
import type { InsightResult } from "./insightsEngine";

const DIRECT_QUESTION_PATTERNS: Record<InsightCategory, RegExp> = {
  overview:
    /\b(team focus|focus|overview|recent activity|care team|case support|support request|support case)\b/i,
  progress:
    /\b(target|goal|progress|trend|lowest|highest|most difficult|frequency|duration|percentage|score|session|compliance|late|delay)\b/i,
  providers:
    /\b(providers?|contributions?|overlap|collaboration|care team|speech|slp|occupational|\bot\b|behavior|\bbt\b|educator|teacher|caregiver|supervisor|bcba)\b/i,
  documentation:
    /\b(note|document|author|wrote|filed|revision|update|edit|completed|latest|recent|count|how many)\b/i,
  caseSupport:
    /\b(case support|support request|requester|owner|documentation|entry|coordination|action|next step|status|filed|opened)\b/i,
};

const INTERPRETIVE_QUESTION_PATTERN =
  /\b(why|relationship|relate|connect|across|pattern|overall pattern|synthesi[sz]e|consistent|inconsistent|possible explanation|what might|how do .* together)\b/i;

const INSUFFICIENT_LANGUAGE =
  /\b(no matching|no scored|no completed|no current|no accessible|not enough|insufficient|could not find|was not found)\b/i;

export function annotateDeterministicInsight(
  insight: InsightResult,
  question: string,
  category: InsightCategory
): InsightResult {
  const directCoverage = DIRECT_QUESTION_PATTERNS[category].test(question);
  const insufficient = INSUFFICIENT_LANGUAGE.test(insight.summary);

  if (insufficient) {
    return {
      ...insight,
      answerMode: "insufficient",
      confidence: directCoverage ? "high" : "low",
      limitations: [
        directCoverage
          ? "No matching accessible record was found for this question."
          : "The available records do not directly answer this question.",
      ],
    };
  }

  return {
    ...insight,
    answerMode: "deterministic",
    confidence: directCoverage ? "high" : "medium",
    limitations: directCoverage
      ? []
      : ["This answer is a structured category summary rather than a direct match."],
  };
}

export function shouldAttemptSynthesis(
  question: string,
  category: InsightCategory,
  insight: InsightResult
) {
  if (insight.answerMode === "insufficient") return false;

  return (
    INTERPRETIVE_QUESTION_PATTERN.test(question) ||
    !DIRECT_QUESTION_PATTERNS[category].test(question)
  );
}
