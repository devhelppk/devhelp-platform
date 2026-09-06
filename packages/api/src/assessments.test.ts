import { and, db, eq, inArray, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { gradeQuiz } from "./grading";
import { createCaller } from "./root";

const run = Date.now().toString(36);
const slug = `assess-${run}`;
let user: typeof schema.users.$inferSelect;
let ids: {
  courseId: string;
  quizLessonId: string;
  exLessonId: string;
  quizId: string;
  q: string[];
};

const as = (u: typeof user | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({
          user: { ...u, role: "student" },
          session: { id: "s" },
        } as unknown as Context["session"])
      : null,
  } as Context);

beforeAll(async () => {
  [user] = (await db
    .insert(schema.users)
    .values({ email: `assess-${run}@devhelp.test`, name: "Assess" })
    .returning()) as [typeof user];
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug,
      title: `Assess ${run}`,
      summary: "A private course for assessment tests, long enough.",
      isPublished: true,
      completionCriteria: { requireAllRequiredLessons: true, minQuizScore: 60 },
    })
    .returning();
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId: course!.id, slug: "m1", title: "M", position: 1 })
    .returning();
  const [quizLesson, exLesson] = await db
    .insert(schema.lessons)
    .values([
      {
        moduleId: mod!.id,
        courseId: course!.id,
        slug: "quiz",
        title: "Quiz",
        position: 1001,
        type: "quiz",
        completionRule: "quiz_pass",
      },
      {
        moduleId: mod!.id,
        courseId: course!.id,
        slug: "ex",
        title: "Ex",
        position: 1002,
        type: "exercise",
        completionRule: "exercise_pass",
      },
    ])
    .returning();
  const [quiz] = await db
    .insert(schema.quizzes)
    .values({
      lessonId: quizLesson!.id,
      passScore: 70,
      maxAttempts: 2,
      version: 3,
    })
    .returning();
  const qs = await db
    .insert(schema.questions)
    .values([
      {
        quizId: quiz!.id,
        position: 0,
        type: "single",
        prompt: "Pick one",
        points: 1,
        version: 2,
        options: [
          { id: "a", text: "A", isCorrect: true, feedback: "yes" },
          { id: "b", text: "B", isCorrect: false, feedback: "nope" },
        ],
        explanation: "A is right",
      },
      {
        quizId: quiz!.id,
        position: 1,
        type: "multi",
        prompt: "Pick many",
        points: 2,
        version: 1,
        options: [
          { id: "a", text: "A", isCorrect: true },
          { id: "b", text: "B", isCorrect: true },
          { id: "c", text: "C", isCorrect: false },
        ],
      },
      {
        quizId: quiz!.id,
        position: 2,
        type: "short",
        prompt: "Say it",
        points: 1,
        version: 1,
        options: [],
        answer: ["Trace the data", "tracing"],
      },
    ])
    .returning();
  await db.insert(schema.exercises).values({
    lessonId: exLesson!.id,
    runner: "sandpack",
    language: "typescript",
    starterFiles: { "a.ts": "export const a = 0;" },
    testFiles: {
      "a.test.ts":
        "import { it, expect } from 'vitest'; import { a } from '../starter/a'; it('a', () => expect(a).toBe(1));",
    },
    version: 1,
  });
  ids = {
    courseId: course!.id,
    quizLessonId: quizLesson!.id,
    exLessonId: exLesson!.id,
    quizId: quiz!.id,
    q: qs.map((x) => x.id),
  };
});

afterAll(async () => {
  await db.delete(schema.courses).where(eq(schema.courses.id, ids.courseId));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
});

