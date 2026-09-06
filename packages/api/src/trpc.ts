import { eq, schema, sql } from "@repo/database";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/** Requires a signed-in user; `ctx.user` is narrowed for the handler. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to continue.",
    });
  return next({
    ctx: { ...ctx, session: ctx.session, user: ctx.session.user },
  });
});

/**
 * Role and verification straight from the users table: the session cookie
 * caches its copy for five minutes and cannot see an approval or a verify link.
 */
async function freshUser(ctx: Context & { user: { id: string } }) {
  const row = await ctx.db.query.users.findFirst({
    where: eq(schema.users.id, ctx.user.id),
    columns: { role: true, emailVerified: true },
  });
  if (!row)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in again." });
  return { ...ctx.user, role: row.role, emailVerified: row.emailVerified };
}

/** Requires a verified email: contributing (reviews, questions, applications) needs it; learning never does. */
export const verifiedProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const user = await freshUser(ctx);
    if (!user.emailVerified)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Verify your email to continue.",
        cause: "EMAIL_UNVERIFIED",
      });
    return next({ ctx: { ...ctx, user } });
  },
);

/** Mentor or admin. Track scoping is the router's job (see `moderatorTracks`). */
export const mentorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await freshUser(ctx);
  if (user.role !== "mentor" && user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Mentors only." });
  return next({ ctx: { ...ctx, user } });
});

/** Tracks the caller may moderate: null means all (admin). */
export async function moderatorTracks(
  db: typeof import("@repo/database").db,
  user: { id: string; role?: string | null },
): Promise<("technical" | "career")[] | null> {
  if (user.role === "admin") return null;
  const rows = await db.query.mentorTracks.findMany({
    where: eq(schema.mentorTracks.userId, user.id),
    columns: { track: true },
  });
  return rows.map((r) => r.track);
}

type DbOrTx = Pick<typeof import("@repo/database").db, "insert">;

/**
 * Fixed-window counter in Postgres (no Redis; X9). Throws TOO_MANY_REQUESTS
 * once `max` events fall inside `windowSeconds` for the key. Call it inside
 * the transaction of the work it guards so a failed attempt is not counted.
 */
export async function rateLimit(
  db: DbOrTx,
  key: string,
  max: number,
  windowSeconds: number,
  message = "Too many requests. Try again later.",
) {
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case when ${schema.rateLimits.windowStartedAt} < now() - make_interval(secs => ${windowSeconds}) then 1 else ${schema.rateLimits.count} + 1 end`,
        windowStartedAt: sql`case when ${schema.rateLimits.windowStartedAt} < now() - make_interval(secs => ${windowSeconds}) then now() else ${schema.rateLimits.windowStartedAt} end`,
      },
    })
    .returning({ count: schema.rateLimits.count });
  if ((row?.count ?? 0) > max)
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
}
