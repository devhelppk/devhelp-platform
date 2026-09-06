import { and, asc, desc, eq, isNull, max, schema, sql } from "@repo/database";
import {
  exerciseResultsSchema,
  fileMapSchema,
  questionPublicColumns,
  quizAnswersSchema,
  quizSnapshotSchema,
  toPublicOptions,
} from "@repo/database/schema";
import {
  enrolmentGeneration,
  lessonEventKey,
  recordEvent,
} from "@repo/learning";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { gradeQuiz } from "../grading";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const slug = z.string().min(1);
type Db = typeof import("@repo/database").db;

async function lessonFor(
  db: Db,
  courseSlug: string,
  lessonSlug: string,
  type: "quiz" | "exercise",
) {
  const course = await db.query.courses.findFirst({
    where: and(
      eq(schema.courses.slug, courseSlug),
      eq(schema.courses.isPublished, true),
      isNull(schema.courses.archivedAt),
    ),
    columns: { id: true },
  });
  if (!course)
    throw new TRPCError({ code: "NOT_FOUND", message: "Course not found." });
  const lesson = await db.query.lessons.findFirst({
    where: and(
      eq(schema.lessons.courseId, course.id),
      eq(schema.lessons.slug, lessonSlug),
      isNull(schema.lessons.archivedAt),
    ),
    columns: { id: true, type: true, completionRule: true },
  });
  if (!lesson || lesson.type !== type)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${type} lesson not found.`,
    });
  return {
    courseId: course.id,
    lessonId: lesson.id,
    completionRule: lesson.completionRule,
  };
}

/**
 * Serialises one learner's submissions to one quiz/exercise for the length of
 * the transaction, so attempt numbers and the attempt limit cannot race.
 */
async function lockAttempts(tx: Db, userId: string, subjectId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`${userId}:${subjectId}`}))`,
  );
}

/**
 * Marks the lesson started the first time a learner submits to it, so a failed
 * attempt still shows as in progress. Returns the enrolment generation, which
 * the auto-enrol on a first start advances.
 */
async function ensureStarted(
  db: Db,
  userId: string,
  lessonId: string,
  courseId: string,
) {
  let gen = await enrolmentGeneration(db, userId, courseId);
  const progress = await db.query.lessonProgress.findFirst({
    where: and(
      eq(schema.lessonProgress.userId, userId),
      eq(schema.lessonProgress.lessonId, lessonId),
    ),
    columns: { status: true },
  });
  if (!progress) {
    await recordEvent({
      userId,
      kind: "lesson_started",
      lessonId,
      idempotencyKey: lessonEventKey("lesson_started", userId, lessonId, gen),
    });
    if (gen === 0) gen = await enrolmentGeneration(db, userId, courseId);
  }
  return gen;
}

