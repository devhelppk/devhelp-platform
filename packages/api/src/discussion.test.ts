import { db, eq, schema } from "@repo/database";
import { enroll, recordEvent } from "@repo/learning";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User,
  mentor: User,
  careerMentor: User,
  learner: User,
  other: User,
  newbie: User;
let ids: { courseId: string; lessonId: string; lesson2Id: string };
const slug = `disc-${run}`;

const as = (u: User | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({ user: u, session: { id: "s" } } as unknown as Context["session"])
      : null,
  } as Context);

async function user(
  name: string,
  extra: Partial<typeof schema.users.$inferInsert> = {},
) {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${name}-${run}@devhelp.test`,
      name,
      emailVerified: true,
      ...extra,
    })
    .returning();
  return u!;
}

beforeAll(async () => {
  admin = await user("admin", { role: "admin" });
  mentor = await user("mentor", { role: "mentor" });
  careerMentor = await user("career", { role: "mentor" });
  await db.insert(schema.mentorTracks).values([
    { userId: mentor.id, track: "technical" },
    { userId: careerMentor.id, track: "career" },
  ]);
  learner = await user("learner");
  other = await user("other");
  newbie = await user("newbie", { createdAt: new Date() });
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug,
      title: `Discussion ${run}`,
      summary: "A private course for discussion tests, long enough.",
      isPublished: true,
    })
    .returning();
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId: course!.id, slug: "m1", title: "M1", position: 1 })
    .returning();
  const [l1] = await db
    .insert(schema.lessons)
    .values({
      courseId: course!.id,
      moduleId: mod!.id,
      slug: "l1",
      title: "Lesson one",
      type: "article",
      position: 1,
    })
    .returning();
  const [l2] = await db
    .insert(schema.lessons)
    .values({
      courseId: course!.id,
      moduleId: mod!.id,
      slug: "l2",
      title: "Lesson two",
      type: "article",
      position: 2,
    })
    .returning();
  ids = { courseId: course!.id, lessonId: l1!.id, lesson2Id: l2!.id };
});
afterAll(async () => {
  await db.delete(schema.courses).where(eq(schema.courses.id, ids.courseId));
  for (const u of [admin, mentor, careerMentor, learner, other, newbie])
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
});

describe("lesson feedback", () => {
  it("is one row per learner per lesson and moves the aggregates on write", async () => {
    const c = as(learner);
    await c.feedback.rate({
      courseSlug: slug,
      lessonSlug: "l1",
      rating: 4,
      tags: ["unclear", "unclear"],
      text: "The last step lost me.",
    });
    await c.feedback.rate({
      courseSlug: slug,
      lessonSlug: "l1",
      rating: 2,
      tags: ["unclear"],
    });
    await as(other).feedback.rate({
      courseSlug: slug,
      lessonSlug: "l1",
      rating: 4,
    });
    const mine = await c.feedback.mine({ courseSlug: slug, lessonSlug: "l1" });
    expect(mine).toMatchObject({ rating: 2, tags: ["unclear"], text: null });
    const lesson = await db.query.lessons.findFirst({
      where: eq(schema.lessons.id, ids.lessonId),
    });
    expect(lesson).toMatchObject({
      ratingAvg: "3.00",
      ratingCount: 2,
      unclearCount: 1,
    });
  });
});

describe("course reviews", () => {
  it("opens at 50 percent, is one per learner, visible at once, and aggregates", async () => {
    await expect(
      as(learner).reviews.submit({
        courseSlug: slug,
        rating: 5,
        body: "Great course, taught me to trace requests properly.",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await enroll(learner.id, ids.courseId);
    await recordEvent({
      userId: learner.id,
      kind: "lesson_completed",
      lessonId: ids.lessonId,
      idempotencyKey: `lc:${run}:1`,
    });
    expect(
      (await as(learner).reviews.mine({ courseSlug: slug })).canReview,
    ).toBe(true);
    await as(learner).reviews.submit({
      courseSlug: slug,
      rating: 5,
      title: "Solid",
      body: "Great course, taught me to trace requests properly.",
    });
    await as(learner).reviews.submit({
      courseSlug: slug,
      rating: 4,
      body: "Great course, taught me to trace requests properly. Edited.",
    });
    const list = await as(null).reviews.list({ courseSlug: slug });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ rating: 4, completedAtReview: 0 });
    const course = await db.query.courses.findFirst({
      where: eq(schema.courses.id, ids.courseId),
    });
    expect(course).toMatchObject({
      ratingAvg: "4.00",
      ratingCount: 1,
      reviewCount: 1,
    });
    // verifiedProcedure reads the flag from the table, not the session.
    await db
      .update(schema.users)
      .set({ emailVerified: false })
      .where(eq(schema.users.id, other.id));
    await expect(
      as(other).reviews.submit({
        courseSlug: slug,
        rating: 3,
        body: "x".repeat(30),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db
      .update(schema.users)
      .set({ emailVerified: true })
      .where(eq(schema.users.id, other.id));
  });

  it("a flag creates a queue item and upholding it hides the review", async () => {
    const list = await as(null).reviews.list({ courseSlug: slug });
    const review = list.items[0]!;
    const flag = await as(other).moderation.flag({
      subjectType: "course_review",
      subjectId: review.id,
      reason: "names_individual",
    });
    expect(flag.id).toBeTruthy();
    const item = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.subjectId, review.id),
    });
    expect(item).toMatchObject({
      subjectType: "course_review",
      status: "approved",
      track: "technical",
    });
    await as(mentor).moderation.resolveFlag({
      id: flag.id!,
      outcome: "upheld",
    });
    expect(
      (await as(null).reviews.list({ courseSlug: slug })).items,
    ).toHaveLength(0);
    const course = await db.query.courses.findFirst({
      where: eq(schema.courses.id, ids.courseId),
    });
    expect(course?.reviewCount).toBe(0);
    // An edit does not republish a hidden review.
    await as(learner).reviews.submit({
      courseSlug: slug,
      rating: 5,
      body: "Great course, taught me to trace requests properly. Edited again.",
    });
    expect(
      (await as(null).reviews.list({ courseSlug: slug })).items,
    ).toHaveLength(0);
    expect(
      (await as(learner).reviews.mine({ courseSlug: slug })).review?.status,
    ).toBe("hidden");
  });
});

describe("discussions", () => {
  let questionId: string;
  it("renders and sanitises markdown, nests one level, counts open questions", async () => {
    const q = await as(learner).comments.create({
      courseSlug: slug,
      lessonSlug: "l1",
      body: "Why does `refund()` keep the **old** status?\n\n```ts\nconst s = order.status;\n```\n<script>x</script>",
    });
    questionId = q.id;
    expect(q.status).toBe("visible");
    const list = await as(null).comments.list({
      courseSlug: slug,
      lessonSlug: "l1",
    });
    expect(list.items[0]?.bodyHtml).toContain("<strong>old</strong>");
    expect(list.items[0]?.body).toBe("");
    expect(
      (await as(learner).comments.list({ courseSlug: slug, lessonSlug: "l1" }))
        .items[0]?.body,
    ).toContain("**old**");
    expect(list.items[0]?.bodyHtml).toContain('class="language-ts"');
    expect(list.items[0]?.bodyHtml).not.toContain("<script");
    expect(
      (
        await db.query.lessons.findFirst({
          where: eq(schema.lessons.id, ids.lessonId),
        })
      )?.openQuestionCount,
    ).toBe(1);
    const reply = await as(other).comments.create({
      courseSlug: slug,
      lessonSlug: "l1",
      body: "Because `status` is computed from the old value.",
      parentId: questionId,
    });
    await expect(
      as(learner).comments.create({
        courseSlug: slug,
        lessonSlug: "l1",
        body: "nested?",
        parentId: reply.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (
        await db.query.lessons.findFirst({
          where: eq(schema.lessons.id, ids.lessonId),
        })
      )?.openQuestionCount,
    ).toBe(0);
    // Question author notified of the reply.
    const inbox = await as(learner).notifications.list();
    expect(inbox.items[0]).toMatchObject({ kind: "comment_reply" });
  });

  it("votes toggle, authors cannot vote for themselves, accept is track-scoped and moves", async () => {
    const list = await as(learner).comments.list({
      courseSlug: slug,
      lessonSlug: "l1",
    });
    const reply = list.items[0]!.replies[0]!;
    await expect(
      as(other).comments.vote({ id: reply.id, on: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await as(learner).comments.vote({ id: reply.id, on: true })).toEqual(
      { voteCount: 1, voted: true },
    );
    expect(await as(learner).comments.vote({ id: reply.id, on: true })).toEqual(
      { voteCount: 1, voted: true },
    );
    expect(
      await as(learner).comments.vote({ id: reply.id, on: false }),
    ).toEqual({ voteCount: 0, voted: false });
    await expect(
      as(careerMentor).comments.accept({ id: reply.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      as(learner).comments.accept({ id: reply.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await as(mentor).comments.accept({ id: reply.id });
    const second = await as(admin).comments.create({
      courseSlug: slug,
      lessonSlug: "l1",
      body: "Also see the tests.",
      parentId: questionId,
    });
    await as(admin).comments.accept({ id: second.id });
    const after = await as(null).comments.list({
      courseSlug: slug,
      lessonSlug: "l1",
    });
    const accepted = after.items[0]!.replies.filter((r) => r.acceptedAt);
    expect(accepted.map((r) => r.id)).toEqual([second.id]);
    expect(after.items[0]!.replies[0]!.id).toBe(second.id);
    // The first accept (mentor accepting other's reply) notified the reply's author; self-accepts do not.
    expect(
      (await as(other).notifications.list()).items.some(
        (n) => n.kind === "comment_accepted",
      ),
    ).toBe(true);
    expect(
      (await as(admin).notifications.list()).items.some(
        (n) => n.kind === "comment_accepted",
      ),
    ).toBe(false);
  });

  it("holds links from new accounts for the queue; approve publishes, reject hides", async () => {
    const held = await as(newbie).comments.create({
      courseSlug: slug,
      lessonSlug: "l2",
      body: "See https://example.com/spam for my notes",
    });
    expect(held.status).toBe("held");
    expect(
      (await as(null).comments.list({ courseSlug: slug, lessonSlug: "l2" }))
        .items,
    ).toHaveLength(0);
    expect(
      (await as(newbie).comments.list({ courseSlug: slug, lessonSlug: "l2" }))
        .items[0],
    ).toMatchObject({ status: "held", mine: true });
    const item = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.subjectId, held.id),
    });
    expect(item).toMatchObject({
      subjectType: "comment",
      status: "pending",
      track: "technical",
    });
    expect(
      (await as(careerMentor).moderation.queue({})).items.map((i) => i.id),
    ).not.toContain(item!.id);
    expect(
      (await as(mentor).moderation.queue({})).items.map((i) => i.id),
    ).toContain(item!.id);
    // Watchers and the author hear about a held comment only once it is approved.
    await as(mentor).comments.watch({
      courseSlug: slug,
      lessonSlug: "l2",
      on: true,
    });
    await as(mentor).moderation.decide({ id: item!.id, action: "approve" });
    expect(
      (await as(null).comments.list({ courseSlug: slug, lessonSlug: "l2" }))
        .items[0],
    ).toMatchObject({ id: held.id, status: "visible" });
    expect(
      (await as(mentor).notifications.list()).items.some(
        (n) => n.kind === "lesson_question",
      ),
    ).toBe(true);
    expect((await as(newbie).notifications.list()).items[0]).toMatchObject({
      kind: "moderation_decided",
      title: "Your comment is published",
    });
    await as(mentor).comments.watch({
      courseSlug: slug,
      lessonSlug: "l2",
      on: false,
    });
    // Hide it again via a flag, then the author cannot edit it.
    const flag = await as(other).moderation.flag({
      subjectType: "comment",
      subjectId: held.id,
      reason: "spam",
    });
    await as(admin).moderation.resolveFlag({ id: flag.id!, outcome: "upheld" });
    expect(
      (await as(null).comments.list({ courseSlug: slug, lessonSlug: "l2" }))
        .items[0],
    ).toMatchObject({ removed: true, bodyHtml: "" });
    await expect(
      as(newbie).comments.edit({ id: held.id, body: "edited" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("watchers are notified of new questions; edit and delete are the author's", async () => {
    await as(mentor).comments.watch({
      courseSlug: slug,
      lessonSlug: "l2",
      on: true,
    });
    const q = await as(learner).comments.create({
      courseSlug: slug,
      lessonSlug: "l2",
      body: "Is there a shorter way to write this?",
    });
    expect((await as(mentor).notifications.list()).items[0]).toMatchObject({
      kind: "lesson_question",
    });
    await expect(
      as(other).comments.edit({ id: q.id, body: "hijack" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await as(learner).comments.edit({
      id: q.id,
      body: "Is there a *shorter* way?",
    });
    const edited = (
      await as(null).comments.list({
        courseSlug: slug,
        lessonSlug: "l2",
        sort: "new",
      })
    ).items.find((i) => i.id === q.id)!;
    expect(edited.bodyHtml).toContain("<em>shorter</em>");
    expect(edited.editedAt).toBeTruthy();
    await as(learner).comments.remove({ id: q.id });
    const gone = (
      await as(null).comments.list({
        courseSlug: slug,
        lessonSlug: "l2",
        sort: "new",
      })
    ).items.find((i) => i.id === q.id)!;
    expect(gone).toMatchObject({ status: "deleted", removed: true });
    // Editing in a link from a young account (every test user is minutes old) holds the comment and snapshots the new text; deleting it closes the item.
    const plain = await as(learner).comments.create({
      courseSlug: slug,
      lessonSlug: "l2",
      body: "Plain text, no link yet.",
    });
    expect(plain.status).toBe("visible");
    const edited2 = await as(learner).comments.edit({
      id: plain.id,
      body: "Now with https://example.com/sneaky",
    });
    expect(edited2.status).toBe("held");
    const heldItem = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.subjectId, plain.id),
    });
    expect(heldItem).toMatchObject({ status: "pending" });
    expect(
      (heldItem!.payload as { data: { body: string } }).data.body,
    ).toContain("sneaky");
    expect(
      (
        await as(null).comments.list({
          courseSlug: slug,
          lessonSlug: "l2",
          sort: "new",
        })
      ).items.some((i) => i.id === plain.id),
    ).toBe(false);
    await as(learner).comments.remove({ id: plain.id });
    expect(
      (
        await db.query.moderationItems.findFirst({
          where: eq(schema.moderationItems.id, heldItem!.id),
        })
      )?.status,
    ).toBe("rejected");
    // Approving the item of a deleted comment does not resurrect it.
    await db
      .update(schema.moderationItems)
      .set({ status: "pending" })
      .where(eq(schema.moderationItems.id, heldItem!.id));
    await as(admin).moderation.decide({ id: heldItem!.id, action: "approve" });
    expect(
      (
        await db.query.comments.findFirst({
          where: eq(schema.comments.id, plain.id),
        })
      )?.status,
    ).toBe("deleted");
    // Course-level thread works with no lesson.
    const c = await as(learner).comments.create({
      courseSlug: slug,
      body: "Loved the pacing overall.",
      kind: "note",
    });
    expect(
      (await as(null).comments.list({ courseSlug: slug })).items[0]?.id,
    ).toBe(c.id);
  });
});
