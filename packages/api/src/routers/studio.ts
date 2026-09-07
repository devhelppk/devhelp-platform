import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  schema,
  sql,
} from "@repo/database";
import { metadataChangesSchema } from "@repo/database/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { mentorProcedure, publicProcedure, router } from "../trpc";

const { contentCredits, contentEdits, courses, lessons, modules, users } =
  schema;

type Tx = Parameters<
  Parameters<typeof import("@repo/database").db.transaction>[0]
>[0];

/**
 * The studio (S11). The content repo owns what a lesson is; this owns how it is
 * described. Every change here is recorded, because it changes what learners
 * see and a person made it.
 */

const TRAIL_MAX = 2000;
const clip = (v: string | null) =>
  v !== null && v.length > TRAIL_MAX ? `${v.slice(0, TRAIL_MAX - 1)}…` : v;

/** Turn a before/after pair into the trail, skipping fields nobody touched. */
function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { field: string; before: string | null; after: string | null }[] {
  const out = [];
  for (const [field, next] of Object.entries(after)) {
    if (next === undefined) continue;
    const prev = before[field];
    const a = prev === null || prev === undefined ? null : String(prev);
    const b = next === null ? null : String(next);
    // The trail is for a person to read, not for replaying, and a description
    // can be longer than a trail entry may hold. Compare in full, store a
    // readable head: without this a long description aborted the whole save.
    if (a !== b) out.push({ field, before: clip(a), after: clip(b) });
  }
  return out;
}

async function recordEdit(
  tx: Tx,
  subjectType: "course" | "module" | "lesson",
  subjectId: string,
  actorId: string,
  changes: ReturnType<typeof diff>,
) {
  if (!changes.length) return;
  await tx.insert(contentEdits).values({
    subjectType,
    subjectId,
    actorId,
    changes: metadataChangesSchema.parse(changes),
  });
}

const creditColumns = {
  id: contentCredits.id,
  role: contentCredits.role,
  position: contentCredits.position,
  userId: users.id,
  name: users.name,
  // A credit is public attribution the editor chose, so the name is shown —
  // but a handle belongs to a profile, and `/u/<handle>` 404s for anyone who
  // has not made theirs public.
  handle: users.handle,
  profilePublic: users.profilePublic,
  image: users.image,
} as const;

/** Credits for one subject, ordered as an editor arranged them. */
async function creditsFor(
  db: typeof import("@repo/database").db,
  subjectType: "course" | "module" | "lesson",
  subjectId: string,
) {
  return db
    .select(creditColumns)
    .from(contentCredits)
    .innerJoin(users, eq(users.id, contentCredits.userId))
    .where(
      and(
        eq(contentCredits.subjectType, subjectType),
        eq(contentCredits.subjectId, subjectId),
      ),
    )
    .orderBy(asc(contentCredits.role), asc(contentCredits.position));
}

