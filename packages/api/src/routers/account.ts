import { auth } from "@repo/auth";
import { and, eq, ne, schema, sql } from "@repo/database";
import { profileLinksSchema } from "@repo/database/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, rateLimit, router } from "../trpc";

/** Route names and words a profile handle must not shadow. */
const RESERVED_HANDLES = new Set([
  "admin",
  "api",
  "account",
  "courses",
  "paths",
  "verify",
  "u",
  "moderate",
  "mentor",
  "notifications",
  "sign-in",
  "sign-up",
  "devhelp",
  "support",
  "help",
  "policy",
  "about",
  "certificates",
  "settings",
  "me",
  "null",
  "undefined",
]);

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
        handle: true,
        profilePublic: true,
        bio: true,
        links: true,
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const tracks = await ctx.db.query.mentorTracks.findMany({
      where: eq(schema.mentorTracks.userId, ctx.user.id),
      columns: { track: true },
    });
    return {
      ...user,
      profilePublic: user.profilePublic ?? false,
      links: profileLinksSchema.safeParse(user.links ?? {}).data ?? {},
      mentorTracks: tracks.map((t) => t.track),
    };
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

  /** Public profile settings (X5): handle, opt-in switch, bio, links. */
  updatePublicProfile: protectedProcedure
    .input(
      z.object({
        handle: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/,
            "3 to 30 lowercase letters, digits, or hyphens",
          )
          .refine((h) => !RESERVED_HANDLES.has(h), "That handle is reserved")
          .optional(),
        profilePublic: z.boolean(),
        bio: z.string().trim().max(280).optional(),
        links: profileLinksSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.profilePublic && !input.handle)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick a handle before making your profile public.",
        });
      if (input.handle) {
        const taken = await ctx.db.query.users.findFirst({
          where: and(
            sql`lower(${schema.users.handle}) = ${input.handle}`,
            ne(schema.users.id, ctx.user.id),
          ),
          columns: { id: true },
        });
        if (taken)
          throw new TRPCError({
            code: "CONFLICT",
            message: "That handle is taken.",
          });
      }
      try {
        await ctx.db
          .update(schema.users)
          .set({
            handle: input.handle ?? null,
            profilePublic: input.profilePublic,
            bio: input.bio || null,
            links: input.links ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, ctx.user.id));
      } catch (e) {
        // users_handle_lower_uidx (migration 0011) is the real guarantee; the
        // check above only gives a nicer message when there is no race.
        // Drizzle wraps the driver error, so the Postgres code is on `cause`.
        const code =
          (e as { code?: string }).code ??
          (e as { cause?: { code?: string } }).cause?.code;
        if (code === "23505")
          throw new TRPCError({
            code: "CONFLICT",
            message: "That handle is taken.",
          });
        throw e;
      }
      return {
        handle: input.handle ?? null,
        profilePublic: input.profilePublic,
      };
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
