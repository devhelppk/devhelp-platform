import { and, eq, schema } from "@repo/database";
import { recomputeLessonAggregates } from "@repo/learning";
import { z } from "zod";
import { courseBySlug, lessonBySlug } from "../subjects";
import { protectedProcedure, router } from "../trpc";

const slugs = z.object({
  courseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
});
const tag = z.enum(schema.feedbackTag.enumValues);

/** Private lesson feedback (F4.1): one row per learner per lesson, editable, never shown to other learners. */
export const feedbackRouter = router({
  mine: protectedProcedure.input(slugs).query(async ({ ctx, input }) => {
    const course = await courseBySlug(ctx.db, input.courseSlug);
    const lesson = await lessonBySlug(ctx.db, course.id, input.lessonSlug);
    const row = await ctx.db.query.lessonFeedback.findFirst({
      where: and(
        eq(schema.lessonFeedback.userId, ctx.user.id),
        eq(schema.lessonFeedback.lessonId, lesson.id),
      ),
      columns: { rating: true, tags: true, text: true, updatedAt: true },
    });
    return row ?? null;
  }),

  rate: protectedProcedure
    .input(
      slugs.extend({
        rating: z.number().int().min(1).max(5),
        tags: z.array(tag).max(5).default([]),
        text: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await courseBySlug(ctx.db, input.courseSlug);
      const lesson = await lessonBySlug(ctx.db, course.id, input.lessonSlug);
      const tags = [...new Set(input.tags)];
      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(schema.lessonFeedback)
          .values({
            userId: ctx.user.id,
            lessonId: lesson.id,
            courseId: course.id,
            rating: input.rating,
            tags,
            text: input.text || null,
          })
          .onConflictDoUpdate({
            target: [
              schema.lessonFeedback.userId,
              schema.lessonFeedback.lessonId,
            ],
            set: {
              rating: input.rating,
              tags,
              text: input.text || null,
              updatedAt: new Date(),
            },
          });
        await recomputeLessonAggregates(tx, lesson.id);
      });
      return { rating: input.rating, tags };
    }),
});