describe("gradeQuiz", () => {
  it("grades single, multi (exact set), and short (normalised) with points", () => {
    const qs = [
      {
        id: "1",
        type: "single" as const,
        options: [
          { id: "a", text: "A", isCorrect: true },
          { id: "b", text: "B", isCorrect: false },
        ],
        answer: null,
        points: 1,
        version: 1,
        explanation: null,
      },
      {
        id: "2",
        type: "multi" as const,
        options: [
          { id: "a", text: "A", isCorrect: true },
          { id: "b", text: "B", isCorrect: true },
          { id: "c", text: "C", isCorrect: false },
        ],
        answer: null,
        points: 2,
        version: 1,
        explanation: null,
      },
      {
        id: "3",
        type: "short" as const,
        options: [],
        answer: ["Trace the data"],
        points: 1,
        version: 1,
        explanation: null,
      },
    ];
    const made = new Map<string, string>();
    const uuid = (n: string) =>
      made.get(n) ?? (made.set(n, crypto.randomUUID()), made.get(n)!);
    const withIds = qs.map((q) => ({ ...q, id: uuid(q.id) }));
    const g = gradeQuiz(
      withIds,
      [
        { questionId: uuid("1"), value: "a" },
        { questionId: uuid("2"), value: ["a"] },
        { questionId: uuid("3"), value: "  trace THE data " },
      ],
      70,
    );
    expect(g.snapshot.map((s) => s.earned)).toEqual([1, 0, 1]);
    expect(g.score).toBe(50);
    expect(g.passed).toBe(false);
    const all = gradeQuiz(
      withIds,
      [
        { questionId: uuid("1"), value: "a" },
        { questionId: uuid("2"), value: ["b", "a"] },
        { questionId: uuid("3"), value: "Trace the data" },
      ],
      70,
    );
    expect(all.score).toBe(100);
    expect(all.passed).toBe(true);
  });
});

