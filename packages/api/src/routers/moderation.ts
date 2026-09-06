import { and, desc, eq, inArray, lt, schema, sql } from "@repo/database";
import {
  auditChangeSchema,
  companyReviewRequestSchema,
  moderationPayloadSchema,
} from "@repo/database/schema";
import { env } from "@repo/env";
import { notify } from "@repo/notify";
import { announceComment } from "../comment-notify";
import { recountReplies } from "./comments";
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

/** Company items never carry a course track, so mentors never see them. */
export const COMPANY_SUBJECTS: string[] = [
  "company_proposal",
  "company_review",
  "interview_experience",
  "salary_point",
];

type Tx = Parameters<
  Parameters<typeof import("@repo/database").db.transaction>[0]
>[0];

/**
 * What a moderation decision does to the thing itself (S6 subjects). Runs in
 * the deciding transaction; mentor applications are handled inline in `decide`.
 */
async function applySubjectStatus(
  tx: Tx,
  item: { subjectType: string; subjectId: string },
  visible: boolean,
  action?: "approve" | "reject" | "hide" | "unhide",
  actorId?: string,
): Promise<{ announceCommentId?: string }> {
  const now = new Date();
  // Company subjects (S10a). A proposal's subject is the organisation itself;
  // a review or an interview is its own row. Rejected and hidden are kept
  // apart so a contributor can tell "we said no" from "a moderator pulled it".
  if (item.subjectType === "company_proposal") {
    await tx
      .update(schema.companyProfiles)
      .set({
        status: visible ? "published" : "hidden",
        // Approving is a check of the facts, so it records who and when.
        // Hiding is a visibility decision and leaves that record alone.
        ...(visible ? { verifiedAt: now, verifiedBy: actorId } : {}),
        updatedAt: now,
      })
      .where(eq(schema.companyProfiles.organizationId, item.subjectId));
    return {};
  }
  // A salary point is already public when it reaches the queue (S10b), so
  // approving it means "checked", not "publish". Hiding still hides.
  if (item.subjectType === "salary_point") {
    await tx
      .update(schema.salaryPoints)
      .set({
        status: visible
          ? "published"
          : action === "reject"
            ? "rejected"
            : "hidden",
        ...(visible ? { verifiedAt: now, verifiedBy: actorId } : {}),
        updatedAt: now,
      })
      .where(eq(schema.salaryPoints.id, item.subjectId));
    return {};
  }
  if (
    item.subjectType === "company_review" ||
    item.subjectType === "interview_experience"
  ) {
    const table =
      item.subjectType === "company_review"
        ? schema.companyReviews
        : schema.interviewExperiences;
    await tx
      .update(table)
      .set({
        status: visible
          ? "published"
          : action === "reject"
            ? "rejected"
            : "hidden",
        updatedAt: now,
      })
      .where(eq(table.id, item.subjectId));
    return {};
  }
  if (item.subjectType === "comment") {
    const current = await tx.query.comments.findFirst({
      where: eq(schema.comments.id, item.subjectId),
      columns: { status: true },
    });
    // An author-deleted comment stays deleted whatever the item decides.
    if (!current || current.status === "deleted") return {};
    const [c] = await tx
      .update(schema.comments)
      .set({ status: visible ? "visible" : "hidden", updatedAt: now })
      .where(eq(schema.comments.id, item.subjectId))
      .returning({
        parentId: schema.comments.parentId,
        subjectType: schema.comments.subjectType,
        subjectId: schema.comments.subjectId,
      });
    if (c?.parentId) await recountReplies(tx, c.parentId);
    if (c?.subjectType === "lesson") {
      const { recomputeLessonAggregates } = await import("@repo/learning");
      await recomputeLessonAggregates(tx, c.subjectId);
    }
    return visible && current.status !== "visible"
      ? { announceCommentId: item.subjectId }
      : {};
  }
  if (item.subjectType === "course_review") {
    const [r] = await tx
      .update(schema.courseReviews)
      .set({ status: visible ? "visible" : "hidden", updatedAt: now })
      .where(eq(schema.courseReviews.id, item.subjectId))
      .returning({ courseId: schema.courseReviews.courseId });
    if (r) {
      const { recomputeCourseAggregates } = await import("@repo/learning");
      await recomputeCourseAggregates(tx, r.courseId);
    }
  }
  return {};
}

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
  const payload = moderationPayloadSchema.safeParse(item.payload).data;
  const subjectLabel =
    item.subjectType === "comment"
      ? "Your comment"
      : item.subjectType === "course_review"
        ? "Your course review"
        : item.subjectType === "company_proposal"
          ? "The company you proposed"
          : item.subjectType === "company_review"
            ? "Your company review"
            : item.subjectType === "interview_experience"
              ? "Your interview experience"
              : item.subjectType === "salary_point"
                ? "Your salary point"
                : "Your review request";
  const href =
    payload?.kind === "comment"
      ? payload.data.subjectType === "lesson"
        ? `/courses/${payload.data.courseSlug}/${payload.data.subjectSlug}#discussion`
        : `/courses/${payload.data.courseSlug}#discussion`
      : payload?.kind === "course_review"
        ? `/courses/${payload.data.courseSlug}`
        : payload?.kind === "company_contribution" ||
            payload?.kind === "salary_point"
          ? `/companies/${payload.data.companySlug}`
          : "/notifications";
  const verb = approved
    ? item.subjectType === "company_review_request"
      ? "was accepted"
      : "is published"
    : approved === false && item.subjectType === "company_review_request"
      ? "was declined"
      : "was not published";
  return notify({
    userId: submitter.id,
    kind: "moderation_decided",
    title: `${subjectLabel} ${verb}`,
    body: reason,
    href,
    subjectType: item.subjectType,
    subjectId: item.id,
    dedupeKey: `decided:${item.id}`,
    email: {
      to: submitter.email,
      subject: `${subjectLabel} ${verb} on devhelp`,
      react: createElement(ModerationDecided, {
        name: submitter.name,
        subject: subjectLabel,
        approved,
        reason,
        policyUrl,
        url: `${env.NEXT_PUBLIC_LMS_URL}${href}`,
      }),
    },
  });
}

