import { auth } from "@repo/auth";
import { eq, schema } from "@repo/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, rateLimit, router } from "../trpc";

export const accountRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        city: true,
        image: true,
        createdAt: true,
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const tracks = await ctx.db.query.mentorTracks.findMany({
      where: eq(schema.mentorTracks.userId, ctx.user.id),
      columns: { track: true },
    });
    return { ...user, mentorTracks: tracks.map((t) => t.track) };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(80),
        city: z.string().trim().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await auth.api.updateUser({
        headers: ctx.headers,
        body: { name: input.name, city: input.city || undefined },
      });
      return { ok: true };
    }),

  /** Re-sends the verification link; once per 5 minutes per user. */
  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.emailVerified)
      return { sent: false, reason: "already_verified" as const };
    await rateLimit(
      ctx.db,
      `verify:${ctx.user.id}`,
      1,
      5 * 60,
      "A verification email was sent recently. Check your inbox, then try again in a few minutes.",
    );
    await auth.api.sendVerificationEmail({
      headers: ctx.headers,
      body: { email: ctx.user.email, callbackURL: "/account?verified=1" },
    });
    return { sent: true, reason: null };
  }),
});
