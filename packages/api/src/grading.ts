import type { schema } from "@repo/database";
import {
  quizAnswersSchema,
  type QuizAnswers,
  type QuizSnapshot,
} from "@repo/database/schema";

type QuestionRow = Pick<
  typeof schema.questions.$inferSelect,
  "id" | "type" | "options" | "answer" | "points" | "version" | "explanation"
>;

export const normaliseShort = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, " ");

/** Pure grading: returns the per-question snapshot and the percentage score. */
export function gradeQuiz(
  questions: QuestionRow[],
  rawAnswers: unknown,
  passScore: number,
) {
  const answers = quizAnswersSchema.parse(rawAnswers);
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.value]));
  const snapshot: QuizSnapshot = [];
  const perQuestion: {
    questionId: string;
    correct: boolean;
    correctOptionIds?: string[];
    acceptedAnswers?: string[];
    feedback?: string;
    explanation?: string;
  }[] = [];
  let total = 0;
  let earned = 0;
  for (const q of questions) {
    total += q.points;
    const given = byQuestion.get(q.id);
    let correct: boolean;
    if (q.type === "single") {
      const right = q.options.find((o) => o.isCorrect)?.id;
      correct = typeof given === "string" && given === right;
    } else if (q.type === "multi") {
      const right = new Set(
        q.options.filter((o) => o.isCorrect).map((o) => o.id),
      );
      const chosen = new Set(
        Array.isArray(given) ? given : given ? [given] : [],
      );
      correct =
        right.size === chosen.size && [...right].every((id) => chosen.has(id));
    } else {
      const accepted = (q.answer ?? []).map(normaliseShort);
      correct =
        typeof given === "string" && accepted.includes(normaliseShort(given));
    }
    if (correct) earned += q.points;
    snapshot.push({
      questionId: q.id,
      version: q.version,
      points: q.points,
      earned: correct ? q.points : 0,
      correct,
    });
    const chosenIds = Array.isArray(given)
      ? given
      : typeof given === "string"
        ? [given]
        : [];
    const feedback =
      q.type === "short"
        ? undefined
        : q.options
            .filter((o) => chosenIds.includes(o.id) && o.feedback)
            .map((o) => o.feedback)
            .join(" ") || undefined;
    perQuestion.push({
      questionId: q.id,
      correct,
      ...(q.type === "short"
        ? { acceptedAnswers: q.answer ?? [] }
        : {
            correctOptionIds: q.options
              .filter((o) => o.isCorrect)
              .map((o) => o.id),
          }),
      feedback,
      explanation: q.explanation ?? undefined,
    });
  }
  const score = total === 0 ? 0 : Math.round((earned / total) * 100);
  return {
    snapshot,
    perQuestion,
    score,
    passed: score >= passScore,
    answers: answers as QuizAnswers,
  };
}