/** Snapshot of a live comment or review for a flag-created item. */
async function snapshotSubject(
  db: typeof import("@repo/database").db,
  subjectType: "comment" | "course_review",
  subjectId: string,
) {
  if (subjectType === "comment") {
    const c = await db.query.comments.findFirst({
      where: eq(schema.comments.id, subjectId),
    });
    if (!c || c.status !== "visible") return null;
    const course = await db.query.courses.findFirst({
      where: eq(schema.courses.id, c.courseId),
      columns: { slug: true, title: true, track: true },
    });
    if (!course) return null;
    const lesson =
      c.subjectType === "lesson"
        ? await db.query.lessons.findFirst({
            where: eq(schema.lessons.id, c.subjectId),
            columns: { slug: true, title: true },
          })
        : null;
    return {
      track: course.track,
      authorId: c.authorId,
      payload: {
        kind: "comment" as const,
        data: {
          subjectType: c.subjectType,
          subjectId: c.subjectId,
          courseSlug: course.slug,
          subjectSlug: lesson?.slug ?? course.slug,
          subjectTitle: lesson?.title ?? course.title,
          kind: c.kind,
          body: c.body,
          anchor: c.anchor ?? undefined,
          holdReason: "flagged by a reader",
        },
      },
    };
  }
  const r = await db.query.courseReviews.findFirst({
    where: eq(schema.courseReviews.id, subjectId),
    with: { course: { columns: { slug: true, title: true, track: true } } },
  });
  if (!r || r.status !== "visible") return null;
  return {
    track: r.course.track,
    authorId: r.userId,
    payload: {
      kind: "course_review" as const,
      data: {
        courseSlug: r.course.slug,
        courseTitle: r.course.title,
        rating: r.rating,
        title: r.title ?? undefined,
        body: r.body,
      },
    },
  };
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
          // A salary point is public from the moment it is sent (S10b), so a
          // pending one can be hidden as well as rejected: the queue item is a
          // review task, not the thing standing between it and the page.
          pending:
            item.subjectType === "salary_point"
              ? ["approve", "reject", "hide"]
              : ["approve", "reject"],
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
        // Company facts and the contributions attached to them are admin-only
        // (founder decision, S10a): they are about named employers, and a
        // wrong call is a reputational problem, not a tidiness one.
        if (
          COMPANY_SUBJECTS.includes(item.subjectType) &&
          ctx.user.role !== "admin"
        )
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins decide company items.",
          });
        // A certificate is revoked and restored through `certificates.revoke`
        // / `.restore` (admin only), which own the row; the queue item is the
        // audit trail, not a second control.
        if (item.subjectType === "certificate")
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Certificates are revoked and restored from the certificates admin page.",
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
        let announceCommentId: string | undefined;
        if (input.action !== "reject" || item.status === "pending")
          ({ announceCommentId } = await applySubjectStatus(
            tx,
            item,
            next === "approved",
            input.action,
            ctx.user.id,
          ));
        return { item, next, announceCommentId };
      });
      if (result.announceCommentId)
        await announceComment(ctx.db, result.announceCommentId);
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
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `flag:${ctx.user.id}`,
          20,
          24 * 3600,
          "You have flagged a lot today. Try again tomorrow.",
        );
        let item = await tx.query.moderationItems.findFirst({
          where: and(
            eq(schema.moderationItems.subjectType, input.subjectType),
            eq(schema.moderationItems.subjectId, input.subjectId),
          ),
          columns: { id: true },
        });
        // Comments and reviews publish without an item; the first flag creates one so a moderator can act on it.
        if (
          !item &&
          (input.subjectType === "comment" ||
            input.subjectType === "course_review")
        ) {
          const snapshot = await snapshotSubject(
            tx as unknown as typeof ctx.db,
            input.subjectType,
            input.subjectId,
          );
          if (!snapshot)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Nothing to flag.",
            });
          const [created] = await tx
            .insert(schema.moderationItems)
            .values({
              subjectType: input.subjectType,
              subjectId: input.subjectId,
              status: "approved",
              track: snapshot.track,
              submittedBy: snapshot.authorId,
              payload: snapshot.payload,
            })
            .onConflictDoNothing()
            .returning({ id: schema.moderationItems.id });
          item =
            created ??
            (await tx.query.moderationItems.findFirst({
              where: and(
                eq(schema.moderationItems.subjectType, input.subjectType),
                eq(schema.moderationItems.subjectId, input.subjectId),
              ),
              columns: { id: true },
            }));
        }
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
        if (hides) await applySubjectStatus(tx, item, false);
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