export const studioRouter = router({
  /** The studio home: what needs describing, and what the signals flag. */
  overview: mentorProcedure.query(async ({ ctx }) => {
    const [needsMetadata, paths, flagged, recent] = await Promise.all([
      ctx.db
        .select({
          id: courses.id,
          slug: courses.slug,
          title: courses.title,
          isPublished: courses.isPublished,
        })
        .from(courses)
        .where(and(eq(courses.needsMetadata, true), isNull(courses.archivedAt)))
        .orderBy(asc(courses.slug)),
      ctx.db
        .select({
          id: schema.paths.id,
          slug: schema.paths.slug,
          title: schema.paths.title,
          isPublished: schema.paths.isPublished,
          needsMetadata: schema.paths.needsMetadata,
        })
        .from(schema.paths)
        .where(isNull(schema.paths.archivedAt))
        .orderBy(asc(schema.paths.position), asc(schema.paths.slug)),
      // The signals S6 has been collecting and nobody has been reading.
      ctx.db
        .select({
          id: lessons.id,
          slug: lessons.slug,
          title: lessons.title,
          courseSlug: courses.slug,
          courseTitle: courses.title,
          ratingAvg: lessons.ratingAvg,
          ratingCount: lessons.ratingCount,
          unclearCount: lessons.unclearCount,
          openQuestionCount: lessons.openQuestionCount,
          needsMetadata: lessons.needsMetadata,
        })
        .from(lessons)
        .innerJoin(courses, eq(courses.id, lessons.courseId))
        .where(
          and(
            isNull(lessons.archivedAt),
            or(
              lessons.needsMetadata,
              sql`${lessons.ratingCount} >= 3 and ${lessons.ratingAvg} < 3.5`,
              sql`${lessons.unclearCount} >= 3`,
              sql`${lessons.openQuestionCount} >= 1`,
            ),
          ),
        )
        .orderBy(
          desc(lessons.unclearCount),
          desc(lessons.openQuestionCount),
          asc(lessons.ratingAvg),
        )
        .limit(50),
      ctx.db
        .select({
          id: contentEdits.id,
          subjectType: contentEdits.subjectType,
          subjectId: contentEdits.subjectId,
          changes: contentEdits.changes,
          createdAt: contentEdits.createdAt,
          actorName: users.name,
        })
        .from(contentEdits)
        .leftJoin(users, eq(users.id, contentEdits.actorId))
        .orderBy(desc(contentEdits.createdAt))
        .limit(10),
    ]);
    return { needsMetadata, paths, flagged, recent };
  }),

  /** One course, with its modules, lessons, credits, and recent edits. */
  course: mentorProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.db.query.courses.findFirst({
        where: eq(courses.slug, input.slug),
      });
      if (!course)
        throw new TRPCError({ code: "NOT_FOUND", message: "No such course." });
      const [mods, ls, credits, edits] = await Promise.all([
        ctx.db.query.modules.findMany({
          where: eq(modules.courseId, course.id),
          orderBy: [asc(modules.position)],
        }),
        ctx.db.query.lessons.findMany({
          where: and(
            eq(lessons.courseId, course.id),
            isNull(lessons.archivedAt),
          ),
          orderBy: [asc(lessons.position)],
        }),
        creditsFor(ctx.db, "course", course.id),
        ctx.db
          .select({
            id: contentEdits.id,
            changes: contentEdits.changes,
            createdAt: contentEdits.createdAt,
            actorName: users.name,
          })
          .from(contentEdits)
          .leftJoin(users, eq(users.id, contentEdits.actorId))
          .where(
            and(
              eq(contentEdits.subjectType, "course"),
              eq(contentEdits.subjectId, course.id),
            ),
          )
          .orderBy(desc(contentEdits.createdAt))
          .limit(10),
      ]);
      return { course, modules: mods, lessons: ls, credits, edits };
    }),

  /** One lesson's metadata, credits, and trail. */
  lesson: mentorProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const lesson = await ctx.db.query.lessons.findFirst({
        where: eq(lessons.id, input.id),
        with: { course: { columns: { slug: true, title: true } } },
      });
      if (!lesson)
        throw new TRPCError({ code: "NOT_FOUND", message: "No such lesson." });
      const [credits, edits] = await Promise.all([
        creditsFor(ctx.db, "lesson", lesson.id),
        ctx.db
          .select({
            id: contentEdits.id,
            changes: contentEdits.changes,
            createdAt: contentEdits.createdAt,
            actorName: users.name,
          })
          .from(contentEdits)
          .leftJoin(users, eq(users.id, contentEdits.actorId))
          .where(
            and(
              eq(contentEdits.subjectType, "lesson"),
              eq(contentEdits.subjectId, lesson.id),
            ),
          )
          .orderBy(desc(contentEdits.createdAt))
          .limit(10),
      ]);
      return { lesson, credits, edits };
    }),

  updateCourse: mentorProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        title: z.string().trim().min(3).max(80).optional(),
        summary: z.string().trim().min(20).max(200).optional(),
        description: z.string().trim().max(4000).nullish(),
        track: z.enum(schema.courseTrack.enumValues).optional(),
        level: z.enum(schema.courseLevel.enumValues).optional(),
        estimatedHours: z.number().int().positive().max(500).nullish(),
        coverImageUrl: z.url({ protocol: /^https?$/ }).nullish(),
        isPublished: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { slug, ...fields } = input;
      return ctx.db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(courses)
          .where(eq(courses.slug, slug))
          .for("update");
        if (!before)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No such course.",
          });
        const after = { ...before, ...fields };
        // A course cannot be published while it is still the sync's
        // placeholder. The summary is the reliable signal that a person has
        // been here: the sync seeds it empty and never writes it again. The
        // title is not, because a mentor may legitimately keep the slug's
        // wording, and blocking them for that would be baffling.
        const described = !!after.title?.trim() && !!after.summary?.trim();
        if (fields.isPublished && !described)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Give the course a title and summary before publishing it.",
          });
        const changes = diff(before, fields);
        await tx
          .update(courses)
          .set({
            ...fields,
            needsMetadata: described ? false : before.needsMetadata,
            publishedAt:
              fields.isPublished && !before.publishedAt
                ? new Date()
                : before.publishedAt,
            updatedAt: new Date(),
          })
          .where(eq(courses.id, before.id));
        await recordEdit(tx, "course", before.id, ctx.user.id, changes);
        return { ok: true, changed: changes.length };
      });
    }),

  updateLesson: mentorProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(3).max(100).optional(),
        mode: z.enum(schema.lessonMode.enumValues).optional(),
        isRequired: z.boolean().optional(),
        isFree: z.boolean().optional(),
        durationMinutes: z.number().int().positive().max(600).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      return ctx.db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(lessons)
          .where(eq(lessons.id, id))
          .for("update");
        if (!before)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No such lesson.",
          });
        const changes = diff(before, fields);
        const title = fields.title ?? before.title;
        await tx
          .update(lessons)
          .set({
            ...fields,
            needsMetadata:
              title && title !== before.slug ? false : before.needsMetadata,
            updatedAt: new Date(),
          })
          .where(eq(lessons.id, id));
        await recordEdit(tx, "lesson", id, ctx.user.id, changes);
        return { ok: true, changed: changes.length };
      });
    }),

  updateModule: mentorProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(3).max(80).optional(),
        summary: z.string().trim().max(200).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      return ctx.db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(modules)
          .where(eq(modules.id, id))
          .for("update");
        if (!before)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No such module.",
          });
        const changes = diff(before, fields);
        await tx.update(modules).set(fields).where(eq(modules.id, id));
        await recordEdit(tx, "module", id, ctx.user.id, changes);
        return { ok: true, changed: changes.length };
      });
    }),

  /** One path's metadata. Its courses and their order come from the repo. */
  path: mentorProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const path = await ctx.db.query.paths.findFirst({
        where: eq(schema.paths.slug, input.slug),
        with: {
          pathCourses: {
            with: { course: { columns: { slug: true, title: true } } },
            orderBy: (pc, { asc: a }) => [a(pc.position)],
          },
        },
      });
      if (!path)
        throw new TRPCError({ code: "NOT_FOUND", message: "No such path." });
      return { path };
    }),

  updatePath: mentorProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        title: z.string().trim().min(3).max(80).optional(),
        summary: z.string().trim().min(20).max(200).optional(),
        description: z.string().trim().max(4000).nullish(),
        isPublished: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { slug, ...fields } = input;
      return ctx.db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(schema.paths)
          .where(eq(schema.paths.slug, slug))
          .for("update");
        if (!before)
          throw new TRPCError({ code: "NOT_FOUND", message: "No such path." });
        const after = { ...before, ...fields };
        const described = !!after.title?.trim() && !!after.summary?.trim();
        if (fields.isPublished && !described)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Give the path a title and summary before publishing it.",
          });
        const changes = diff(before, fields);
        await tx
          .update(schema.paths)
          .set({
            ...fields,
            needsMetadata: described ? false : before.needsMetadata,
          })
          .where(eq(schema.paths.id, before.id));
        // A path is a course-shaped subject for the trail's purposes.
        await recordEdit(tx, "course", before.id, ctx.user.id, changes);
        return { ok: true, changed: changes.length };
      });
    }),

  /**
   * Replace the credits for one role on one subject. Credits are users
   * (founder decision, S11), so a byline always resolves to a real profile.
   */
  setCredits: mentorProcedure
    .input(
      z.object({
        subjectType: z.enum(["course", "lesson"]),
        subjectId: z.uuid(),
        role: z.enum(schema.creditRole.enumValues),
        userIds: z.array(z.uuid()).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Crediting the same person twice is a duplicate, not an error: the UI
      // can send it by clicking somebody already in the list.
      input.userIds = [...new Set(input.userIds)];
      if (input.userIds.length) {
        const found = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, input.userIds));
        if (found.length !== input.userIds.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One of those people does not have a devhelp account.",
          });
      }
      return ctx.db.transaction(async (tx) => {
        const before = await tx
          .select({ userId: contentCredits.userId })
          .from(contentCredits)
          .where(
            and(
              eq(contentCredits.subjectType, input.subjectType),
              eq(contentCredits.subjectId, input.subjectId),
              eq(contentCredits.role, input.role),
            ),
          );
        await tx
          .delete(contentCredits)
          .where(
            and(
              eq(contentCredits.subjectType, input.subjectType),
              eq(contentCredits.subjectId, input.subjectId),
              eq(contentCredits.role, input.role),
            ),
          );
        if (input.userIds.length)
          await tx.insert(contentCredits).values(
            input.userIds.map((userId, position) => ({
              subjectType: input.subjectType,
              subjectId: input.subjectId,
              userId,
              role: input.role,
              position,
            })),
          );
        await recordEdit(tx, input.subjectType, input.subjectId, ctx.user.id, [
          {
            field: `${input.role}s`,
            before: before.map((b) => b.userId).join(", ") || null,
            after: input.userIds.join(", ") || null,
          },
        ]);
        return { ok: true };
      });
    }),

  /** Find someone to credit. Mentors and admins only; not a user directory. */
  findPeople: mentorProcedure
    .input(z.object({ q: z.string().trim().min(2).max(60) }))
    .query(async ({ ctx, input }) =>
      ctx.db
        .select({
          id: users.id,
          name: users.name,
          handle: users.handle,
          role: users.role,
        })
        .from(users)
        .where(
          or(
            ilike(users.name, `%${input.q}%`),
            ilike(users.handle, `%${input.q}%`),
          ),
        )
        .orderBy(asc(users.name))
        .limit(10),
    ),
});