describe("assessments router", () => {
  it("never sends answers, feedback, or explanations before submission", async () => {
    const quiz = await as(null).assessments.getQuiz({
      courseSlug: slug,
      lessonSlug: "quiz",
    });
    const payload = JSON.stringify(quiz);
    expect(payload).not.toContain("isCorrect");
    expect(payload).not.toContain("feedback");
    expect(payload).not.toContain("explanation");
    expect(payload).not.toContain("Trace the data");
    expect(quiz.questions).toHaveLength(3);
    expect(quiz.attemptsLeft).toBe(2);
  });

  it("grades on the server, snapshots versions, enforces attempts, and completes the lesson on pass", async () => {
    const caller = as(user);
    const fail = await caller.assessments.submitQuiz({
      courseSlug: slug,
      lessonSlug: "quiz",
      answers: [{ questionId: ids.q[0]!, value: "b" }],
    });
    expect(fail).toMatchObject({
      attempt: 1,
      score: 0,
      passed: false,
      attemptsLeft: 1,
    });
    expect(fail.perQuestion[0]).toMatchObject({
      correct: false,
      correctOptionIds: ["a"],
      feedback: "nope",
      explanation: "A is right",
    });

    const pass = await caller.assessments.submitQuiz({
      courseSlug: slug,
      lessonSlug: "quiz",
      answers: [
        { questionId: ids.q[0]!, value: "a" },
        { questionId: ids.q[1]!, value: ["a", "b"] },
        { questionId: ids.q[2]!, value: "tracing" },
      ],
    });
    expect(pass).toMatchObject({
      attempt: 2,
      score: 100,
      passed: true,
      attemptsLeft: 0,
    });
    const rows = await db.query.quizAttempts.findMany({
      where: and(
        eq(schema.quizAttempts.userId, user.id),
        eq(schema.quizAttempts.quizId, ids.quizId),
      ),
    });
    expect(rows.map((r) => r.attempt).sort()).toEqual([1, 2]);
    expect(
      rows.find((r) => r.attempt === 2)?.snapshot.map((s) => s.version),
    ).toEqual([2, 1, 1]);
    expect(rows[0]?.quizVersion).toBe(3);
    const events = await db.query.progressEvents.findMany({
      where: and(
        eq(schema.progressEvents.userId, user.id),
        inArray(schema.progressEvents.lessonId, [ids.quizLessonId]),
      ),
    });
    expect(events.map((e) => e.kind).sort()).toEqual([
      "lesson_completed",
      "lesson_started",
      "quiz_attempted",
      "quiz_attempted",
    ]);
    await expect(
      caller.assessments.submitQuiz({
        courseSlug: slug,
        lessonSlug: "quiz",
        answers: [],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(
      (
        await caller.assessments.getQuiz({
          courseSlug: slug,
          lessonSlug: "quiz",
        })
      ).bestScore,
    ).toBe(100);
  });

  it("records exercise submissions, refuses inconsistent pass claims, and completes the course with the quiz score", async () => {
    const caller = as(user);
    await expect(
      caller.assessments.submitExercise({
        courseSlug: slug,
        lessonSlug: "ex",
        files: { "a.ts": "x" },
        results: [{ name: "a", passed: false, error: "no" }],
        passed: true,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const failed = await caller.assessments.submitExercise({
      courseSlug: slug,
      lessonSlug: "ex",
      files: { "a.ts": "export const a = 0;" },
      results: [{ name: "a", passed: false, error: "expected 0 to be 1" }],
      passed: false,
      durationMs: 12,
    });
    expect(failed).toMatchObject({
      attempt: 1,
      passed: false,
      courseCompleted: false,
    });
    const ok = await caller.assessments.submitExercise({
      courseSlug: slug,
      lessonSlug: "ex",
      files: { "a.ts": "export const a = 1;" },
      results: [{ name: "a", passed: true }],
      passed: true,
      durationMs: 9,
    });
    // Both required lessons done and the best quiz score (100) clears minQuizScore 60.
    expect(ok).toMatchObject({
      attempt: 2,
      passed: true,
      courseCompleted: true,
    });
    const subs = await db.query.exerciseSubmissions.findMany({
      where: eq(schema.exerciseSubmissions.userId, user.id),
    });
    expect(subs.map((s) => s.passed)).toEqual([false, true]);
    expect(subs[1]?.files).toEqual({ "a.ts": "export const a = 1;" });
    const ex = await caller.assessments.getExercise({
      courseSlug: slug,
      lessonSlug: "ex",
    });
    expect(ex.lastSubmission?.passed).toBe(true);
    expect(ex.testFiles["a.test.ts"]).toContain("expect(a).toBe(1)");
  });

  it("rejects submissions without a session and quiz calls on non-quiz lessons", async () => {
    await expect(
      as(null).assessments.submitQuiz({
        courseSlug: slug,
        lessonSlug: "quiz",
        answers: [],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      as(null).assessments.getQuiz({ courseSlug: slug, lessonSlug: "ex" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("starts a fresh attempt series per quiz version and re-evaluates minQuizScore on a better retake", async () => {
    // The first learner used both attempts on version 3; a re-synced quiz resets the limit.
    await db
      .update(schema.quizzes)
      .set({ version: 4 })
      .where(eq(schema.quizzes.id, ids.quizId));
    const quiz = await as(user).assessments.getQuiz({
      courseSlug: slug,
      lessonSlug: "quiz",
    });
    expect(quiz.attemptsLeft).toBe(2);
    expect(quiz.attempts).toHaveLength(2);

    // A second learner: quiz passes at 30% but the course wants an average of 100.
    await db
      .update(schema.quizzes)
      .set({ passScore: 30 })
      .where(eq(schema.quizzes.id, ids.quizId));
    await db
      .update(schema.courses)
      .set({
        completionCriteria: {
          requireAllRequiredLessons: true,
          minQuizScore: 100,
        },
      })
      .where(eq(schema.courses.id, ids.courseId));
    const [other] = (await db
      .insert(schema.users)
      .values({ email: `assess2-${run}@devhelp.test`, name: "Assess 2" })
      .returning()) as [typeof user];
    try {
      const caller = as(other);
      const ex = await caller.assessments.submitExercise({
        courseSlug: slug,
        lessonSlug: "ex",
        files: { "a.ts": "export const a = 1;" },
        results: [{ name: "a", passed: true }],
        passed: true,
      });
      expect(ex.courseCompleted).toBe(false);
      const low = await caller.assessments.submitQuiz({
        courseSlug: slug,
        lessonSlug: "quiz",
        answers: [{ questionId: ids.q[2]!, value: "tracing" }],
      });
      // 1 of 4 points: the lesson completes, the course does not (average 25 < 100).
      expect(low).toMatchObject({ passed: false, courseCompleted: false });
      const lowPass = await caller.assessments.submitQuiz({
        courseSlug: slug,
        lessonSlug: "quiz",
        answers: [
          { questionId: ids.q[0]!, value: "a" },
          { questionId: ids.q[2]!, value: "tracing" },
        ],
      });
      expect(lowPass).toMatchObject({ passed: true, courseCompleted: false });
      await db
        .update(schema.quizzes)
        .set({ maxAttempts: 3 })
        .where(eq(schema.quizzes.id, ids.quizId));
      const full = await caller.assessments.submitQuiz({
        courseSlug: slug,
        lessonSlug: "quiz",
        answers: [
          { questionId: ids.q[0]!, value: "a" },
          { questionId: ids.q[1]!, value: ["a", "b"] },
          { questionId: ids.q[2]!, value: "tracing" },
        ],
      });
      // The lesson was already complete; the better score alone completes the course.
      expect(full).toMatchObject({ score: 100, courseCompleted: true });
      const enrolment = await db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.userId, other.id),
          eq(schema.enrollments.courseId, ids.courseId),
        ),
      });
      expect(enrolment?.status).toBe("completed");
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, other.id));
    }
  });
});
