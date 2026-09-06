import { and, desc, eq, isNull, lt, schema } from "@repo/database";
import { unreadCount } from "@repo/notify";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

export const notificationsRouter = router({
  unreadCount: protectedProcedure.query(({ ctx }) => unreadCount(ctx.user.id)),

  list: protectedProcedure
    .input(
      z
        .object({
          cursor: z.date().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .default({ limit: 50 }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.notifications.findMany({
        where: and(
          eq(schema.notifications.userId, ctx.user.id),
          input.cursor
            ? lt(schema.notifications.createdAt, input.cursor)
            : undefined,
        ),
        orderBy: [desc(schema.notifications.createdAt)],
        limit: input.limit + 1,
        columns: {
          id: true,
          kind: true,
          title: true,
          body: true,
          href: true,
          readAt: true,
          createdAt: true,
        },
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

  markRead: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(schema.notifications.id, input.id),
            eq(schema.notifications.userId, ctx.user.id),
            isNull(schema.notifications.readAt),
          ),
        );
      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const rows = await ctx.db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, ctx.user.id),
          isNull(schema.notifications.readAt),
        ),
      )
      .returning({ id: schema.notifications.id });
    return { marked: rows.length };
  }),
});