/** Public attribution (F3.9). */
export const contributorsRouter = router({
  /** Everyone credited, with what they worked on. */
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        userId: users.id,
        name: users.name,
        handle: users.handle,
        image: users.image,
        profilePublic: users.profilePublic,
        role: contentCredits.role,
        subjectType: contentCredits.subjectType,
        subjectId: contentCredits.subjectId,
      })
      .from(contentCredits)
      .innerJoin(users, eq(users.id, contentCredits.userId))
      .orderBy(asc(users.name));
    const courseTitles = new Map(
      (
        await ctx.db
          .select({ id: courses.id, title: courses.title, slug: courses.slug })
          .from(courses)
      ).map((c) => [c.id, c]),
    );
    const lessonTitles = new Map(
      (
        await ctx.db
          .select({ id: lessons.id, title: lessons.title })
          .from(lessons)
      ).map((l) => [l.id, l]),
    );
    type Person = {
      userId: string;
      name: string;
      handle: string | null;
      image: string | null;
      profilePublic: boolean;
      courses: { slug: string; title: string }[];
      lessonCount: number;
      reviewCount: number;
    };
    const people = new Map<string, Person>();
    for (const r of rows) {
      const p: Person = people.get(r.userId) ?? {
        userId: r.userId,
        name: r.name,
        handle: r.handle,
        image: r.image,
        profilePublic: !!r.profilePublic,
        courses: [],
        lessonCount: 0,
        reviewCount: 0,
      };
      if (r.role === "reviewer") p.reviewCount += 1;
      else if (r.subjectType === "course") {
        const c = courseTitles.get(r.subjectId);
        if (c && !p.courses.some((x) => x.slug === c.slug))
          p.courses.push({ slug: c.slug, title: c.title });
      } else if (r.subjectType === "lesson" && lessonTitles.has(r.subjectId))
        p.lessonCount += 1;
      people.set(r.userId, p);
    }
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  }),

  /** The byline for one lesson: who wrote it, who reviewed it. */
  forLesson: publicProcedure
    .input(z.object({ lessonId: z.uuid() }))
    .query(async ({ ctx, input }) =>
      creditsFor(ctx.db, "lesson", input.lessonId),
    ),
});
