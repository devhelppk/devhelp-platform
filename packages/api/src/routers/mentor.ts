import { and, desc, eq, inArray, schema } from "@repo/database";
import { mentorApplicationSchema } from "@repo/database/schema";
import { TRPCError } from "@trpc/server";
import {
  protectedProcedure,
  rateLimit,
  router,
  verifiedProcedure,
} from "../trpc";

/** Mentor onboarding (F3.7): the first real subject of the moderation queue. */
export const mentorRouter = router({
  myApplication: protectedProcedure.query(async ({ ctx }) => {
    const item = await ctx.db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "mentor_application"),
        eq(schema.moderationItems.submittedBy, ctx.user.id),
      ),
      orderBy: [desc(schema.moderationItems.createdAt)],
      columns: {
        id: true,
        status: true,
        reason: true,
        policyClause: true,
        payload: true,
        createdAt: true,
        decidedAt: true,
      },
    });
    const tracks = await ctx.db.query.mentorTracks.findMany({
      where: eq(schema.mentorTracks.userId, ctx.user.id),
      columns: { track: true },
    });
    return {
      application: item ?? null,
      role: ctx.user.role ?? "student",
      mentorTracks: tracks.map((t) => t.track),
    };
  }),

  submitApplication: verifiedProcedure
    .input(mentorApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "mentor" || ctx.user.role === "admin")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You are already a mentor.",
        });
      const open = await ctx.db.query.moderationItems.findFirst({
        where: and(
          eq(schema.moderationItems.subjectType, "mentor_application"),
          eq(schema.moderationItems.submittedBy, ctx.user.id),
          inArray(schema.moderationItems.status, ["pending"]),
        ),
        columns: { id: true },
      });
      if (open)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Your application is already in the queue.",
        });
      // One application per 30 days (rejections included), so the queue is not a chat.
      await rateLimit(
        ctx.db,
        `mentor-apply:${ctx.user.id}`,
        1,
        30 * 24 * 3600,
        "You applied recently. You can apply again 30 days after your last application.",
      );
      const subjectId = crypto.randomUUID();
      const id = await ctx.db.transaction(async (tx) => {
        const [item] = await tx
          .insert(schema.moderationItems)
          .values({
            subjectType: "mentor_application",
            subjectId,
            submittedBy: ctx.user.id,
            payload: { kind: "mentor_application", data: input },
          })
          .returning({ id: schema.moderationItems.id });
        await tx.insert(schema.moderationActions).values({
          itemId: item!.id,
          actorId: ctx.user.id,
          action: "submit",
          after: { tracks: input.tracks, github: input.github },
        });
        return item!.id;
      });
      return { id, status: "pending" as const };
    }),
});
