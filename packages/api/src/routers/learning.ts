import { and, asc, eq, isNull, schema } from "@repo/database";
import {
  enroll,
  enrolmentGeneration,
  lessonEventKey,
  recordEvent,
} from "@repo/learning";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const slug = z.string().min(1);

async function courseBySlug(
  ctx: { db: typeof import("@repo/database").db },
  courseSlug: string,
) {
  const course = await ctx.db.query.courses.findFirst({
    where: and(
      eq(schema.courses.slug, courseSlug),
      eq(schema.courses.isPublished, true),
      isNull(schema.courses.archivedAt),
    ),
    columns: { id: true, slug: true },
  });
  if (!course)
    throw new TRPCError({ code: "NOT_FOUND", message: "Course not found." });
  return course;
}

async function lessonBySlug(
  ctx: { db: typeof import("@repo/database").db },
  courseId: string,
  lessonSlug: string,
) {
  const lesson = await ctx.db.query.lessons.findFirst({
    where: and(
      eq(schema.lessons.courseId, courseId),
      eq(schema.lessons.slug, lessonSlug),
      isNull(schema.lessons.archivedAt),
    ),
    columns: { id: true, completionRule: true, type: true },
  });
  if (!lesson)
    throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found." });
  return lesson;
}

/** Ordered, live lessons of a course with the learner's progress status. */
async function courseProgress(
  ctx: { db: typeof import("@repo/database").db },
  userId: string | null,
  courseId: string,
) {
  const lessons = await ctx.db
    .select({
      id: schema.lessons.id,
      slug: schema.lessons.slug,
      title: schema.lessons.title,
      type: schema.lessons.type,
      isRequired: schema.lessons.isRequired,
      position: schema.lessons.position,
      moduleId: schema.lessons.moduleId,
    })
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.courseId, courseId),
        isNull(schema.lessons.archivedAt),
      ),
    )
    .orderBy(asc(schema.lessons.position));
  const progress = userId
    ? await ctx.db.query.lessonProgress.findMany({
        where: and(
          eq(schema.lessonProgress.userId, userId),
          eq(schema.lessonProgress.courseId, courseId),
        ),
        columns: {
          lessonId: true,
          status: true,
          progressPercent: true,
          lastPositionSeconds: true,
        },
      })
    : [];
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const enrollment = userId
    ? await ctx.db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.userId, userId),
          eq(schema.enrollments.courseId, courseId),
        ),
      })
    : null;
  return {
    enrollment: enrollment ?? null,
    lessons: lessons.map((l) => ({
      ...l,
      progress: byLesson.get(l.id) ?? null,
    })),
  };
}

function continueFrom<
  T extends { isRequired: boolean; progress: { status: string } | null },
>(lessons: T[]): T | null {
  const next = lessons.find(
    (l) => l.isRequired && l.progress?.status !== "completed",
  );
  return next ?? lessons[0] ?? null;
}

export const learningRouter = router({
  /** Progress for one course; works signed out (no progress) so pages can render for everyone. */
  myProgress: publicProcedure
    .input(z.object({ courseSlug: slug }))
    .query(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx, input.courseSlug);
      const state = await courseProgress(
        ctx,
        ctx.session?.user.id ?? null,
        course.id,
      );
      return {
        courseId: course.id,
        ...state,
        continue: continueFrom(state.lessons),
      };
    }),

  continue: publicProcedure
    .input(z.object({ courseSlug: slug }))
    .query(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx, input.courseSlug);
      const state = await courseProgress(
        ctx,
        ctx.session?.user.id ?? null,
        course.id,
      );
      return continueFrom(state.lessons);
    }),

  myEnrollments: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.enrollments.findMany({
      where: eq(schema.enrollments.userId, ctx.user.id),
      with: {
        course: {
          columns: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            track: true,
            level: true,
            estimatedHours: true,
            isPublished: true,
            archivedAt: true,
          },
        },
        lastLesson: { columns: { slug: true, title: true } },
      },
      orderBy: (e, { desc }) => [desc(e.updatedAt)],
    });
    // Dropped enrolments are history, not something to show on a dashboard.
    return rows.filter(
      (r) =>
        r.status !== "dropped" && r.course.isPublished && !r.course.archivedAt,
    );
  }),

  enroll: protectedProcedure
    .input(z.object({ courseSlug: slug }))
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx, input.courseSlug);
      return enroll(ctx.user.id, course.id);
    }),

  drop: protectedProcedure
    .input(z.object({ courseSlug: slug, nonce: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx, input.courseSlug);
      return recordEvent({
        userId: ctx.user.id,
        kind: "course_dropped",
        courseId: course.id,
        idempotencyKey: `course_dropped:${ctx.user.id}:${course.id}:${input.nonce}`,
      });
    }),

  lessonStarted: protectedProcedure
    .input(z.object({ courseSlug: slug, lessonSlug: slug }))
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx, input.courseSlug);
      const lesson = await lessonBySlug(ctx, course.id, input.lessonSlug);
      const gen = await enrolmentGeneration(ctx.db, ctx.user.id, course.id);
      return recordEvent({
        userId: ctx.user.id,
        kind: "lesson_started",
        lessonId: lesson.id,
        idempotencyKey: lessonEventKey(
          "lesson_started",
          ctx.user.id,
          lesson.id,
          gen,
        ),
      });
    }),

  lessonProgressed: protectedProcedure
    .input(
      z.object({
        courseSlug: slug,
        lessonSlug: slug,
        percent: z.number().int().min(0).max(100),
        positionSeconds: z.number().int().min(0).optional(),
        nonce: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx, input.courseSlug);
      const lesson = await lessonBySlug(ctx, course.id, input.lessonSlug);
      return recordEvent({
        userId: ctx.user.id,
        kind: "lesson_progressed",
        lessonId: lesson.id,
        payload: {
          percent: input.percent,
          positionSeconds: input.positionSeconds,
        },
        idempotencyKey: `lesson_progressed:${ctx.user.id}:${lesson.id}:${input.nonce}`,
      });
    }),

  /** Completes a `view`-rule lesson (article, video, link). Quiz/exercise rules complete via S4. */
  lessonCompleted: protectedProcedure
    .input(z.object({ courseSlug: slug, lessonSlug: slug }))
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx, input.courseSlug);
      const lesson = await lessonBySlug(ctx, course.id, input.lessonSlug);
      if (lesson.completionRule !== "view") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This lesson completes through its quiz or exercise.",
        });
      }
      const gen = await enrolmentGeneration(ctx.db, ctx.user.id, course.id);
      return recordEvent({
        userId: ctx.user.id,
        kind: "lesson_completed",
        lessonId: lesson.id,
        idempotencyKey: lessonEventKey(
          "lesson_completed",
          ctx.user.id,
          lesson.id,
          gen,
        ),
      });
    }),
});
