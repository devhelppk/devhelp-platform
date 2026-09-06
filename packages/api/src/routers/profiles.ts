import { and, desc, eq, isNull, schema, sql } from "@repo/database";
import { profileLinksSchema } from "@repo/database/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

/** Public profile by handle (X5): 404 unless the learner opted in. */
export const profilesRouter = router({
  byHandle: publicProcedure
    .input(z.object({ handle: z.string().min(1).max(30) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: and(
          sql`lower(${schema.users.handle}) = ${input.handle.toLowerCase()}`,
          eq(schema.users.profilePublic, true),
        ),
        columns: {
          id: true,
          name: true,
          city: true,
          image: true,
          bio: true,
          links: true,
          handle: true,
          createdAt: true,
          role: true,
        },
      });
      if (!user)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Profile not found.",
        });
      const certificates = await ctx.db.query.certificates.findMany({
        where: and(
          eq(schema.certificates.userId, user.id),
          isNull(schema.certificates.revokedAt),
        ),
        orderBy: [desc(schema.certificates.issuedAt)],
        columns: {
          id: true,
          courseTitle: true,
          issuedAt: true,
          learnerName: true,
        },
        with: { course: { columns: { slug: true } } },
      });
      const links = profileLinksSchema.safeParse(user.links ?? {}).data ?? {};
      // The internal user id never leaves the server on a public route.
      const { id: _id, ...profile } = user;
      void _id;
      return { ...profile, links, certificates };
    }),
});
