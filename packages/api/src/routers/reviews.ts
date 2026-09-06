import { and, desc, eq, lt, schema } from "@repo/database";
import { recomputeCourseAggregates } from "@repo/learning";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { courseBySlug } from "../subjects";
import {
  protectedProcedure,
  publicProcedure,
  router,
  verifiedProcedure,
} from "../trpc";

const courseSlug = z.string().min(1);

/** Public course reviews (F4.2): one per learner, written at ≥ 50 percent progress, visible at once, flaggable. */
export const reviewsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        courseSlug,
        cursor: z.date().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx.db, input.courseSlug);
      const rows = await ctx.db.query.courseReviews.findMany({
        where: and(
          eq(schema.courseReviews.courseId, course.id),
          eq(schema.courseReviews.status, "visible"),
          input.cursor
            ? lt(schema.courseReviews.createdAt, input.cursor)
            : undefined,
        ),
        orderBy: [desc(schema.courseReviews.createdAt)],
        limit: input.limit + 1,
        columns: {
          id: true,
          rating: true,
          title: true,
          body: true,
          completedAtReview: true,
          createdAt: true,
          updatedAt: true,
        },
        with: { user: { columns: { id: true, name: true, city: true } } },
      });
      const page = rows.slice(0, input.limit);
      return {
        items: page,
        nextCursor:
          rows.length > input.limit
            ? page[page.length - 1]?.createdAt
            : undefined,
      };
    }),

  /** The caller's own review and whether they may write one (progress ≥ 50 percent). */
  mine: protectedProcedure
    .input(z.object({ courseSlug }))
    .query(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx.db, input.courseSlug);
      const [review, enrolment] = await Promise.all([
        ctx.db.query.courseReviews.findFirst({
          where: and(
            eq(schema.courseReviews.userId, ctx.user.id),
            eq(schema.courseReviews.courseId, course.id),
          ),
          columns: {
            id: true,
            rating: true,
            title: true,
            body: true,
            status: true,
            createdAt: true,
          },
        }),
        ctx.db.query.enrollments.findFirst({
          where: and(
            eq(schema.enrollments.userId, ctx.user.id),
            eq(schema.enrollments.courseId, course.id),
          ),
          columns: { progressPercent: true, status: true },
        }),
      ]);
      const progress =
        enrolment?.status === "completed"
          ? 100
          : (enrolment?.progressPercent ?? 0);
      // Verification from the table, not the session copy, so the form agrees with `submit`.
      const me = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
        columns: { emailVerified: true },
      });
      return {
        review: review ?? null,
        progress,
        canReview: progress >= 50,
        verified: !!me?.emailVerified,
      };
    }),

  submit: verifiedProcedure
    .input(
      z.object({
        courseSlug,
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().max(80).optional(),
        body: z.string().trim().min(20).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx.db, input.courseSlug);
      const enrolment = await ctx.db.query.enrollments.findFirst({
        where: and(
          eq(schema.enrollments.userId, ctx.user.id),
          eq(schema.enrollments.courseId, course.id),
        ),
        columns: { progressPercent: true, status: true },
      });
      const progress =
        enrolment?.status === "completed"
          ? 100
          : (enrolment?.progressPercent ?? 0);
      if (progress < 50)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Reviews open at 50 percent of the course.",
        });
      const id = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.courseReviews)
          .values({
            userId: ctx.user.id,
            courseId: course.id,
            rating: input.rating,
            title: input.title || null,
            body: input.body,
            progressAtReview: progress,
            completedAtReview: progress >= 100 ? 1 : 0,
          })
          .onConflictDoUpdate({
            target: [
              schema.courseReviews.userId,
              schema.courseReviews.courseId,
            ],
            set: {
              rating: input.rating,
              title: input.title || null,
              body: input.body,
              progressAtReview: progress,
              completedAtReview: progress >= 100 ? 1 : 0,
              // A moderator-hidden review stays hidden after an edit; only a decision changes that.
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.courseReviews.id });
        await recomputeCourseAggregates(tx, course.id);
        return row!.id;
      });
      return { id };
    }),

  remove: protectedProcedure
    .input(z.object({ courseSlug }))
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx.db, input.courseSlug);
      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(schema.courseReviews)
          .where(
            and(
              eq(schema.courseReviews.userId, ctx.user.id),
              eq(schema.courseReviews.courseId, course.id),
            ),
          );
        await recomputeCourseAggregates(tx, course.id);
      });
      return { ok: true };
    }),
});
