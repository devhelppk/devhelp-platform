import {
  completionCriteriaSchema,
  type CompletionCriteria,
} from "@repo/database/schema";

export type CompletionFacts = {
  requiredTotal: number;
  requiredDone: number;
  /** Average quiz score in percent across the course's quizzes, when known (S4). */
  quizScoreAvg?: number;
  /** Whether every project lesson has an accepted submission, when known (S8). */
  projectsAccepted?: boolean;
};

export type CompletionVerdict = { complete: boolean; unmet: string[] };

/**
 * Pure evaluator for `courses.completion_criteria`. New criteria are added here
 * and in the Zod schema; the transaction code never changes.
 */
export function evaluateCompletion(
  criteria: CompletionCriteria | null | undefined,
  facts: CompletionFacts,
): CompletionVerdict {
  const c = completionCriteriaSchema.parse(criteria ?? {});
  const unmet: string[] = [];

  if (c.requireAllRequiredLessons !== false) {
    if (facts.requiredTotal === 0 || facts.requiredDone < facts.requiredTotal) {
      unmet.push("requireAllRequiredLessons");
    }
  }
  if (c.minQuizScore !== undefined) {
    if (
      facts.quizScoreAvg === undefined ||
      facts.quizScoreAvg < c.minQuizScore
    ) {
      unmet.push("minQuizScore");
    }
  }
  if (c.requireProjectAccepted) {
    if (!facts.projectsAccepted) unmet.push("requireProjectAccepted");
  }
  return { complete: unmet.length === 0, unmet };
}