/** Deterministic per-user shuffle so a refresh keeps the same order. */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const assessmentsRouter = router({
  /** Questions without answers; the learner's attempt history when signed in. */
  getQuiz: publicProcedure
    .input(z.object({ courseSlug: slug, lessonSlug: slug }))
    .query(async ({ ctx, input }) => {
      const { lessonId } = await lessonFor(
        ctx.db,
        input.courseSlug,
        input.lessonSlug,
        "quiz",
      );
      const quiz = await ctx.db.query.quizzes.findFirst({
        where: eq(schema.quizzes.lessonId, lessonId),
      });
      if (!quiz)
        throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found." });
      const rows = await ctx.db
        .select({ ...questionPublicColumns, options: schema.questions.options })
        .from(schema.questions)
        .where(eq(schema.questions.quizId, quiz.id))
        .orderBy(asc(schema.questions.position));
      // Only id/text leave the server; isCorrect/feedback/answer/explanation never do.
      let questions = rows.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: toPublicOptions(q.options),
      }));
      const userId = ctx.session?.user.id ?? null;
      if (quiz.shuffle)
        questions = shuffled(questions, `${quiz.id}:${userId ?? "anon"}`);
      const attempts = userId
        ? await ctx.db.query.quizAttempts.findMany({
            where: and(
              eq(schema.quizAttempts.userId, userId),
              eq(schema.quizAttempts.quizId, quiz.id),
            ),
            columns: {
              attempt: true,
              score: true,
              passed: true,
              submittedAt: true,
              quizVersion: true,
            },
            orderBy: [desc(schema.quizAttempts.attempt)],
          })
        : [];
      const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
      // A re-synced quiz (new version) starts a fresh attempt series.
      const usedThisVersion = attempts.filter(
        (a) => a.quizVersion === quiz.version,
      ).length;
      return {
        quizId: quiz.id,
        passScore: quiz.passScore,
        maxAttempts: quiz.maxAttempts,
        version: quiz.version,
        questions,
        attempts,
        bestScore: attempts.length ? best : null,
        attemptsLeft:
          quiz.maxAttempts === null
            ? null
            : Math.max(0, quiz.maxAttempts - usedThisVersion),
      };
    }),

  submitQuiz: protectedProcedure
    .input(
      z.object({
        courseSlug: slug,
        lessonSlug: slug,
        answers: quizAnswersSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { courseId, lessonId } = await lessonFor(
        ctx.db,
        input.courseSlug,
        input.lessonSlug,
        "quiz",
      );
      const quiz = await ctx.db.query.quizzes.findFirst({
        where: eq(schema.quizzes.lessonId, lessonId),
      });
      if (!quiz)
        throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found." });
      const questions = await ctx.db.query.questions.findMany({
        where: eq(schema.questions.quizId, quiz.id),
        orderBy: [asc(schema.questions.position)],
      });
      const graded = gradeQuiz(questions, input.answers, quiz.passScore);
      const attempt = await ctx.db.transaction(async (tx) => {
        await lockAttempts(tx as unknown as Db, ctx.user.id, quiz.id);
        const [agg] = await tx
          .select({
            used: sql<number>`count(*) filter (where ${schema.quizAttempts.quizVersion} = ${quiz.version})::int`,
            last: max(schema.quizAttempts.attempt),
          })
          .from(schema.quizAttempts)
          .where(
            and(
              eq(schema.quizAttempts.userId, ctx.user.id),
              eq(schema.quizAttempts.quizId, quiz.id),
            ),
          );
        // The limit applies per quiz version: a re-synced quiz starts a fresh series.
        const used = agg?.used ?? 0;
        if (quiz.maxAttempts !== null && used >= quiz.maxAttempts) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No attempts left for this quiz.",
          });
        }
        const n = (agg?.last ?? 0) + 1;
        await tx.insert(schema.quizAttempts).values({
          userId: ctx.user.id,
          quizId: quiz.id,
          lessonId,
          courseId,
          attempt: n,
          answers: graded.answers,
          snapshot: quizSnapshotSchema.parse(graded.snapshot),
          score: graded.score,
          passed: graded.passed,
          quizVersion: quiz.version,
        });
        return n;
      });
      const gen = await ensureStarted(ctx.db, ctx.user.id, lessonId, courseId);
      // A better score on an already-completed quiz can be what satisfies
      // `minQuizScore`, so the attempt event itself may complete the course.
      const attempted = await recordEvent({
        userId: ctx.user.id,
        kind: "quiz_attempted",
        lessonId,
        payload: {
          attempt,
          score: graded.score,
          passed: graded.passed,
          version: quiz.version,
        },
        idempotencyKey: `quiz_attempted:${ctx.user.id}:${quiz.id}:${attempt}`,
      });
      let courseCompleted = attempted.courseCompleted ?? false;
      if (graded.passed) {
        const r = await recordEvent({
          userId: ctx.user.id,
          kind: "lesson_completed",
          lessonId,
          idempotencyKey: lessonEventKey(
            "lesson_completed",
            ctx.user.id,
            lessonId,
            gen,
          ),
        });
        courseCompleted ||= r.courseCompleted ?? false;
      }
      return {
        attempt,
        score: graded.score,
        passed: graded.passed,
        passScore: quiz.passScore,
        perQuestion: graded.perQuestion,
        attemptsLeft:
          quiz.maxAttempts === null
            ? null
            : Math.max(0, quiz.maxAttempts - attempt),
        courseCompleted,
      };
    }),

  /** Starter files, tests, and instructions; the tests are the contract and are shown. */
  getExercise: publicProcedure
    .input(z.object({ courseSlug: slug, lessonSlug: slug }))
    .query(async ({ ctx, input }) => {
      const { lessonId } = await lessonFor(
        ctx.db,
        input.courseSlug,
        input.lessonSlug,
        "exercise",
      );
      const ex = await ctx.db.query.exercises.findFirst({
        where: eq(schema.exercises.lessonId, lessonId),
      });
      if (!ex)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exercise not found.",
        });
      const userId = ctx.session?.user.id ?? null;
      const last = userId
        ? await ctx.db.query.exerciseSubmissions.findFirst({
            where: and(
              eq(schema.exerciseSubmissions.userId, userId),
              eq(schema.exerciseSubmissions.exerciseId, ex.id),
            ),
            orderBy: [desc(schema.exerciseSubmissions.attempt)],
            columns: {
              attempt: true,
              passed: true,
              submittedAt: true,
              files: true,
              results: true,
              exerciseVersion: true,
            },
          })
        : null;
      return {
        exerciseId: ex.id,
        runner: ex.runner,
        language: ex.language,
        entry: ex.starterFiles
          ? (Object.keys(ex.starterFiles)[0] ?? null)
          : null,
        starterFiles: ex.starterFiles,
        testFiles: ex.testFiles,
        instructions: ex.instructions,
        version: ex.version,
        lastSubmission: last,
      };
    }),

  submitExercise: protectedProcedure
    .input(
      z.object({
        courseSlug: slug,
        lessonSlug: slug,
        files: fileMapSchema,
        results: exerciseResultsSchema,
        passed: z.boolean(),
        durationMs: z.number().int().min(0).max(600_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { courseId, lessonId } = await lessonFor(
        ctx.db,
        input.courseSlug,
        input.lessonSlug,
        "exercise",
      );
      const ex = await ctx.db.query.exercises.findFirst({
        where: eq(schema.exercises.lessonId, lessonId),
      });
      if (!ex)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exercise not found.",
        });
      // The client decides pass/fail (F1.5); the server records it and refuses an inconsistent claim.
      const passed =
        input.results.length > 0 && input.results.every((r) => r.passed);
      if (passed !== input.passed)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reported pass/fail does not match the results.",
        });
      const attempt = await ctx.db.transaction(async (tx) => {
        await lockAttempts(tx as unknown as Db, ctx.user.id, ex.id);
        const [agg] = await tx
          .select({ last: max(schema.exerciseSubmissions.attempt) })
          .from(schema.exerciseSubmissions)
          .where(
            and(
              eq(schema.exerciseSubmissions.userId, ctx.user.id),
              eq(schema.exerciseSubmissions.exerciseId, ex.id),
            ),
          );
        const n = (agg?.last ?? 0) + 1;
        await tx.insert(schema.exerciseSubmissions).values({
          userId: ctx.user.id,
          exerciseId: ex.id,
          lessonId,
          attempt: n,
          files: input.files,
          results: input.results,
          passed,
          runner: ex.runner,
          exerciseVersion: ex.version,
          durationMs: input.durationMs ?? null,
        });
        return n;
      });
      const gen = await ensureStarted(ctx.db, ctx.user.id, lessonId, courseId);
      await recordEvent({
        userId: ctx.user.id,
        kind: "exercise_submitted",
        lessonId,
        payload: {
          attempt,
          passed,
          version: ex.version,
          tests: input.results.length,
          failed: input.results.filter((r) => !r.passed).length,
        },
        idempotencyKey: `exercise_submitted:${ctx.user.id}:${ex.id}:${attempt}`,
      });
      let courseCompleted = false;
      if (passed) {
        const r = await recordEvent({
          userId: ctx.user.id,
          kind: "lesson_completed",
          lessonId,
          idempotencyKey: lessonEventKey(
            "lesson_completed",
            ctx.user.id,
            lessonId,
            gen,
          ),
        });
        courseCompleted = r.courseCompleted ?? false;
      }
      return { attempt, passed, courseCompleted };
    }),
});
