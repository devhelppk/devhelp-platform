import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  schema,
  sql,
} from "@repo/database";
import { recomputeLessonAggregates } from "@repo/learning";
import { env } from "@repo/env";
import { notify } from "@repo/notify";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { announceComment } from "../comment-notify";
import { hasLink, renderMarkdown } from "../markdown";
import { subjectBySlugs } from "../subjects";
import {
  mentorProcedure,
  moderatorTracks,
  protectedProcedure,
  publicProcedure,
  rateLimit,
  router,
  verifiedProcedure,
} from "../trpc";

const subject = z.object({
  courseSlug: z.string().min(1),
  lessonSlug: z.string().min(1).optional(),
});
const body = z.string().trim().min(2).max(5000);
const NEW_ACCOUNT_DAYS = 7;

const authorColumns = { id: true, name: true, role: true } as const;
const publicColumns = {
  id: true,
  parentId: true,
  kind: true,
  body: true,
  bodyHtml: true,
  anchor: true,
  status: true,
  voteCount: true,
  replyCount: true,
  acceptedAt: true,
  editedAt: true,
  createdAt: true,
  authorId: true,
} as const;

function present<
  T extends {
    status: string;
    body: string;
    bodyHtml: string;
    authorId: string | null;
  },
>(c: T, viewerId: string | null) {
  // Hidden and deleted rows keep the thread shape; their text is replaced. The
  // Markdown source travels only to its author (for editing).
  const removed = c.status === "hidden" || c.status === "deleted";
  const mine = !!viewerId && c.authorId === viewerId;
  return {
    ...c,
    bodyHtml: removed ? "" : c.bodyHtml,
    body: mine && !removed ? c.body : "",
    removed,
    mine,
  };
}

