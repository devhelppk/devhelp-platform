import { and, desc, eq, isNull, schema } from "@repo/database";
import { awardBadge } from "@repo/learning";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../trpc";

const badgeColumns = {
  id: true,
  slug: true,
  name: true,
  description: true,
  icon: true,
  rule: true,
} as const;

/** Badges (S8): the catalogue with the caller's earned state, and admin awards. */
export const badgesRouter = router({
  /** Every live badge; `earnedAt` is set for the caller. Works signed out (all locked). */
  catalogue: publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.query.badges.findMany({
      where: isNull(schema.badges.archivedAt),
      orderBy: [schema.badges.name],
      columns: badgeColumns,
    });
    const userId = ctx.session?.user.id;
    const mine = userId
      ? await ctx.db.query.userBadges.findMany({
          where: and(
            eq(schema.userBadges.userId, userId),
            isNull(schema.userBadges.revokedAt),
          ),
          columns: { badgeId: true, awardedAt: true },
        })
      : [];
    const byBadge = new Map(mine.map((m) => [m.badgeId, m.awardedAt]));
    return all.map((b) => ({ ...b, earnedAt: byBadge.get(b.id) ?? null }));
  }),

  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.userBadges.findMany({
      where: and(
        eq(schema.userBadges.userId, ctx.user.id),
        isNull(schema.userBadges.revokedAt),
      ),
      orderBy: [desc(schema.userBadges.awardedAt)],
      columns: { awardedAt: true, awardedBy: true },
      with: { badge: { columns: badgeColumns } },
    }),
  ),

  /** Manual award: recorded on the row with who and why (plan decision 7). */
  award: adminProcedure
    .input(
      z.object({
        userId: z.uuid(),
        badgeSlug: z.string().min(1),
        reason: z.string().trim().min(5).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const badge = await ctx.db.query.badges.findFirst({
        where: and(
          eq(schema.badges.slug, input.badgeSlug),
          isNull(schema.badges.archivedAt),
        ),
        columns: { id: true, name: true, description: true },
      });
      if (!badge)
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge not found." });
      const created = await ctx.db.transaction(async (tx) => {
        // A revoked award is restored by the same action, with the new reason.
        const existing = await tx.query.userBadges.findFirst({
          where: and(
            eq(schema.userBadges.userId, input.userId),
            eq(schema.userBadges.badgeId, badge.id),
          ),
          columns: { revokedAt: true },
        });
        if (existing) {
          if (!existing.revokedAt)
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Already awarded.",
            });
          await tx
            .update(schema.userBadges)
            .set({
              revokedAt: null,
              revokedReason: null,
              revokedBy: null,
              awardedBy: ctx.user.id,
              awardReason: input.reason,
              awardedAt: new Date(),
            })
            .where(
              and(
                eq(schema.userBadges.userId, input.userId),
                eq(schema.userBadges.badgeId, badge.id),
              ),
            );
          return true;
        }
        return awardBadge(tx, {
          userId: input.userId,
          badgeId: badge.id,
          awardedBy: ctx.user.id,
          awardReason: input.reason,
        });
      });
      if (created) {
        try {
          const { notify } = await import("@repo/notify");
          await notify({
            userId: input.userId,
            kind: "badge_awarded",
            title: `Badge earned: ${badge.name}`,
            body: badge.description,
            href: "/badges",
            subjectType: "badge",
            subjectId: badge.id,
            dedupeKey: `badge:${badge.id}`,
          });
        } catch (e) {
          console.error("[badges] award notification failed:", e);
        }
      }
      return { ok: true };
    }),

  revoke: adminProcedure
    .input(
      z.object({
        userId: z.uuid(),
        badgeSlug: z.string().min(1),
        reason: z.string().trim().min(5).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const badge = await ctx.db.query.badges.findFirst({
        where: eq(schema.badges.slug, input.badgeSlug),
        columns: { id: true },
      });
      if (!badge)
        throw new TRPCError({ code: "NOT_FOUND", message: "Badge not found." });
      const [row] = await ctx.db
        .update(schema.userBadges)
        .set({
          revokedAt: new Date(),
          revokedReason: input.reason,
          revokedBy: ctx.user.id,
        })
        .where(
          and(
            eq(schema.userBadges.userId, input.userId),
            eq(schema.userBadges.badgeId, badge.id),
            isNull(schema.userBadges.revokedAt),
          ),
        )
        .returning({ badgeId: schema.userBadges.badgeId });
      if (!row)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No award to revoke.",
        });
      return { ok: true };
    }),

  /** Recent awards with who did what, for the admin page. */
  adminList: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .default({ limit: 50 }),
    )
    .query(({ ctx, input }) =>
      ctx.db.query.userBadges.findMany({
        orderBy: [desc(schema.userBadges.awardedAt)],
        limit: input.limit,
        columns: {
          awardedAt: true,
          awardReason: true,
          revokedAt: true,
          revokedReason: true,
        },
        with: {
          badge: { columns: { slug: true, name: true, icon: true } },
          user: { columns: { id: true, name: true, email: true } },
          awarder: { columns: { name: true } },
        },
      }),
    ),
});
