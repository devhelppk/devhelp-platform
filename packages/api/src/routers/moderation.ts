import { and, desc, eq, inArray, lt, schema, sql } from "@repo/database";
import {
  auditChangeSchema,
  companyReviewRequestSchema,
  moderationPayloadSchema,
} from "@repo/database/schema";
import { env } from "@repo/env";
import { notify } from "@repo/notify";
import { TRPCError } from "@trpc/server";
import { createElement } from "react";
import { z } from "zod";
import {
  mentorProcedure,
  moderatorTracks,
  rateLimit,
  router,
  verifiedProcedure,
} from "../trpc";

const subjectType = z.enum(schema.moderationSubject.enumValues);
const status = z.enum(schema.moderationStatus.enumValues);
const track = z.enum(schema.courseTrack.enumValues);
const policyClause = z
  .string()
  .regex(/^c[0-9]{1,2}$/)
  .optional();

/** Items the caller may see: everything for admins, own tracks for mentors, never track-less items for mentors. */
function scope(tracks: ("technical" | "career")[] | null) {
  if (tracks === null) return undefined;
  if (tracks.length === 0) return sql`false`;
  return inArray(schema.moderationItems.track, tracks);
}

async function decidedNotification(
  item: typeof schema.moderationItems.$inferSelect,
  submitter: { id: string; name: string; email: string },
  approved: boolean,
  reason: string | undefined,
  clause: string | undefined,
) {
  // Templates pull in react-email; load them only when a decision is made.
  const { MentorApplicationDecided, ModerationDecided } =
    await import("@repo/email");
  const policyUrl = clause
    ? `${env.NEXT_PUBLIC_WEB_URL}/policy#${clause}`
    : undefined;
  if (item.subjectType === "mentor_application") {
    const href = approved ? "/moderate" : "/mentor/apply";
    return notify({
      userId: submitter.id,
      kind: "mentor_application_decided",
      title: approved
        ? "You are now a mentor"
        : "Your mentor application was not approved",
      body: approved
        ? "Thank you. The moderation queue for your tracks is open to you."
        : (reason ?? "See the application page for the reviewer's note."),
      href,
      subjectType: item.subjectType,
      subjectId: item.id,
      dedupeKey: `decided:${item.id}`,
      email: {
        to: submitter.email,
        subject: approved
          ? "You are a devhelp mentor"
          : "About your devhelp mentor application",
        react: createElement(MentorApplicationDecided, {
          name: submitter.name,
          approved,
          reason,
          policyUrl,
          url: `${env.NEXT_PUBLIC_LMS_URL}${href}`,
        }),
      },
    });
  }
  const label = "Your review request";
  return notify({
    userId: submitter.id,
    kind: "moderation_decided",
    title: approved ? `${label} was accepted` : `${label} was declined`,
    body: reason,
    href: "/notifications",
    subjectType: item.subjectType,
    subjectId: item.id,
    dedupeKey: `decided:${item.id}`,
    email: {
      to: submitter.email,
      subject: approved ? `${label} was accepted` : `${label} was declined`,
      react: createElement(ModerationDecided, {
        name: submitter.name,
        subject: label,
        approved,
        reason,
        policyUrl,
        url: `${env.NEXT_PUBLIC_LMS_URL}/notifications`,
      }),
    },
  });
}