/** Why a new comment is held for moderation, or null to publish at once (F4.5). */
async function holdReason(
  db: typeof import("@repo/database").db,
  user: { id: string; createdAt: Date },
  text: string,
) {
  if (hasLink(text)) {
    const ageDays =
      (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000;
    if (ageDays < NEW_ACCOUNT_DAYS)
      return `link from an account ${Math.max(1, Math.round(ageDays))} day(s) old`;
  }
  const recentHidden = await db.query.comments.findFirst({
    where: and(
      eq(schema.comments.authorId, user.id),
      eq(schema.comments.status, "hidden"),
      sql`${schema.comments.updatedAt} > now() - interval '30 days'`,
    ),
    columns: { id: true },
  });
  if (recentHidden) return "author had a comment hidden in the last 30 days";
  return null;
}

type Tx = Parameters<
  Parameters<typeof import("@repo/database").db.transaction>[0]
>[0];

/** `reply_count` from source, never by increment, so races with moderation cannot drift it. */
export async function recountReplies(tx: Tx, parentId: string) {
  await tx
    .update(schema.comments)
    .set({
      replyCount: sql`(select count(*)::int from ${schema.comments} r where r.parent_id = ${parentId} and r.status = 'visible')`,
    })
    .where(eq(schema.comments.id, parentId));
}

/** Slugs and titles for a comment's moderation snapshot. */
async function subjectOfComment(
  tx: Tx,
  c: { courseId: string; subjectType: "lesson" | "course"; subjectId: string },
) {
  const course = await tx.query.courses.findFirst({
    where: eq(schema.courses.id, c.courseId),
    columns: { slug: true, title: true, track: true },
  });
  const lesson =
    c.subjectType === "lesson"
      ? await tx.query.lessons.findFirst({
          where: eq(schema.lessons.id, c.subjectId),
          columns: { slug: true, title: true },
        })
      : null;
  if (!course)
    throw new TRPCError({ code: "NOT_FOUND", message: "Course not found." });
  return {
    subjectType: c.subjectType,
    subjectId: c.subjectId,
    courseSlug: course.slug,
    subjectSlug: lesson?.slug ?? course.slug,
    subjectTitle: lesson?.title ?? course.title,
    track: course.track,
  };
}

/** Discussions (F4.3 to F4.5): questions and notes with one level of replies, votes, accepted answers. */
export const commentsRouter = router({
  /** Visible comments plus the caller's own held ones; replies nested under their parent. */
  list: publicProcedure
    .input(
      subject.extend({
        sort: z.enum(["top", "new"]).default("top"),
        /** Keyset cursor: the last item's vote count and creation time. */
        cursor: z
          .object({ voteCount: z.number().int(), createdAt: z.date() })
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const s = await subjectBySlugs(ctx.db, input);
      const viewer = ctx.session?.user.id ?? null;
      const visibleOrMine = viewer
        ? or(
            inArray(schema.comments.status, ["visible", "hidden", "deleted"]),
            and(
              eq(schema.comments.status, "held"),
              eq(schema.comments.authorId, viewer),
            ),
          )
        : inArray(schema.comments.status, ["visible", "hidden", "deleted"]);
      const c = input.cursor;
      const after = !c
        ? undefined
        : input.sort === "top"
          ? or(
              lt(schema.comments.voteCount, c.voteCount),
              and(
                eq(schema.comments.voteCount, c.voteCount),
                lt(schema.comments.createdAt, c.createdAt),
              ),
            )
          : lt(schema.comments.createdAt, c.createdAt);
      const tops = await ctx.db.query.comments.findMany({
        where: and(
          eq(schema.comments.subjectType, s.subjectType),
          eq(schema.comments.subjectId, s.subjectId),
          isNull(schema.comments.parentId),
          visibleOrMine,
          after,
        ),
        orderBy:
          input.sort === "top"
            ? [desc(schema.comments.voteCount), desc(schema.comments.createdAt)]
            : [desc(schema.comments.createdAt)],
        limit: input.limit + 1,
        columns: publicColumns,
        with: { author: { columns: authorColumns } },
      });
      const page = tops.slice(0, input.limit);
      const replies = page.length
        ? await ctx.db.query.comments.findMany({
            where: and(
              inArray(
                schema.comments.parentId,
                page.map((t) => t.id),
              ),
              visibleOrMine,
            ),
            // Accepted answer first, then votes, then oldest first so a thread reads in order.
            orderBy: [
              sql`${schema.comments.acceptedAt} is null`,
              desc(schema.comments.voteCount),
              asc(schema.comments.createdAt),
            ],
            columns: publicColumns,
            with: { author: { columns: authorColumns } },
          })
        : [];
      const myVotes =
        viewer && (page.length || replies.length)
          ? new Set(
              (
                await ctx.db.query.commentVotes.findMany({
                  where: and(
                    eq(schema.commentVotes.userId, viewer),
                    inArray(
                      schema.commentVotes.commentId,
                      [...page, ...replies].map((x) => x.id),
                    ),
                  ),
                  columns: { commentId: true },
                })
              ).map((v) => v.commentId),
            )
          : new Set<string>();
      const watching =
        viewer && s.subjectType === "lesson"
          ? !!(await ctx.db.query.lessonWatchers.findFirst({
              where: and(
                eq(schema.lessonWatchers.userId, viewer),
                eq(schema.lessonWatchers.lessonId, s.subjectId),
              ),
            }))
          : false;
      // Role and verification from the table: the session copy lags a verify link or an approval by minutes.
      const me = viewer
        ? await ctx.db.query.users.findFirst({
            where: eq(schema.users.id, viewer),
            columns: { role: true, emailVerified: true },
          })
        : null;
      const tracks = me
        ? await moderatorTracks(ctx.db, { id: viewer!, role: me.role })
        : [];
      const canAccept = tracks === null || tracks.includes(s.course.track);
      const last = page[page.length - 1];
      return {
        items: page.map((t) => ({
          ...present(t, viewer),
          voted: myVotes.has(t.id),
          replies: replies
            .filter((r) => r.parentId === t.id)
            .map((r) => ({ ...present(r, viewer), voted: myVotes.has(r.id) })),
        })),
        nextCursor:
          tops.length > input.limit && last
            ? { voteCount: last.voteCount, createdAt: last.createdAt }
            : undefined,
        canAccept:
          !!me && canAccept && (me.role === "mentor" || me.role === "admin"),
        watching,
        signedIn: !!ctx.session,
        verified: !!me?.emailVerified,
      };
    }),

  /** Server-side preview so no Markdown library ships to the browser. */
  preview: protectedProcedure
    .input(z.object({ body }))
    .mutation(({ input }) => ({ html: renderMarkdown(input.body) })),

  create: verifiedProcedure
    .input(
      subject.extend({
        body,
        kind: z.enum(["question", "note"]).default("question"),
        parentId: z.uuid().optional(),
        anchor: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const s = await subjectBySlugs(ctx.db, input);
      const author = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
        columns: { id: true, name: true, createdAt: true },
      });
      if (!author) throw new TRPCError({ code: "UNAUTHORIZED" });
      const parent = input.parentId
        ? await ctx.db.query.comments.findFirst({
            where: and(
              eq(schema.comments.id, input.parentId),
              eq(schema.comments.subjectType, s.subjectType),
              eq(schema.comments.subjectId, s.subjectId),
            ),
            columns: {
              id: true,
              parentId: true,
              authorId: true,
              status: true,
              kind: true,
            },
          })
        : null;
      if (input.parentId && !parent)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That comment is gone.",
        });
      if (parent?.parentId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Replies go one level deep: reply to the question instead.",
        });
      if (parent && parent.status !== "visible")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You cannot reply to a removed comment.",
        });
      const reason = await holdReason(ctx.db, author, input.body);
      const html = renderMarkdown(input.body);
      const kind = parent ? "answer" : input.kind;
      const result = await ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `comment:${ctx.user.id}`,
          30,
          24 * 3600,
          "That is a lot of comments for one day. Try again tomorrow.",
        );
        if (!parent)
          await rateLimit(
            tx,
            `question:${ctx.user.id}`,
            10,
            24 * 3600,
            "You have opened many threads today. Reply to existing ones or try tomorrow.",
          );
        const [row] = await tx
          .insert(schema.comments)
          .values({
            subjectType: s.subjectType,
            subjectId: s.subjectId,
            courseId: s.course.id,
            parentId: parent?.id ?? null,
            authorId: ctx.user.id,
            kind,
            body: input.body,
            bodyHtml: html,
            anchor: input.anchor || null,
            status: reason ? "held" : "visible",
          })
          .returning({
            id: schema.comments.id,
            status: schema.comments.status,
          });
        if (parent && !reason)
          await tx
            .update(schema.comments)
            .set({ replyCount: sql`${schema.comments.replyCount} + 1` })
            .where(eq(schema.comments.id, parent.id));
        if (reason) {
          const [item] = await tx
            .insert(schema.moderationItems)
            .values({
              subjectType: "comment",
              subjectId: row!.id,
              track: s.course.track,
              submittedBy: ctx.user.id,
              payload: {
                kind: "comment",
                data: {
                  subjectType: s.subjectType,
                  subjectId: s.subjectId,
                  courseSlug: s.course.slug,
                  subjectSlug: s.subjectSlug,
                  subjectTitle: s.subjectTitle,
                  kind,
                  body: input.body,
                  anchor: input.anchor,
                  holdReason: reason,
                },
              },
            })
            .returning({ id: schema.moderationItems.id });
          await tx.insert(schema.moderationActions).values({
            itemId: item!.id,
            actorId: ctx.user.id,
            action: "submit",
            reason,
          });
        }
        if (s.subjectType === "lesson")
          await recomputeLessonAggregates(tx, s.subjectId);
        return row!;
      });
      // Notifications after the commit; best effort. Held comments are announced when approved.
      const href =
        s.subjectType === "lesson"
          ? `/courses/${s.course.slug}/${s.subjectSlug}#discussion`
          : `/courses/${s.course.slug}#discussion`;
      if (result.status === "held") {
        try {
          await notify({
            userId: ctx.user.id,
            kind: "comment_held",
            title: "Your comment is waiting for a moderator",
            body: `Held: ${reason}. It appears once approved.`,
            href,
            subjectType: "comment",
            subjectId: result.id,
            dedupeKey: `held:${result.id}`,
          });
        } catch (e) {
          console.error("[comments] notification failed:", e);
        }
      } else {
        await announceComment(ctx.db, result.id);
      }
      return { id: result.id, status: result.status };
    }),

  /** Re-renders, re-runs the hold check (a link added later is still a link from a new account), and refreshes any pending snapshot. */
  edit: verifiedProcedure
    .input(z.object({ id: z.uuid(), body }))
    .mutation(async ({ ctx, input }) => {
      const c = await ctx.db.query.comments.findFirst({
        where: and(
          eq(schema.comments.id, input.id),
          eq(schema.comments.authorId, ctx.user.id),
        ),
      });
      if (!c || c.status === "deleted")
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found.",
        });
      if (c.status === "hidden")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "A moderator removed this comment; it cannot be edited.",
        });
      const author = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
        columns: { id: true, createdAt: true },
      });
      if (!author) throw new TRPCError({ code: "UNAUTHORIZED" });
      const reason = await holdReason(ctx.db, author, input.body);
      const html = renderMarkdown(input.body);
      const status = await ctx.db.transaction(async (tx) => {
        const next = reason ? "held" : c.status === "held" ? "held" : "visible";
        const now = new Date();
        await tx
          .update(schema.comments)
          .set({
            body: input.body,
            bodyHtml: html,
            status: next,
            editedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.comments.id, c.id));
        const item = await tx.query.moderationItems.findFirst({
          where: and(
            eq(schema.moderationItems.subjectType, "comment"),
            eq(schema.moderationItems.subjectId, c.id),
          ),
        });
        if (next === "held") {
          const s = await subjectOfComment(tx, c);
          const { track: _track, ...subjectFields } = s;
          void _track;
          const payload = {
            kind: "comment" as const,
            data: {
              ...subjectFields,
              kind: c.kind,
              body: input.body,
              anchor: c.anchor ?? undefined,
              holdReason: reason ?? "edited while held",
            },
          };
          if (item && item.status === "pending") {
            await tx
              .update(schema.moderationItems)
              .set({ payload, updatedAt: now })
              .where(eq(schema.moderationItems.id, item.id));
            await tx.insert(schema.moderationActions).values({
              itemId: item.id,
              actorId: ctx.user.id,
              action: "edit",
              reason: "author edited while held",
            });
          } else if (item) {
            await tx
              .update(schema.moderationItems)
              .set({
                status: "pending",
                payload,
                decidedBy: null,
                decidedAt: null,
                updatedAt: now,
              })
              .where(eq(schema.moderationItems.id, item.id));
            await tx.insert(schema.moderationActions).values({
              itemId: item.id,
              actorId: ctx.user.id,
              action: "submit",
              reason,
            });
          } else {
            const [created] = await tx
              .insert(schema.moderationItems)
              .values({
                subjectType: "comment",
                subjectId: c.id,
                track: s.track,
                submittedBy: ctx.user.id,
                payload,
              })
              .returning({ id: schema.moderationItems.id });
            await tx.insert(schema.moderationActions).values({
              itemId: created!.id,
              actorId: ctx.user.id,
              action: "submit",
              reason,
            });
          }
        } else if (item && item.status === "approved") {
          await tx.insert(schema.moderationActions).values({
            itemId: item.id,
            actorId: ctx.user.id,
            action: "edit",
            reason: "author edited",
          });
        }
        if (c.parentId) await recountReplies(tx, c.parentId);
        if (c.subjectType === "lesson")
          await recomputeLessonAggregates(tx, c.subjectId);
        return next;
      });
      return { ok: true, status };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [c] = await tx
          .select({
            id: schema.comments.id,
            parentId: schema.comments.parentId,
            subjectType: schema.comments.subjectType,
            subjectId: schema.comments.subjectId,
          })
          .from(schema.comments)
          .where(
            and(
              eq(schema.comments.id, input.id),
              eq(schema.comments.authorId, ctx.user.id),
            ),
          )
          .for("update");
        if (!c)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Comment not found.",
          });
        await tx
          .update(schema.comments)
          .set({
            status: "deleted",
            body: "",
            bodyHtml: "",
            updatedAt: new Date(),
          })
          .where(eq(schema.comments.id, c.id));
        // A pending item for a deleted comment has nothing left to decide.
        const item = await tx.query.moderationItems.findFirst({
          where: and(
            eq(schema.moderationItems.subjectType, "comment"),
            eq(schema.moderationItems.subjectId, c.id),
            eq(schema.moderationItems.status, "pending"),
          ),
          columns: { id: true },
        });
        if (item) {
          await tx
            .update(schema.moderationItems)
            .set({
              status: "rejected",
              reason: "author deleted the comment",
              decidedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.moderationItems.id, item.id));
          await tx.insert(schema.moderationActions).values({
            itemId: item.id,
            actorId: ctx.user.id,
            action: "reject",
            reason: "author deleted the comment",
          });
        }
        if (c.parentId) await recountReplies(tx, c.parentId);
        if (c.subjectType === "lesson")
          await recomputeLessonAggregates(tx, c.subjectId);
      });
      return { ok: true };
    }),

  vote: protectedProcedure
    .input(z.object({ id: z.uuid(), on: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const c = await ctx.db.query.comments.findFirst({
        where: and(
          eq(schema.comments.id, input.id),
          eq(schema.comments.status, "visible"),
        ),
        columns: { id: true, authorId: true },
      });
      if (!c)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found.",
        });
      if (c.authorId === ctx.user.id)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot vote for your own comment.",
        });
      const voteCount = await ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `vote:${ctx.user.id}`,
          60,
          3600,
          "Slow down a little; try voting again in a few minutes.",
        );
        if (input.on) {
          const [v] = await tx
            .insert(schema.commentVotes)
            .values({ commentId: c.id, userId: ctx.user.id })
            .onConflictDoNothing()
            .returning({ commentId: schema.commentVotes.commentId });
          if (v)
            await tx
              .update(schema.comments)
              .set({ voteCount: sql`${schema.comments.voteCount} + 1` })
              .where(eq(schema.comments.id, c.id));
        } else {
          const [v] = await tx
            .delete(schema.commentVotes)
            .where(
              and(
                eq(schema.commentVotes.commentId, c.id),
                eq(schema.commentVotes.userId, ctx.user.id),
              ),
            )
            .returning({ commentId: schema.commentVotes.commentId });
          if (v)
            await tx
              .update(schema.comments)
              .set({
                voteCount: sql`greatest(${schema.comments.voteCount} - 1, 0)`,
              })
              .where(eq(schema.comments.id, c.id));
        }
        const [row] = await tx
          .select({ voteCount: schema.comments.voteCount })
          .from(schema.comments)
          .where(eq(schema.comments.id, c.id));
        return row?.voteCount ?? 0;
      });
      return { voteCount, voted: input.on };
    }),

  /** Mentors of the course's track (or admins) accept one reply per question; accepting again moves the mark. */
  accept: mentorProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const reply = await ctx.db.query.comments.findFirst({
        where: and(
          eq(schema.comments.id, input.id),
          eq(schema.comments.status, "visible"),
        ),
        columns: {
          id: true,
          parentId: true,
          courseId: true,
          authorId: true,
          subjectType: true,
          subjectId: true,
        },
      });
      if (!reply?.parentId)
        throw new TRPCError({ code: "NOT_FOUND", message: "Reply not found." });
      const tracks = await moderatorTracks(ctx.db, ctx.user);
      if (tracks !== null) {
        const course = await ctx.db.query.courses.findFirst({
          where: eq(schema.courses.id, reply.courseId),
          columns: { track: true },
        });
        if (!course || !tracks.includes(course.track))
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can accept answers in your tracks only.",
          });
      }
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.comments)
          .set({ acceptedAt: null, acceptedBy: null })
          .where(eq(schema.comments.parentId, reply.parentId!));
        await tx
          .update(schema.comments)
          .set({ acceptedAt: new Date(), acceptedBy: ctx.user.id })
          .where(eq(schema.comments.id, reply.id));
        if (reply.subjectType === "lesson")
          await recomputeLessonAggregates(tx, reply.subjectId);
      });
      if (reply.authorId && reply.authorId !== ctx.user.id) {
        try {
          const s = await ctx.db.query.courses.findFirst({
            where: eq(schema.courses.id, reply.courseId),
            columns: { slug: true, title: true },
          });
          const lesson =
            reply.subjectType === "lesson"
              ? await ctx.db.query.lessons.findFirst({
                  where: eq(schema.lessons.id, reply.subjectId),
                  columns: { slug: true, title: true },
                })
              : null;
          const author = await ctx.db.query.users.findFirst({
            where: eq(schema.users.id, reply.authorId),
            columns: { name: true, email: true },
          });
          const href = lesson
            ? `/courses/${s?.slug ?? ""}/${lesson.slug}#discussion`
            : `/courses/${s?.slug ?? ""}#discussion`;
          const { CommentAccepted } = await import("@repo/email");
          const { createElement } = await import("react");
          await notify({
            userId: reply.authorId,
            kind: "comment_accepted",
            title: "Your answer was accepted",
            body: `On ${lesson?.title ?? s?.title ?? "a lesson"}`,
            href,
            subjectType: "comment",
            subjectId: reply.id,
            dedupeKey: `accepted:${reply.id}`,
            email: author
              ? {
                  to: author.email,
                  subject: "Your answer was accepted on devhelp",
                  react: createElement(CommentAccepted, {
                    name: author.name,
                    subject: lesson?.title ?? s?.title ?? "a lesson",
                    url: `${env.NEXT_PUBLIC_LMS_URL}${href}`,
                  }),
                }
              : undefined,
          });
        } catch (e) {
          console.error("[comments] accept notification failed:", e);
        }
      }
      return { ok: true };
    }),

  watch: mentorProcedure
    .input(
      z.object({
        courseSlug: z.string().min(1),
        lessonSlug: z.string().min(1),
        on: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const s = await subjectBySlugs(ctx.db, input);
      if (input.on)
        await ctx.db
          .insert(schema.lessonWatchers)
          .values({ userId: ctx.user.id, lessonId: s.subjectId })
          .onConflictDoNothing();
      else
        await ctx.db
          .delete(schema.lessonWatchers)
          .where(
            and(
              eq(schema.lessonWatchers.userId, ctx.user.id),
              eq(schema.lessonWatchers.lessonId, s.subjectId),
            ),
          );
      return { watching: input.on };
    }),
});