export const moderationRouter = router({
  queue: mentorProcedure
    .input(
      z.object({
        status: status.default("pending"),
        subjectType: subjectType.optional(),
        track: track.optional(),
        cursor: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tracks = await moderatorTracks(ctx.db, ctx.user);
      const rows = await ctx.db.query.moderationItems.findMany({
        where: and(
          eq(schema.moderationItems.status, input.status),
          input.subjectType
            ? eq(schema.moderationItems.subjectType, input.subjectType)
            : undefined,
          input.track
            ? eq(schema.moderationItems.track, input.track)
            : undefined,
          input.cursor
            ? lt(schema.moderationItems.createdAt, input.cursor)
            : undefined,
          scope(tracks),
        ),
        orderBy: [desc(schema.moderationItems.createdAt)],
        limit: input.limit + 1,
        with: { submitter: { columns: { id: true, name: true } } },
        columns: {
          id: true,
          subjectType: true,
          subjectId: true,
          status: true,
          track: true,
          createdAt: true,
          decidedAt: true,
          reason: true,
          payload: true,
        },
      });
      const page = rows.slice(0, input.limit);
      return {
        items: page,
        nextCursor:
          rows.length > input.limit
            ? page[page.length - 1]?.createdAt
            : undefined,
        tracks,
      };
    }),

  counts: mentorProcedure.query(async ({ ctx }) => {
    const tracks = await moderatorTracks(ctx.db, ctx.user);
    const rows = await ctx.db
      .select({
        status: schema.moderationItems.status,
        n: sql<number>`count(*)::int`,
      })
      .from(schema.moderationItems)
      .where(scope(tracks))
      .groupBy(schema.moderationItems.status);
    return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
      Record<(typeof schema.moderationStatus.enumValues)[number], number>
    >;
  }),

  item: mentorProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const tracks = await moderatorTracks(ctx.db, ctx.user);
      const item = await ctx.db.query.moderationItems.findFirst({
        where: and(eq(schema.moderationItems.id, input.id), scope(tracks)),
        with: {
          submitter: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
          decider: { columns: { id: true, name: true } },
          actions: {
            orderBy: [desc(schema.moderationActions.createdAt)],
            with: { actor: { columns: { id: true, name: true } } },
          },
          flags: true,
        },
      });
      if (!item)
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      return item;
    }),

  /** Approve or reject in one transaction: item update + action row + subject side effects + notification. */
  decide: mentorProcedure
    .input(
      z.object({
        id: z.uuid(),
        action: z.enum(["approve", "reject", "hide", "unhide"]),
        reason: z.string().trim().max(1000).optional(),
        policyClause,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        (input.action === "reject" || input.action === "hide") &&
        !input.reason
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reason is required when rejecting or hiding.",
        });
      const tracks = await moderatorTracks(ctx.db, ctx.user);
      const result = await ctx.db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(schema.moderationItems)
          .where(and(eq(schema.moderationItems.id, input.id), scope(tracks)))
          .for("update");
        if (!item)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found.",
          });
        const next =
          input.action === "approve"
            ? "approved"
            : input.action === "reject"
              ? "rejected"
              : input.action === "hide"
                ? "hidden"
                : "approved";
        const allowed: Record<string, string[]> = {
          pending: ["approve", "reject"],
          approved: ["hide"],
          hidden: ["unhide"],
          rejected: [],
          merged: [],
        };
        if (!allowed[item.status]?.includes(input.action))
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot ${input.action} an item that is ${item.status}.`,
          });
        if (
          item.subjectType === "mentor_application" &&
          ctx.user.role !== "admin"
        )
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins decide mentor applications.",
          });
        const now = new Date();
        await tx
          .update(schema.moderationItems)
          .set({
            status: next,
            decidedBy: ctx.user.id,
            decidedAt: now,
            reason: input.reason ?? null,
            policyClause: input.policyClause ?? null,
            updatedAt: now,
          })
          .where(eq(schema.moderationItems.id, item.id));
        await tx.insert(schema.moderationActions).values({
          itemId: item.id,
          actorId: ctx.user.id,
          action: input.action,
          reason: input.reason ?? null,
          policyClause: input.policyClause ?? null,
          before: auditChangeSchema.parse({ status: item.status }),
          after: auditChangeSchema.parse({ status: next }),
        });
        // Subject side effects.
        const payload = moderationPayloadSchema.parse(item.payload);
        if (
          payload.kind === "mentor_application" &&
          input.action === "approve" &&
          item.submittedBy
        ) {
          await tx
            .update(schema.users)
            .set({ role: "mentor" })
            .where(eq(schema.users.id, item.submittedBy));
          await tx
            .insert(schema.mentorTracks)
            .values(
              payload.data.tracks.map((t) => ({
                userId: item.submittedBy!,
                track: t,
                grantedBy: ctx.user.id,
              })),
            )
            .onConflictDoNothing();
        }
        return { item, next };
      });
      // Notification after the commit; the item is the record, mail is best effort.
      if (
        result.item.submittedBy &&
        (input.action === "approve" || input.action === "reject")
      ) {
        try {
          const submitter = await ctx.db.query.users.findFirst({
            where: eq(schema.users.id, result.item.submittedBy),
            columns: { id: true, name: true, email: true },
          });
          if (submitter)
            await decidedNotification(
              result.item,
              submitter,
              input.action === "approve",
              input.reason,
              input.policyClause,
            );
        } catch (e) {
          console.error(
            `[moderation] notification for ${result.item.id} failed:`,
            e,
          );
        }
      }
      return { id: result.item.id, status: result.next };
    }),

  /** Readers flag published things (F4.5); one flag per reporter per subject, logged in the same transaction. */
  flag: verifiedProcedure
    .input(
      z.object({
        subjectType,
        subjectId: z.uuid(),
        reason: z.enum(schema.flagReason.enumValues),
        details: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.moderationItems.findFirst({
        where: and(
          eq(schema.moderationItems.subjectType, input.subjectType),
          eq(schema.moderationItems.subjectId, input.subjectId),
        ),
        columns: { id: true },
      });
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `flag:${ctx.user.id}`,
          20,
          24 * 3600,
          "You have flagged a lot today. Try again tomorrow.",
        );
        const [flag] = await tx
          .insert(schema.contentFlags)
          .values({
            ...input,
            reporterId: ctx.user.id,
            itemId: item?.id ?? null,
            details: input.details ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: schema.contentFlags.id });
        if (flag && item)
          await tx.insert(schema.moderationActions).values({
            itemId: item.id,
            actorId: ctx.user.id,
            action: "flag",
            reason: input.reason,
          });
        return { id: flag?.id ?? null, duplicate: !flag };
      });
    }),

  /** Open flags the caller may act on: admins all of them; mentors those on items in their tracks. */
  flags: mentorProcedure
    .input(
      z
        .object({
          status: z.enum(schema.flagStatus.enumValues).default("open"),
        })
        .default({ status: "open" }),
    )
    .query(async ({ ctx, input }) => {
      const tracks = await moderatorTracks(ctx.db, ctx.user);
      const inScope =
        tracks === null
          ? undefined
          : tracks.length === 0
            ? sql`false`
            : inArray(
                schema.contentFlags.itemId,
                ctx.db
                  .select({ id: schema.moderationItems.id })
                  .from(schema.moderationItems)
                  .where(inArray(schema.moderationItems.track, tracks)),
              );
      return ctx.db.query.contentFlags.findMany({
        where: and(eq(schema.contentFlags.status, input.status), inScope),
        orderBy: [desc(schema.contentFlags.createdAt)],
        with: {
          reporter: { columns: { id: true, name: true } },
          item: {
            columns: { id: true, subjectType: true, status: true, track: true },
          },
        },
        limit: 100,
      });
    }),

  /** Upholding a flag hides a visible item; dismissing closes the flag. One transaction, scoped like the queue. */
  resolveFlag: mentorProcedure
    .input(z.object({ id: z.uuid(), outcome: z.enum(["upheld", "dismissed"]) }))
    .mutation(async ({ ctx, input }) => {
      const tracks = await moderatorTracks(ctx.db, ctx.user);
      return ctx.db.transaction(async (tx) => {
        const flag = await tx.query.contentFlags.findFirst({
          where: and(
            eq(schema.contentFlags.id, input.id),
            eq(schema.contentFlags.status, "open"),
          ),
        });
        if (!flag)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Flag not found or already resolved.",
          });
        const [item] = flag.itemId
          ? await tx
              .select()
              .from(schema.moderationItems)
              .where(
                and(eq(schema.moderationItems.id, flag.itemId), scope(tracks)),
              )
              .for("update")
          : [];
        // A flag whose item the caller cannot see, or that has no item, is admin-only.
        if ((flag.itemId && !item) || (!flag.itemId && tracks !== null))
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Flag not found.",
          });
        const now = new Date();
        await tx
          .update(schema.contentFlags)
          .set({ status: input.outcome, resolvedAt: now })
          .where(eq(schema.contentFlags.id, flag.id));
        if (!item) return { ok: true, hidden: false };
        const hides = input.outcome === "upheld" && item.status === "approved";
        if (hides)
          await tx
            .update(schema.moderationItems)
            .set({
              status: "hidden",
              decidedBy: ctx.user.id,
              decidedAt: now,
              reason: `flag upheld: ${flag.reason}`,
              updatedAt: now,
            })
            .where(eq(schema.moderationItems.id, item.id));
        await tx.insert(schema.moderationActions).values({
          itemId: item.id,
          actorId: ctx.user.id,
          action: hides ? "hide" : "dismiss_flag",
          reason: `flag ${input.outcome}: ${flag.reason}`,
          before: hides ? { status: item.status } : null,
          after: hides ? { status: "hidden" } : null,
        });
        return { ok: true, hidden: hides };
      });
    }),

  /** F2.12: a company asks for a post to be reviewed. Admin-only subject; companies themselves arrive in S10. */
  requestReview: verifiedProcedure
    .input(companyReviewRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const subjectId = crypto.randomUUID();
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `review-request:${ctx.user.id}`,
          5,
          24 * 3600,
          "You have sent several review requests today. Try again tomorrow.",
        );
        const [item] = await tx
          .insert(schema.moderationItems)
          .values({
            subjectType: "company_review_request",
            subjectId,
            submittedBy: ctx.user.id,
            payload: { kind: "company_review_request", data: input },
          })
          .returning({ id: schema.moderationItems.id });
        await tx.insert(schema.moderationActions).values({
          itemId: item!.id,
          actorId: ctx.user.id,
          action: "request_review",
          after: { targetType: input.targetType, targetId: input.targetId },
        });
        return { id: item!.id };
      });
    }),
});
